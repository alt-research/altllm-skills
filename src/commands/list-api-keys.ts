import { requestJson } from "../lib/api.js";
import { ListKeysResponse, resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface ListApiKeysOptions {
  baseUrl?: string;
  sessionFile: string;
}

export async function listApiKeys(options: ListApiKeysOptions): Promise<void> {
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
  });

  const result = await requestJson<ListKeysResponse>({
    method: "GET",
    url: `${baseUrl}/api/keys`,
    token,
  });

  writeJson(result);
}
