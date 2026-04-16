import { CliError, normalizeBaseUrl, requestJson } from "./api.js";
import { DEFAULT_SESSION_FILE, loadSession } from "./session.js";

export const TRUSTED_CLOUD_CLAW_BASE_URL = "https://claw.altllm.ai";
export const DEFAULT_CLOUD_CLAW_BASE_URL =
  process.env.CLOUD_CLAW_BASE_URL || TRUSTED_CLOUD_CLAW_BASE_URL;

export const CLOUD_CLAW_AGENT_TYPES = ["openclaw", "picoclaw", "aintern"] as const;
export type CloudClawAgentType = (typeof CLOUD_CLAW_AGENT_TYPES)[number];

function normalizeCloudClawBaseUrl(baseUrl: string): string {
  return normalizeBaseUrl(baseUrl);
}

function ensureCloudClawBaseUrlAllowed(params: {
  baseUrl: string;
  allowTokenForwarding?: boolean;
}): void {
  const normalizedBaseUrl = normalizeCloudClawBaseUrl(params.baseUrl);
  const normalizedTrustedBaseUrl = normalizeCloudClawBaseUrl(
    TRUSTED_CLOUD_CLAW_BASE_URL
  );

  if (
    normalizedBaseUrl !== normalizedTrustedBaseUrl &&
    !params.allowTokenForwarding
  ) {
    throw new CliError(
      `Refusing to forward the saved Portal session token to non-trusted Cloud Claw base URL ${normalizedBaseUrl}. The trusted default is ${normalizedTrustedBaseUrl}. Re-run with --allow-cloud-claw-token-forwarding if you trust this host.`
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

  const sso = await requestJson<{ authenticated?: boolean; token?: string }>({
    method: "POST",
    url: `${baseUrl}/api/auth/portal-sso`,
    body: {
      token: session.token,
      force: Boolean(params.force),
    },
  });

  if (!sso.token) {
    throw new CliError("Cloud Claw portal-sso did not return a JWT.");
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

  return requestJson<T>({
    method: params.method,
    url: `${baseUrl}${params.path}`,
    body: params.body,
    token: jwt,
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
    return undefined;
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
