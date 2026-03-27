import { requestCloudClawJson, writeJson } from "../lib/cloud-claw.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CloudClawMeOptions {
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
}

export async function cloudClawMe(options: CloudClawMeOptions): Promise<void> {
  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "GET",
    path: "/api/auth/me",
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
  });

  writeJson(result);
}
