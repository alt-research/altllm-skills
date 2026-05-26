import {
  canonicalizeOrigin,
  normalizeBaseUrl,
  requireSecureNonLocalBaseUrl,
} from "../lib/api.js";
import { writeJson } from "../lib/keys.js";
import { DEFAULT_SESSION_FILE, loadSession } from "../lib/session.js";

export interface StatusOptions {
  baseUrl?: string;
  sessionFile: string;
  allowTokenHostMismatch?: boolean;
}

export async function status(options: StatusOptions): Promise<void> {
  const sessionFile = options.sessionFile || DEFAULT_SESSION_FILE;
  const session = await loadSession(sessionFile);
  const sessionBaseUrl = normalizeBaseUrl(session.baseUrl);
  const targetBaseUrl = normalizeBaseUrl(options.baseUrl || session.baseUrl);
  const sessionOrigin = canonicalizeOrigin(sessionBaseUrl);
  const targetOrigin = canonicalizeOrigin(targetBaseUrl);
  const targetMatchesSession = targetOrigin === sessionOrigin;
  let secureForSessionToken = true;
  let tokenForwardingError: string | null = null;

  try {
    requireSecureNonLocalBaseUrl(targetBaseUrl, "the saved Portal session token");
  } catch (error) {
    secureForSessionToken = false;
    tokenForwardingError =
      error instanceof Error && error.message ? error.message : String(error);
  }

  writeJson({
    ok: true,
    authenticated: true,
    sessionFile,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    },
    session: {
      baseUrl: sessionBaseUrl,
      origin: sessionOrigin,
    },
    target: {
      baseUrl: targetBaseUrl,
      origin: targetOrigin,
      matchesSession: targetMatchesSession,
      secureForSessionToken,
      tokenHostMismatchAllowed: Boolean(options.allowTokenHostMismatch),
      tokenForwardingAllowed:
        secureForSessionToken &&
        (targetMatchesSession || Boolean(options.allowTokenHostMismatch)),
      tokenForwardingError,
    },
  });
}
