export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
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

  const response = await fetch(url, {
    method,
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
