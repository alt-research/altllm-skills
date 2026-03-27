import {
  DEFAULT_SESSION_FILE,
  deleteSession,
  loadSession,
  type PortalSession,
} from "../lib/session.js";

export interface LogoutOptions {
  sessionFile: string;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function logout(options: LogoutOptions): Promise<void> {
  const sessionFile = options.sessionFile || DEFAULT_SESSION_FILE;

  let session: PortalSession | null = null;
  try {
    session = await loadSession(sessionFile);
  } catch {
    session = null;
  }

  const removed = await deleteSession(sessionFile);

  writeJson({
    ok: true,
    loggedOut: removed,
    sessionFile,
    user: session?.user ?? null,
    baseUrl: session?.baseUrl ?? null,
    message: removed
      ? "Local Portal session removed."
      : "No local Portal session file was present.",
  });
}
