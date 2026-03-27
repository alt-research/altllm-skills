import { requestJson } from "../lib/api.js";
import { resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface UsageSummaryOptions {
  baseUrl?: string;
  sessionFile: string;
}

export async function usageSummary(options: UsageSummaryOptions): Promise<void> {
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
  });

  const result = await requestJson<Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/api/usage/summary`,
    token,
  });

  writeJson(result);
}
