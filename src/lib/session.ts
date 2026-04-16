import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

import { CliError } from "./api.js";

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

function isPermissionHardeningSupported(): boolean {
  return process.platform !== "win32";
}

async function hardenSessionPathPermissions(path: string): Promise<void> {
  if (!isPermissionHardeningSupported()) {
    return;
  }

  await chmod(dirname(path), SESSION_DIR_MODE);
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

export async function saveSession(path: string, session: PortalSession): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: SESSION_DIR_MODE });
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
