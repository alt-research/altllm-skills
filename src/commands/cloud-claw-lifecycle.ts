import { CliError } from "../lib/api.js";
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

interface CloudClawDeploymentSnapshot {
  status?: string;
}

interface CloudClawDeploymentResponse {
  deployment?: CloudClawDeploymentSnapshot;
}

const RESTART_READY_STATUSES = new Set(["stopped", "terminated", "suspended"]);
const RESTART_POLL_INTERVAL_MS = 2_000;
const RESTART_STOP_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchDeploymentStatus(
  options: CloudClawLifecycleOptions,
  name: string
): Promise<string> {
  const result = await requestCloudClawJson<CloudClawDeploymentResponse>({
    method: "GET",
    path: `/api/vm/deployments/${name}`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  const status = result.deployment?.status?.trim().toLowerCase();
  if (!status) {
    throw new CliError(`Cloud Claw deployment status missing for ${name}.`);
  }

  return status;
}

async function waitForRestartReady(
  options: CloudClawLifecycleOptions,
  name: string
): Promise<string> {
  const startedAt = Date.now();
  let lastStatus = "";

  while (true) {
    lastStatus = await fetchDeploymentStatus(options, name);
    if (RESTART_READY_STATUSES.has(lastStatus)) {
      return lastStatus;
    }

    if (Date.now() - startedAt >= RESTART_STOP_TIMEOUT_MS) {
      throw new CliError(
        `Timed out waiting for Cloud Claw deployment ${name} to stop before restart. Last observed status: ${lastStatus}.`
      );
    }

    await sleep(RESTART_POLL_INTERVAL_MS);
  }
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
  const stopResult = await requestCloudClawJson<Record<string, unknown>>({
    method: "POST",
    path: `/api/vm/deployments/${name}/stop`,
    baseUrl: options.baseUrl,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    forceSso: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  const restartReadyStatus = await waitForRestartReady(options, name);

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
    stopResult,
    restartReadyStatus,
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
