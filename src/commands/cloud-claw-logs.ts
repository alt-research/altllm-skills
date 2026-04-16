import { CliError, normalizeBaseUrl } from "../lib/api.js";
import { DEFAULT_CLOUD_CLAW_BASE_URL, getCloudClawJwt, validateDeploymentName } from "../lib/cloud-claw.js";
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
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/vm/deployments/${name}/logs`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new CliError(`GET ${baseUrl}/api/vm/deployments/${name}/logs failed: ${response.status} ${text}`);
    }
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
    return;
  }

  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/vm/deployments/${name}/logs/stream?auth=${encodeURIComponent(jwt)}`,
    { headers: { Accept: "text/event-stream" } }
  );

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new CliError(
      `GET ${baseUrl}/api/vm/deployments/${name}/logs/stream failed: ${response.status} ${text}`
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
