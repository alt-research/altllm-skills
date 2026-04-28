import { CliError, fetchWithTimeout, normalizeBaseUrl } from "../lib/api.js";
import {
  DEFAULT_CLOUD_CLAW_BASE_URL,
  formatCloudClawHttpError,
  getCloudClawJwt,
  validateDeploymentName,
} from "../lib/cloud-claw.js";
import { DEFAULT_SESSION_FILE } from "../lib/session.js";

export interface CloudClawLogsOptions {
  name: string;
  baseUrl?: string;
  sessionFile: string;
  forceSso?: boolean;
  allowTokenForwarding?: boolean;
  stream?: boolean;
}

export async function cloudClawLogs(options: CloudClawLogsOptions): Promise<void> {
  const name = validateDeploymentName(options.name);
  const { baseUrl, jwt } = await getCloudClawJwt({
    baseUrl: options.baseUrl || DEFAULT_CLOUD_CLAW_BASE_URL,
    sessionFile: options.sessionFile || DEFAULT_SESSION_FILE,
    force: options.forceSso,
    allowTokenForwarding: options.allowTokenForwarding,
  });

  if (!options.stream) {
    const url = `${normalizeBaseUrl(baseUrl)}/api/vm/deployments/${name}/logs`;
    const response = await fetchWithTimeout({
      method: "GET",
      url,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new CliError(
        formatCloudClawHttpError({
          surface: "logs",
          method: "GET",
          url,
          status: response.status,
          text,
          operation: `GET /api/vm/deployments/${name}/logs`,
        })
      );
    }
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
    return;
  }

  const streamDisplayUrl = `${normalizeBaseUrl(
    baseUrl
  )}/api/vm/deployments/${name}/logs/stream`;
  const streamUrl = new URL(streamDisplayUrl);
  streamUrl.searchParams.set("auth", jwt);
  const response = await fetch(streamUrl.toString(), {
    headers: {
      Accept: "text/event-stream",
    },
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new CliError(
      formatCloudClawHttpError({
        surface: "log-stream",
        method: "GET",
        url: streamDisplayUrl,
        status: response.status,
        text,
        operation: `GET /api/vm/deployments/${name}/logs/stream`,
      })
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    process.stdout.write(decoder.decode(value, { stream: true }));
  }
}
