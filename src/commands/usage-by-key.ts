import { requestJson } from "../lib/api.js";
import { appendRequiredDateRangeParams } from "../lib/history.js";
import { resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface UsageByKeyOptions {
  baseUrl?: string;
  sessionFile: string;
  startDate?: string;
  endDate?: string;
  allowTokenHostMismatch?: boolean;
}

export async function usageByKey(options: UsageByKeyOptions): Promise<void> {
  const searchParams = new URLSearchParams();
  appendRequiredDateRangeParams(searchParams, {
    startDate: options.startDate,
    endDate: options.endDate,
  });

  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    allowTokenHostMismatch: options.allowTokenHostMismatch,
  });

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const result = await requestJson<Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/api/usage/by-key${suffix}`,
    token,
  });

  writeJson(result);
}
