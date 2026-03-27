import { CliError, normalizeBaseUrl } from "./api.js";
import { DEFAULT_SESSION_FILE, loadSession } from "./session.js";

export interface KeyPermissions {
  models: string[];
}

export interface KeySummary {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "disabled" | "revoked" | "expired";
  created_at: string;
  last_used_at?: string | null;
  permissions: KeyPermissions;
}

export interface KeyDetail {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "disabled" | "revoked" | "expired";
  permissions: KeyPermissions;
  rate_limit_rpm: number;
  rate_limit_tpm: number;
  created_at: string;
  last_used_at?: string | null;
}

export interface CreateKeyResponse {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
}

export interface ListKeysResponse {
  keys: KeySummary[];
}

export interface KeyDeletedResponse {
  id: string;
  message: string;
}

export const MUTABLE_KEY_STATUSES = ["active", "disabled", "revoked"] as const;
export type MutableKeyStatus = (typeof MUTABLE_KEY_STATUSES)[number];

export async function resolvePortalContext(options: {
  baseUrl?: string;
  sessionFile: string;
}): Promise<{ baseUrl: string; token: string }> {
  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  return {
    baseUrl: normalizeBaseUrl(options.baseUrl || session.baseUrl),
    token: session.token,
  };
}

export function buildKeyPermissions(params: {
  models?: string;
  model?: string[];
}): KeyPermissions | undefined {
  const csvModels = params.models ? params.models.split(",") : [];
  const repeatedModels = params.model ?? [];
  const rawModels = [...repeatedModels, ...csvModels];
  const models = Array.from(
    new Set(
      rawModels
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );

  if (rawModels.length > 0 && models.length === 0) {
    throw new CliError("Provide at least one non-empty model ID.");
  }

  if (models.length === 0) {
    return undefined;
  }

  for (const model of models) {
    if (!/^altllm-[a-zA-Z0-9-]+$/.test(model)) {
      throw new CliError(
        `Invalid model ID: ${model}. Model IDs must start with 'altllm-'.`
      );
    }
  }

  return { models };
}

export function parseMutableKeyStatus(status: string): MutableKeyStatus {
  const normalized = status.trim().toLowerCase();
  if ((MUTABLE_KEY_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as MutableKeyStatus;
  }

  throw new CliError(
    `Invalid API key status: ${status}. Expected one of ${MUTABLE_KEY_STATUSES.join(", ")}.`
  );
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
