import {
  canonicalizeOrigin,
  CliError,
  fetchWithTimeout,
  normalizeBaseUrl,
  requireSecureNonLocalBaseUrl,
} from "./api.js";
import { DEFAULT_SESSION_FILE, loadSession } from "./session.js";

export const TRUSTED_CLOUD_CLAW_BASE_URL = "https://claw.altllm.ai";
export const DEFAULT_CLOUD_CLAW_BASE_URL =
  process.env.CLOUD_CLAW_BASE_URL || TRUSTED_CLOUD_CLAW_BASE_URL;

export const CLOUD_CLAW_AGENT_TYPES = ["openclaw", "picoclaw", "aintern"] as const;
export type CloudClawAgentType = (typeof CLOUD_CLAW_AGENT_TYPES)[number];

export type CloudClawHttpSurface =
  | "portal-sso"
  | "api"
  | "logs"
  | "log-stream";

function extractCloudClawErrorDetail(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (typeof parsed === "string") {
      return parsed.trim();
    }

    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      for (const key of ["message", "error", "detail"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }

    return JSON.stringify(parsed);
  } catch {
    return trimmed;
  }
}

function withCloudClawErrorDetail(message: string, text: string): string {
  const detail = extractCloudClawErrorDetail(text);
  return detail ? `${message} Details: ${detail}` : message;
}

export function formatCloudClawHttpError(params: {
  surface: CloudClawHttpSurface;
  method: string;
  url: string;
  status: number;
  text: string;
  operation?: string;
}): string {
  if (params.surface === "portal-sso") {
    if (params.status === 401 || params.status === 403) {
      return withCloudClawErrorDetail(
        `Cloud Claw portal-sso rejected the saved Portal session (HTTP ${params.status}). Run altllm login-wallet again, then retry.`,
        params.text
      );
    }

    if (params.status === 503) {
      return withCloudClawErrorDetail(
        "Cloud Claw portal-sso is unavailable (HTTP 503). Portal or Cloud Claw auth may be unavailable or misconfigured during the security rollout. Retry after service recovery.",
        params.text
      );
    }
  }

  const operation =
    params.operation ||
    (params.surface === "logs"
      ? "logs request"
      : params.surface === "log-stream"
        ? "log stream"
        : `${params.method} ${params.url}`);

  if (params.status === 401) {
    return withCloudClawErrorDetail(
      `Cloud Claw rejected the session JWT for ${operation} (HTTP 401). Run altllm login-wallet again, then retry. If this still fails, Cloud Claw auth signing may be misconfigured.`,
      params.text
    );
  }

  if (params.status === 403) {
    return withCloudClawErrorDetail(
      `Cloud Claw denied ${operation} (HTTP 403). The account may not be authorized for this Cloud Claw resource or action.`,
      params.text
    );
  }

  if (params.status === 503) {
    return withCloudClawErrorDetail(
      `Cloud Claw ${operation} is unavailable (HTTP 503). Cloud Claw may be unavailable or missing required auth signing configuration.`,
      params.text
    );
  }

  return withCloudClawErrorDetail(
    `${params.method} ${params.url} failed: ${params.status}.`,
    params.text
  );
}

function normalizeCloudClawBaseUrl(baseUrl: string): string {
  return normalizeBaseUrl(baseUrl);
}

function ensureCloudClawBaseUrlAllowed(params: {
  baseUrl: string;
  allowTokenForwarding?: boolean;
}): void {
  const normalizedBaseUrl = normalizeCloudClawBaseUrl(params.baseUrl);
  requireSecureNonLocalBaseUrl(
    normalizedBaseUrl,
    "the saved Portal session token"
  );
  const normalizedTrustedBaseUrl = normalizeCloudClawBaseUrl(
    TRUSTED_CLOUD_CLAW_BASE_URL
  );
  const canonicalBaseUrlOrigin = canonicalizeOrigin(normalizedBaseUrl);
  const canonicalTrustedOrigin = canonicalizeOrigin(normalizedTrustedBaseUrl);

  if (
    canonicalBaseUrlOrigin !== canonicalTrustedOrigin &&
    !params.allowTokenForwarding
  ) {
    throw new CliError(
      `Refusing to forward the saved Portal session token to non-trusted Cloud Claw base URL ${normalizedBaseUrl}. The trusted default is ${normalizedTrustedBaseUrl}. Re-run with --allow-cloud-claw-token-forwarding if you trust this host.`
    );
  }
}

