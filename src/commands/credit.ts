import { normalizeBaseUrl, requestJson } from "../lib/api.js";
import {
  DEFAULT_SESSION_FILE,
  loadSession,
  resolveSessionBackedBaseUrl,
} from "../lib/session.js";

export interface CreditOptions {
  baseUrl?: string;
  sessionFile: string;
  allowTokenHostMismatch?: boolean;
}

export async function credit(options: CreditOptions): Promise<void> {
  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  const baseUrl = normalizeBaseUrl(
    resolveSessionBackedBaseUrl({
      sessionBaseUrl: session.baseUrl,
      baseUrl: options.baseUrl,
      allowTokenHostMismatch: options.allowTokenHostMismatch,
    })
  );

  const result = await requestJson<Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/api/billing/balance`,
    token: session.token,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
