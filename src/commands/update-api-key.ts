import { CliError, requestSavedPortalSessionJson } from "../lib/api.js";
import {
  buildKeyPermissions,
  KeyDetail,
  parseMutableKeyStatus,
  resolvePortalContext,
  validateApiKeyName,
  writeJson,
} from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface UpdateApiKeyOptions {
  keyId: string;
  name?: string;
  status?: string;
  models?: string;
  model?: string[];
  baseUrl?: string;
  sessionFile: string;
  allowTokenHostMismatch?: boolean;
}

export async function updateApiKey(options: UpdateApiKeyOptions): Promise<void> {
  const body: {
    name?: string;
    status?: string;
    permissions?: { models: string[] };
  } = {};

  if (options.name !== undefined) {
    body.name = validateApiKeyName(options.name);
  }

  const permissions = buildKeyPermissions({
    models: options.models,
    model: options.model,
  });
  if (permissions) {
    body.permissions = permissions;
  }

  if (options.status !== undefined) {
    body.status = parseMutableKeyStatus(options.status);
  }

  if (Object.keys(body).length === 0) {
    throw new CliError(
      "Provide at least one update via --name, --status, --model, or --models."
    );
  }

  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    allowTokenHostMismatch: options.allowTokenHostMismatch,
  });

  const result = await requestSavedPortalSessionJson<KeyDetail>({
    method: "PATCH",
    url: `${baseUrl}/api/keys/${options.keyId}`,
    token,
    body,
  });

  writeJson(result);
}
