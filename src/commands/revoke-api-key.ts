import { requestJson } from "../lib/api.js";
import {
  KeyDeletedResponse,
  resolvePortalContext,
  writeJson,
} from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface RevokeApiKeyOptions {
  keyId: string;
  baseUrl?: string;
  sessionFile: string;
}

export async function revokeApiKey(options: RevokeApiKeyOptions): Promise<void> {
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
  });

  const result = await requestJson<KeyDeletedResponse>({
    method: "DELETE",
    url: `${baseUrl}/api/keys/${options.keyId}`,
    token,
  });

  writeJson(result);
}
