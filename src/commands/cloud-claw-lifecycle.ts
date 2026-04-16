import { requestCloudClawJson, validateDeploymentName, writeJson } from "../lib/cloud-claw.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CloudClawLifecycleOptions {
  name: string;
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
  allowTokenForwarding?: boolean;
}

export interface CloudClawAutoRenewOptions extends CloudClawLifecycleOptions {
  enabled: boolean;
}

async function postLifecycle(
  options: CloudClawLifecycleOptions,
  suffix: string
): Promise<void> {
  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "POST",
    path: `/api/vm/deployments/${validateDeploymentName(options.name)}/${suffix}`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson(result);
}

export async function cloudClawStart(options: CloudClawLifecycleOptions): Promise<void> {
  await postLifecycle(options, "start");
}

export async function cloudClawStop(options: CloudClawLifecycleOptions): Promise<void> {
  await postLifecycle(options, "stop");
}

export async function cloudClawRenew(options: CloudClawLifecycleOptions): Promise<void> {
  await postLifecycle(options, "renew");
}

export async function cloudClawDelete(options: CloudClawLifecycleOptions): Promise<void> {
  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "DELETE",
    path: `/api/vm/deployments/${validateDeploymentName(options.name)}`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson(result);
}

export async function cloudClawRestart(options: CloudClawLifecycleOptions): Promise<void> {
  const name = validateDeploymentName(options.name);
  await requestCloudClawJson<Record<string, unknown>>({
    method: "POST",
    path: `/api/vm/deployments/${name}/stop`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "POST",
    path: `/api/vm/deployments/${name}/start`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson({
    ok: true,
    restarted: true,
    name,
    startResult: result,
  });
}

export async function cloudClawAutoRenew(
  options: CloudClawAutoRenewOptions
): Promise<void> {
  const result = await requestCloudClawJson<Record<string, unknown>>({
    method: "POST",
    path: `/api/vm/deployments/${validateDeploymentName(options.name)}/auto-renew`,
    body: { enabled: options.enabled },
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  writeJson(result);
}
