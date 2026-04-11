import { requestJson } from "../lib/api.js";
import {
  buildKeyPermissions,
  CreateKeyResponse,
  resolvePortalContext,
  validateApiKeyName,
  writeJson,
} from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CreateApiKeyOptions {
  name: string;
  models?: string;
  model?: string[];
  baseUrl?: string;
  sessionFile: string;
}

export async function createApiKey(options: CreateApiKeyOptions): Promise<void> {
  const name = validateApiKeyName(options.name);

  const permissions = buildKeyPermissions({
    models: options.models,
    model: options.model,
  });
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
  });

  const result = await requestJson<CreateKeyResponse>({
    method: "POST",
    url: `${baseUrl}/api/keys`,
    token,
    body: {
      name,
      permissions,
    },
  });

  writeJson(result);
}
