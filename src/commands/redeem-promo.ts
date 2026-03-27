import { normalizeBaseUrl, requestJson } from "../lib/api.js";
import { DEFAULT_SESSION_FILE, loadSession } from "../lib/session.js";

export interface RedeemPromoOptions {
  code: string;
  baseUrl?: string;
  sessionFile: string;
}

export async function redeemPromo(options: RedeemPromoOptions): Promise<void> {
  const session = await loadSession(options.sessionFile || DEFAULT_SESSION_FILE);
  const baseUrl = normalizeBaseUrl(options.baseUrl || session.baseUrl);

  const result = await requestJson<Record<string, unknown>>({
    method: "POST",
    url: `${baseUrl}/api/billing/redeem-promo`,
    token: session.token,
    body: {
      code: options.code.trim(),
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
