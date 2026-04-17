export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function parseBaseUrl(baseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new CliError(`Invalid base URL: ${baseUrl}`);
  }

  return parsed;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalizedHostname)
  );
}

export function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  parseBaseUrl(normalized);
  return normalized;
}

export function requireSecureNonLocalBaseUrl(
  baseUrl: string,
  credentialDescription: string
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  const parsed = parseBaseUrl(normalized);
  const protocol = parsed.protocol.toLowerCase();
  const isLoopbackHost = isLoopbackHostname(parsed.hostname);

  if (protocol === "https:") {
    return normalized;
  }

  if (protocol === "http:" && isLoopbackHost) {
    return normalized;
  }

  throw new CliError(
    `Refusing to send ${credentialDescription} to insecure non-local base URL ${normalized}. Use https:// for non-local targets.`
  );
}

export function canonicalizeOrigin(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(normalizeBaseUrl(baseUrl));
  } catch {
    throw new CliError(`Invalid base URL: ${baseUrl}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const defaultPort =
    protocol === "https:" ? "443" : protocol === "http:" ? "80" : "";
  const portSuffix =
    parsed.port && parsed.port !== defaultPort ? `:${parsed.port}` : "";

  return `${protocol}//${hostname}${portSuffix}`;
}

function resolveRequestTimeoutMs(): number {
  const raw = process.env.ALTLLM_HTTP_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError("ALTLLM_HTTP_TIMEOUT_MS must be a positive number of milliseconds.");
  }

  return parsed;
}

export async function fetchWithTimeout(params: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<Response> {
  const timeoutMs = params.timeoutMs ?? resolveRequestTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError"
    ) {
      throw new CliError(
        `${params.method} ${params.url} timed out after ${timeoutMs}ms.`
      );
    }

    const detail =
      error instanceof Error && error.message ? error.message : String(error);
    throw new CliError(`${params.method} ${params.url} failed: ${detail}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function requestJson<T>({
  method,
  url,
  body,
  token,
}: {
  method: string;
  url: string;
  body?: unknown;
  token?: string;
}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout({
    method,
    url,
    headers,
    body: payload,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new CliError(`${method} ${url} failed: ${response.status} ${text}`);
  }

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CliError(`${method} ${url} returned invalid JSON: ${text}`);
  }
}