async function requestCloudClawEndpointJson<T>(params: {
  method: string;
  url: string;
  body?: unknown;
  token?: string;
  surface: CloudClawHttpSurface;
  operation?: string;
}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let payload: string | undefined;
  if (params.body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(params.body);
  }
  if (params.token) {
    headers.Authorization = `Bearer ${params.token}`;
  }

  const response = await fetchWithTimeout({
    method: params.method,
    url: params.url,
    headers,
    body: payload,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new CliError(
      formatCloudClawHttpError({
        surface: params.surface,
        method: params.method,
        url: params.url,
        status: response.status,
        text,
        operation: params.operation,
      })
    );
  }

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CliError(
      `${params.method} ${params.url} returned invalid JSON: ${text}`
    );
  }
}

export async function getCloudClawJwt(params: {
  baseUrl?: string;
  sessionFile: string;
  force?: boolean;
  allowTokenForwarding?: boolean;
}): Promise<{ baseUrl: string; jwt: string }> {
  const baseUrl = normalizeCloudClawBaseUrl(
    params.baseUrl || DEFAULT_CLOUD_CLAW_BASE_URL
  );
  ensureCloudClawBaseUrlAllowed({
    baseUrl,
    allowTokenForwarding: params.allowTokenForwarding,
  });

  const session = await loadSession(params.sessionFile || DEFAULT_SESSION_FILE);

  const sso = await requestCloudClawEndpointJson<{
    authenticated?: boolean;
    token?: string;
  }>({
    method: "POST",
    url: `${baseUrl}/api/auth/portal-sso`,
    body: {
      token: session.token,
      force: Boolean(params.force),
    },
    surface: "portal-sso",
    operation: "portal-sso",
  });

  if (!sso.token) {
    throw new CliError(
      "Cloud Claw portal-sso did not return a JWT. Run altllm login-wallet again, then retry. If this still fails, Cloud Claw auth signing may be misconfigured."
    );
  }

  return { baseUrl, jwt: sso.token };
}

export async function requestCloudClawJson<T>(params: {
  method: string;
  path: string;
  body?: unknown;
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
  allowTokenForwarding?: boolean;
}): Promise<T> {
  const { baseUrl, jwt } = await getCloudClawJwt({
    baseUrl: params.baseUrl,
    sessionFile: params.sessionFile,
    force: params.forceSso,
    allowTokenForwarding: params.allowTokenForwarding,
  });

  return requestCloudClawEndpointJson<T>({
    method: params.method,
    url: `${baseUrl}${params.path}`,
    body: params.body,
    token: jwt,
    surface: "api",
    operation: `${params.method} ${params.path}`,
  });
}

export function parseCloudClawAgentType(agentType: string): CloudClawAgentType {
  const normalized = agentType.trim().toLowerCase();
  if ((CLOUD_CLAW_AGENT_TYPES as readonly string[]).includes(normalized)) {
    return normalized as CloudClawAgentType;
  }

  throw new CliError(
    `Invalid Cloud Claw agent type: ${agentType}. Expected one of ${CLOUD_CLAW_AGENT_TYPES.join(", ")}.`
  );
}

export function validateDeploymentName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new CliError("Deployment name cannot be empty.");
  }
  if (!/^[a-z0-9-]{1,63}$/.test(trimmed)) {
    throw new CliError(
      "Deployment name must match ^[a-z0-9-]+$ and be at most 63 characters."
    );
  }
  return trimmed;
}

export function validateTelegramAllowedUsers(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new CliError(
      "Telegram allowed users cannot be empty when provided. Omit --telegram-allowed-users to allow everyone."
    );
  }

  if (!/^(\s*\d+\s*,)*\s*\d+\s*$/.test(trimmed)) {
    throw new CliError(
      "Telegram allowed users must be a comma-separated list of numeric Telegram user IDs."
    );
  }

  return trimmed;
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
