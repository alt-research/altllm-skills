import { requestJson } from "../lib/api.js";
import { appendDateRangeParams } from "../lib/history.js";
import { resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface UsageTimelineOptions {
  baseUrl?: string;
  sessionFile: string;
  startDate?: string;
  endDate?: string;
  month?: string;
}

export async function usageTimeline(options: UsageTimelineOptions): Promise<void> {
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
  });

  const searchParams = new URLSearchParams();
  appendDateRangeParams(searchParams, {
    startDate: options.startDate,
    endDate: options.endDate,
    month: options.month,
  });

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const result = await requestJson<Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/api/usage/timeline${suffix}`,
    token,
  });

  writeJson(result);
}
