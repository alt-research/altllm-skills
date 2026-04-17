import { requestCloudClawJson, validateDeploymentName, writeJson } from "../lib/cloud-claw.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CloudClawDeploymentOptions {
  name: string;
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
  allowTokenForwarding?: boolean;
}

export async function cloudClawDeployment(
  options: CloudClawDeploymentOptions
): Promise<void> {
  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "GET",
    path: `/api/vm/deployments/${validateDeploymentName(options.name)}`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson(result);
}
