import { requestJson } from "../lib/api.js";
import { appendRequiredDateRangeOrMonthParams } from "../lib/history.js";
import { resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface UsageByKeyOptions {
  baseUrl?: string;
  sessionFile: string;
  startDate?: string;
  endDate?: string;
  month?: string;
  allowTokenHostMismatch?: boolean;
}

export async function usageByKey(options: UsageByKeyOptions): Promise<void> {
  const searchParams = new URLSearchParams();
  appendRequiredDateRangeOrMonthParams(searchParams, {
    startDate: options.startDate,
    endDate: options.endDate,
    month: options.month,
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
