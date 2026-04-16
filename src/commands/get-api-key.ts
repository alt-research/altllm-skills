import { requestJson } from "../lib/api.js";
import { KeyDetail, resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface GetApiKeyOptions {
  keyId: string;
  baseUrl?: string;
  sessionFile: string;
  allowTokenHostMismatch?: boolean;
}

export async function getApiKey(options: GetApiKeyOptions): Promise<void> {
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    allowTokenHostMismatch: options.allowTokenHostMismatch,
  });

  const result = await requestJson<KeyDetail>({
    method: "GET",
    url: `${baseUrl}/api/keys/${options.keyId}`,
    token,
  });

  writeJson(result);
}
