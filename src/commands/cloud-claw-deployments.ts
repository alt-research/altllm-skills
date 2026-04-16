import { requestCloudClawJson, writeJson } from "../lib/cloud-claw.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CloudClawDeploymentsOptions {
  baseUrl?: string;
  sessionFile: string;
  includeAll?: boolean;
  includeUserInfo?: boolean;
  forceSso?: boolean;
  allowTokenForwarding?: boolean;
}

export async function cloudClawDeployments(
  options: CloudClawDeploymentsOptions
): Promise<void> {
  const searchParams = new URLSearchParams();
  if (options.includeAll) {
    searchParams.set("includeAll", "true");
  }
  if (options.includeUserInfo) {
    searchParams.set("includeUserInfo", "true");
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "GET",
    path: `/api/vm/deployments${suffix}`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson(result);
}
