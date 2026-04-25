import { requestSavedPortalSessionJson } from "../lib/api.js";
import {
  appendPaginationParams,
  parseTransactionFilterType,
} from "../lib/history.js";
import { resolvePortalContext, writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface TransactionsOptions {
  baseUrl?: string;
  sessionFile: string;
  page?: number;
  limit?: number;
  type?: string;
  allowTokenHostMismatch?: boolean;
}

export async function transactions(options: TransactionsOptions): Promise<void> {
  const { baseUrl, token } = await resolvePortalContext({
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    allowTokenHostMismatch: options.allowTokenHostMismatch,
  });

  const searchParams = new URLSearchParams();
  appendPaginationParams(searchParams, {
    page: options.page,
    limit: options.limit,
  });

  if (options.type !== undefined) {
    searchParams.set("type", parseTransactionFilterType(options.type));
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const result = await requestSavedPortalSessionJson<Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/api/billing/transactions${suffix}`,
    token,
  });

  writeJson(result);
}
