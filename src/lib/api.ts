export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function tryParseJson(text: string): unknown {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
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

  const response = await fetch(url, {
    method,
    headers,
    body: payload,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new CliError(`${method} ${url} failed: ${response.status} ${text}`);
  }

  const json = tryParseJson(text);
  if (text && json === undefined) {
    throw new CliError(`${method} ${url} returned invalid JSON: ${text}`);
  }

  return (json ?? {}) as T;
}
