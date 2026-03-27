import { normalizeBaseUrl, requestJson } from "../lib/api.js";
import { DEFAULT_SESSION_FILE, loadSession } from "../lib/session.js";

export interface CreditOptions {
  baseUrl?: string;
  sessionFile: string;
}

export async function credit(options: CreditOptions): Promise<void> {
  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  const baseUrl = normalizeBaseUrl(options.baseUrl || session.baseUrl);

  const result = await requestJson<Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/api/billing/balance`,
    token: session.token,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

