import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

import { CliError, normalizeBaseUrl } from "./api.js";

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

export function resolveSessionBackedBaseUrl(params: {
  sessionBaseUrl: string;
  baseUrl?: string;
  allowTokenHostMismatch?: boolean;
}): string {
  const normalizedSessionBaseUrl = normalizeBaseUrl(params.sessionBaseUrl);
  const normalizedBaseUrl = normalizeBaseUrl(
    params.baseUrl || params.sessionBaseUrl
  );

  if (
    normalizedBaseUrl !== normalizedSessionBaseUrl &&
    !params.allowTokenHostMismatch
  ) {
    throw new CliError(
      `Refusing to send the saved Portal session token to non-session base URL ${normalizedBaseUrl}. Session origin is ${normalizedSessionBaseUrl}. Re-run with --allow-token-host-mismatch if you trust this host.`
    );
  }

  return normalizedBaseUrl;
}

export async function saveSession(path: string, session: PortalSession): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(session, null, 2), "utf8");
}

export async function loadSession(path: string): Promise<PortalSession> {
  try {
    const text = await readFile(path, "utf8");
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
