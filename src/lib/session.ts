import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

import {
  canonicalizeOrigin,
  CliError,
  normalizeBaseUrl,
  requireSecureNonLocalBaseUrl,
} from "./api.js";

export interface PortalSession {
  baseUrl: string;
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export const DEFAULT_SESSION_FILE = `${homedir()}/.altllm/portal-cli-session.json`;
const SESSION_DIR_MODE = 0o700;
const SESSION_FILE_MODE = 0o600;
const DEFAULT_SESSION_DIRECTORY = dirname(DEFAULT_SESSION_FILE);

function isPermissionHardeningSupported(): boolean {
  return process.platform !== "win32";
}

async function hardenSessionPathPermissions(path: string): Promise<void> {
  if (!isPermissionHardeningSupported()) {
    return;
  }

  if (resolve(dirname(path)) === resolve(DEFAULT_SESSION_DIRECTORY)) {
    await chmod(dirname(path), SESSION_DIR_MODE);
  }
  await chmod(path, SESSION_FILE_MODE);
}

async function tryHardenSessionPathPermissions(path: string): Promise<void> {
  try {
    await hardenSessionPathPermissions(path);
  } catch {
    // Best-effort on load: do not make a valid readable session unusable just
    // because the host filesystem rejects chmod.
  }
}

export function resolveSessionBackedBaseUrl(params: {
  sessionBaseUrl: string;
  baseUrl?: string;
  allowTokenHostMismatch?: boolean;
}): string {
  const normalizedSessionBaseUrl = normalizeBaseUrl(params.sessionBaseUrl);
  const normalizedBaseUrl = normalizeBaseUrl(
    params.baseUrl || params.sessionBaseUrl
  );
  requireSecureNonLocalBaseUrl(
    normalizedBaseUrl,
    "the saved Portal session token"
  );
  const canonicalSessionOrigin = canonicalizeOrigin(normalizedSessionBaseUrl);
  const canonicalRequestedOrigin = canonicalizeOrigin(normalizedBaseUrl);

  if (
    canonicalRequestedOrigin !== canonicalSessionOrigin &&
    !params.allowTokenHostMismatch
  ) {
    throw new CliError(
      `Refusing to send the saved Portal session token to non-session base URL ${normalizedBaseUrl}. Session origin is ${normalizedSessionBaseUrl}. Re-run with --allow-token-host-mismatch if you trust this host.`
    );
  }

  return normalizedBaseUrl;
}

export async function saveSession(path: string, session: PortalSession): Promise<void> {
  const sessionDirectory = dirname(path);
  const mkdirOptions =
    resolve(sessionDirectory) === resolve(DEFAULT_SESSION_DIRECTORY)
      ? { recursive: true, mode: SESSION_DIR_MODE }
      : { recursive: true };

  await mkdir(sessionDirectory, mkdirOptions);
  await writeFile(path, JSON.stringify(session, null, 2), {
    encoding: "utf8",
    mode: SESSION_FILE_MODE,
  });
  await hardenSessionPathPermissions(path);
}

export async function loadSession(path: string): Promise<PortalSession> {
  try {
    const text = await readFile(path, "utf8");
    await tryHardenSessionPathPermissions(path);
    return JSON.parse(text) as PortalSession;
  } catch (error) {
    throw new CliError(`Session file not found or invalid: ${path}. Run login-wallet first.`);
  }
}

export async function deleteSession(path: string): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "";

    if (code === "ENOENT") {
      return false;
    }

    throw new CliError(`Failed to delete session file: ${path}`);
  }
}
