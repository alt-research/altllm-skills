#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const DEFAULT_MODEL = "altllm-native-fast";
const DEFAULT_PROMPT =
  "Reply with exactly the lowercase word ok. Do not include punctuation.";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const options = {
    model: DEFAULT_MODEL,
    prompt: DEFAULT_PROMPT,
    maxTokens: 8,
    temperature: 0,
    requestTimeoutSeconds: 120,
    pollAttempts: 18,
    pollIntervalSeconds: 5,
    startDate: yesterdayUtc(),
    endDate: todayUtc(),
    minBalanceUsd: 0.001,
    maxBalanceDeltaUsd: 0.05,
    restrictKeyToModel: true,
    portalTokenMode: "cookie",
    keepKey: false,
    allowNonStaging: false,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--base-url") {
      options.baseUrl = next();
    } else if (arg === "--gateway-url") {
      options.gatewayUrl = next();
    } else if (arg === "--session-file") {
      options.sessionFile = next();
    } else if (arg === "--portal-token-env") {
      options.portalTokenEnv = next();
    } else if (arg === "--portal-token-mode") {
      const value = next();
      if (!["bearer", "cookie"].includes(value)) {
        throw new Error("--portal-token-mode must be bearer or cookie");
      }
      options.portalTokenMode = value;
    } else if (arg === "--model") {
      options.model = next();
    } else if (arg === "--prompt") {
      options.prompt = next();
    } else if (arg === "--max-tokens") {
      const value = Number(next());
      if (!Number.isInteger(value) || value <= 0 || value > 512) {
        throw new Error("--max-tokens must be an integer between 1 and 512");
      }
      options.maxTokens = value;
    } else if (arg === "--temperature") {
      const value = Number(next());
      if (!Number.isFinite(value) || value < 0 || value > 2) {
        throw new Error("--temperature must be a number between 0 and 2");
      }
      options.temperature = value;
    } else if (arg === "--request-timeout") {
      const value = Number(next());
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--request-timeout must be a positive number of seconds");
      }
      options.requestTimeoutSeconds = value;
    } else if (arg === "--poll-attempts") {
      const value = Number(next());
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--poll-attempts must be a positive integer");
      }
      options.pollAttempts = value;
    } else if (arg === "--poll-interval") {
      const value = Number(next());
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--poll-interval must be a non-negative number of seconds");
      }
      options.pollIntervalSeconds = value;
    } else if (arg === "--start-date") {
      options.startDate = next();
    } else if (arg === "--end-date") {
      options.endDate = next();
    } else if (arg === "--min-balance-usd") {
      const value = Number(next());
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--min-balance-usd must be a non-negative number");
      }
      options.minBalanceUsd = value;
    } else if (arg === "--max-balance-delta-usd") {
      const value = Number(next());
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--max-balance-delta-usd must be a positive number");
      }
      options.maxBalanceDeltaUsd = value;
    } else if (arg === "--no-key-model-restriction") {
      options.restrictKeyToModel = false;
    } else if (arg === "--keep-key") {
      options.keepKey = true;
    } else if (arg === "--allow-non-staging") {
      options.allowNonStaging = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`Usage: node scripts/run-model-billing-e2e.mjs --base-url <url> --gateway-url <url> (--session-file <path> | --portal-token-env <name>) [options]

Runs a controlled model usage and billing E2E against Portal plus the OpenAI-compatible gateway.

Required:
  --base-url <url>                Portal API base URL
  --gateway-url <url>             Gateway base URL, with or without /v1
  --session-file <path>           Saved Portal CLI session file
  --portal-token-env <name>       Environment variable containing a Portal token or cookie header

Auth options:
  --portal-token-mode <mode>      bearer or cookie for --portal-token-env (default: cookie)

Model request options:
  --model <id>                    Model ID to call (default: ${DEFAULT_MODEL})
  --prompt <text>                 Prompt for the tiny request
  --max-tokens <n>                Output token cap, 1-512 (default: 8)
  --temperature <n>               Sampling temperature, 0-2 (default: 0)
  --no-key-model-restriction      Do not restrict the temporary API key to --model

Safety and polling options:
  --min-balance-usd <n>           Abort if Portal balance is below this (default: 0.001)
  --max-balance-delta-usd <n>     Fail if observed balance drop exceeds this cap (default: 0.05)
  --request-timeout <seconds>     Timeout for Portal and gateway calls (default: 120)
  --poll-attempts <n>             Usage/billing polling attempts (default: 18)
  --poll-interval <seconds>       Delay between polling attempts (default: 5)
  --start-date <yyyy-mm-dd>       Usage window start (default: yesterday UTC)
  --end-date <yyyy-mm-dd>         Usage window end (default: today UTC)
  --keep-key                      Leave the temporary API key active for debugging
  --allow-non-staging             Allow non-staging, non-local URLs
  --verbose                       Include compact before/after snapshots
  -h, --help                      Show help

By default this refuses production-looking URLs, creates one temporary API key,
makes one small chat completion request, polls Portal usage/billing endpoints,
and revokes the temporary key. It redacts session tokens and API keys.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.baseUrl) {
    throw new Error("--base-url is required");
  }
  if (!options.gatewayUrl) {
    throw new Error("--gateway-url is required");
  }
  if (Boolean(options.sessionFile) === Boolean(options.portalTokenEnv)) {
    throw new Error("Provide exactly one of --session-file or --portal-token-env");
  }

  return options;
}

function normalizeBaseUrl(value) {
  const normalized = String(value).replace(/\/+$/, "");
  new URL(normalized);
  return normalized;
}

function gatewayChatCompletionsUrl(value) {
  const normalized = normalizeBaseUrl(value);
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function isLocalOrStagingUrl(value) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname.endsWith(".alt.technology")
  );
}

function redact(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._:-]+/g, "Bearer <redacted>")
    .replace(/portal_token=[^;\s]+/g, "portal_token=<redacted>")
    .replace(/token=[^;\s]+/g, "token=<redacted>")
    .replace(/eyJ[A-Za-z0-9._-]+/g, "<jwt-redacted>")
    .replace(/sk-[A-Za-z0-9._-]+/g, "sk-REDACTED")
    .slice(0, 600);
}

async function fetchWithTimeout(url, init, timeoutSeconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      text,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${init.method || "GET"} ${url} timed out after ${timeoutSeconds}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson(params) {
  const headers = {
    Accept: "application/json",
    ...params.authHeaders,
    ...(params.headers || {}),
  };
  let body;
  if (params.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(params.body);
  }

  const result = await fetchWithTimeout(
    params.url,
    {
      method: params.method,
      headers,
      body,
    },
    params.timeoutSeconds
  );
  if (!result.ok) {
    throw new Error(
      `${params.method} ${params.url} failed: ${result.status} ${redact(result.text)}`
    );
  }
  return result;
}

async function resolveAuth(options) {
  if (options.sessionFile) {
    const session = JSON.parse(await readFile(options.sessionFile, "utf8"));
    if (!session.token) {
      throw new Error(`Session file does not contain a token: ${options.sessionFile}`);
    }
    return {
      description: "session-file",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      user: session.user
        ? {
            id: session.user.id ?? null,
            email: session.user.email ?? null,
          }
        : null,
    };
  }

  const raw = process.env[options.portalTokenEnv]?.trim();
  if (!raw) {
    throw new Error(`Environment variable ${options.portalTokenEnv} is not set`);
  }
  if (options.portalTokenMode === "bearer") {
    return {
      description: `env:${options.portalTokenEnv}:bearer`,
      headers: {
        Authorization: `Bearer ${raw}`,
      },
      user: null,
    };
  }

  return {
    description: `env:${options.portalTokenEnv}:cookie`,
    headers: {
      Cookie: raw.includes("=") || raw.includes(";") ? raw : `portal_token=${raw}`,
    },
    user: null,
  };
}

function numberFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function flattenRecords(value, records = []) {
  if (!value || typeof value !== "object") return records;
  if (Array.isArray(value)) {
    for (const item of value) flattenRecords(item, records);
    return records;
  }
  records.push(value);
  for (const item of Object.values(value)) {
    if (item && typeof item === "object") flattenRecords(item, records);
  }
  return records;
}

function getFirstNumber(record, names) {
  for (const name of names) {
    const value = numberFrom(record[name]);
    if (value !== null) return value;
  }
  return null;
}

function valueText(record) {
  return Object.values(record)
    .filter((value) => ["string", "number"].includes(typeof value))
    .map((value) => String(value).toLowerCase())
    .join(" ");
}

function recordMatchesNeedle(record, needle) {
  if (!needle) return false;
  const normalizedNeedle = String(needle).toLowerCase();
  return Object.values(record).some((value) => {
    if (typeof value !== "string" && typeof value !== "number") return false;
    const normalizedValue = String(value).toLowerCase();
    return normalizedValue === normalizedNeedle || normalizedValue.includes(normalizedNeedle);
  });
}

function sumUsageForNeedle(payload, needle) {
  const records = flattenRecords(payload);
  const matched = records.filter((record) => recordMatchesNeedle(record, needle));
  let requests = 0;
  let tokens = 0;
  let cost = 0;
  for (const record of matched) {
    requests +=
      getFirstNumber(record, [
        "requests",
        "request_count",
        "total_requests",
        "count",
        "num_requests",
      ]) ?? 0;
    tokens +=
      getFirstNumber(record, [
        "tokens",
        "total_tokens",
        "token_count",
        "input_tokens",
        "output_tokens",
      ]) ?? 0;
    cost +=
      getFirstNumber(record, [
        "cost",
        "total_cost",
        "spend",
        "total_spend",
        "amount",
        "charged_amount",
      ]) ?? 0;
  }
  return {
    seen: matched.length > 0,
    records: matched.length,
    requests,
    tokens,
    cost,
  };
}

function extractBalance(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    numberFrom(payload.balance) ??
    numberFrom(payload.credit_balance) ??
    numberFrom(payload.available_balance) ??
    null
  );
}

function extractSummary(payload) {
  if (!payload || typeof payload !== "object") {
    return { requests: null, tokens: null, spend: null };
  }
  return {
    requests:
      numberFrom(payload.total_requests) ??
      numberFrom(payload.requests) ??
      numberFrom(payload.request_count),
    tokens:
      numberFrom(payload.total_tokens) ??
      numberFrom(payload.tokens) ??
      numberFrom(payload.token_count),
    spend:
      numberFrom(payload.total_spend) ??
      numberFrom(payload.spend) ??
      numberFrom(payload.total_cost) ??
      numberFrom(payload.cost),
  };
}

function extractKeyId(payload) {
  return payload?.id ?? payload?.key_id ?? payload?.api_key_id ?? payload?.key?.id ?? null;
}

function extractKeySecret(payload) {
  return payload?.key ?? payload?.api_key ?? payload?.secret ?? payload?.key?.key ?? null;
}

function extractKeyPrefix(payload) {
  return payload?.key_prefix ?? payload?.prefix ?? payload?.key?.key_prefix ?? null;
}

function compactBalance(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    balance: payload.balance ?? null,
    currency: payload.currency ?? null,
    subscription_tier: payload.subscription_tier ?? null,
    budget: payload.budget ?? null,
    budget_used_percent: payload.budget_used_percent ?? null,
    allowed_models_count: Array.isArray(payload.allowed_models) ? payload.allowed_models.length : null,
  };
}

function compactUsageByNeedle(payload, needle) {
  return sumUsageForNeedle(payload, needle);
}

function compactTransactions(payload) {
  const records = flattenRecords(payload).filter((record) =>
    valueText(record).includes("usage")
  );
  return {
    usage_records: records.length,
    latest_usage: records.slice(0, 3).map((record) => ({
      id: record.id ?? record.transaction_id ?? null,
      type: record.type ?? record.transaction_type ?? null,
      amount: record.amount ?? record.cost ?? record.total_cost ?? null,
      created_at: record.created_at ?? record.createdAt ?? null,
      model: record.model ?? record.model_id ?? null,
    })),
  };
}

async function getSnapshots(params) {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  }).toString();
  const [balance, summary, byModel, byKey, transactions] = await Promise.all([
    requestJson({
      method: "GET",
      url: `${params.baseUrl}/api/billing/balance`,
      authHeaders: params.auth.headers,
      timeoutSeconds: params.requestTimeoutSeconds,
    }),
    requestJson({
      method: "GET",
      url: `${params.baseUrl}/api/usage/summary`,
      authHeaders: params.auth.headers,
      timeoutSeconds: params.requestTimeoutSeconds,
    }),
    requestJson({
      method: "GET",
      url: `${params.baseUrl}/api/usage/by-model?${query}`,
      authHeaders: params.auth.headers,
      timeoutSeconds: params.requestTimeoutSeconds,
    }),
    requestJson({
      method: "GET",
      url: `${params.baseUrl}/api/usage/by-key?${query}`,
      authHeaders: params.auth.headers,
      timeoutSeconds: params.requestTimeoutSeconds,
    }),
    requestJson({
      method: "GET",
      url: `${params.baseUrl}/api/billing/transactions?type=usage&limit=20`,
      authHeaders: params.auth.headers,
      timeoutSeconds: params.requestTimeoutSeconds,
    }),
  ]);

  return {
    balance: balance.body,
    summary: summary.body,
    byModel: byModel.body,
    byKey: byKey.body,
    transactions: transactions.body,
  };
}

function evaluateEvidence(before, after, params, key) {
  const beforeBalance = extractBalance(before.balance);
  const afterBalance = extractBalance(after.balance);
  const balanceDeltaUsd =
    beforeBalance !== null && afterBalance !== null ? afterBalance - beforeBalance : null;

  const beforeSummary = extractSummary(before.summary);
  const afterSummary = extractSummary(after.summary);
  const summaryRequestDelta =
    beforeSummary.requests !== null && afterSummary.requests !== null
      ? afterSummary.requests - beforeSummary.requests
      : null;
  const summaryTokenDelta =
    beforeSummary.tokens !== null && afterSummary.tokens !== null
      ? afterSummary.tokens - beforeSummary.tokens
      : null;
  const summarySpendDeltaUsd =
    beforeSummary.spend !== null && afterSummary.spend !== null
      ? afterSummary.spend - beforeSummary.spend
      : null;

  const modelBefore = sumUsageForNeedle(before.byModel, params.model);
  const modelAfter = sumUsageForNeedle(after.byModel, params.model);
  const modelUsageSeen =
    modelAfter.seen &&
    (modelAfter.requests > modelBefore.requests ||
      modelAfter.tokens > modelBefore.tokens ||
      modelAfter.cost > modelBefore.cost ||
      modelAfter.records > modelBefore.records);

  const keyNeedles = [key.id, key.name, key.prefix].filter(Boolean);
  const keyBefore = keyNeedles.map((needle) => sumUsageForNeedle(before.byKey, needle));
  const keyAfter = keyNeedles.map((needle) => sumUsageForNeedle(after.byKey, needle));
  const keyUsageSeen = keyAfter.some((afterUsage, index) => {
    const beforeUsage = keyBefore[index];
    return (
      afterUsage.seen &&
      (afterUsage.requests > beforeUsage.requests ||
        afterUsage.tokens > beforeUsage.tokens ||
        afterUsage.cost > beforeUsage.cost ||
        afterUsage.records > beforeUsage.records)
    );
  });

  const billingEvidenceSeen =
    (balanceDeltaUsd !== null && balanceDeltaUsd < 0) ||
    (summarySpendDeltaUsd !== null && summarySpendDeltaUsd > 0) ||
    keyAfter.some((usage, index) => usage.cost > keyBefore[index].cost) ||
    modelAfter.cost > modelBefore.cost ||
    compactTransactions(after.transactions).usage_records >
      compactTransactions(before.transactions).usage_records;

  const failures = [];
  if (!keyUsageSeen) {
    failures.push("Portal usage-by-key did not show the temporary API key yet.");
  }
  if (!modelUsageSeen) {
    failures.push(`Portal usage-by-model did not show new usage for ${params.model} yet.`);
  }
  if (!billingEvidenceSeen) {
    failures.push("Portal billing evidence did not show a balance, spend, cost, or usage-transaction change yet.");
  }
  if (
    balanceDeltaUsd !== null &&
    balanceDeltaUsd < -Math.abs(params.maxBalanceDeltaUsd)
  ) {
    failures.push(
      `Observed balance delta ${balanceDeltaUsd.toFixed(6)} exceeded --max-balance-delta-usd ${params.maxBalanceDeltaUsd}.`
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    balanceDeltaUsd,
    summaryRequestDelta,
    summaryTokenDelta,
    summarySpendDeltaUsd,
    keyUsageSeen,
    modelUsageSeen,
    billingEvidenceSeen,
    modelUsage: {
      before: modelBefore,
      after: modelAfter,
    },
    keyUsage: keyNeedles.map((needle, index) => ({
      needle:
        needle === key.id ? "id" : needle === key.prefix ? "prefix" : "name",
      before: keyBefore[index],
      after: keyAfter[index],
    })),
    transactions: {
      before: compactTransactions(before.transactions),
      after: compactTransactions(after.transactions),
    },
  };
}

async function createApiKey(params) {
  const name = `model-billing-e2e-${Date.now()}`;
  const body = {
    name,
  };
  if (params.restrictKeyToModel) {
    body.permissions = {
      models: [params.model],
    };
  }
  const response = await requestJson({
    method: "POST",
    url: `${params.baseUrl}/api/keys`,
    authHeaders: params.auth.headers,
    body,
    timeoutSeconds: params.requestTimeoutSeconds,
  });
  const key = {
    id: extractKeyId(response.body),
    secret: extractKeySecret(response.body),
    prefix: extractKeyPrefix(response.body),
    name,
  };
  if (!key.id || !key.secret) {
    throw new Error("Portal did not return an API key id and secret.");
  }
  return key;
}

async function revokeApiKey(params, keyId) {
  const response = await requestJson({
    method: "DELETE",
    url: `${params.baseUrl}/api/keys/${encodeURIComponent(keyId)}`,
    authHeaders: params.auth.headers,
    timeoutSeconds: params.requestTimeoutSeconds,
  });
  return response.body;
}

async function callGateway(params, apiKey) {
  const url = gatewayChatCompletionsUrl(params.gatewayUrl);
  const response = await requestJson({
    method: "POST",
    url,
    authHeaders: {
      Authorization: `Bearer ${apiKey}`,
    },
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      model: params.model,
      messages: [
        {
          role: "user",
          content: params.prompt,
        },
      ],
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    },
    timeoutSeconds: params.requestTimeoutSeconds,
  });
  const body = response.body;
  const choices = Array.isArray(body?.choices) ? body.choices : [];
  if (choices.length === 0) {
    throw new Error("Gateway response did not include choices.");
  }
  return {
    status: response.status,
    durationMs: response.durationMs,
    id: body?.id ?? null,
    model: body?.model ?? null,
    usage: body?.usage ?? null,
    choiceCount: choices.length,
    finishReason: choices[0]?.finish_reason ?? null,
    contentPreview: String(choices[0]?.message?.content ?? choices[0]?.text ?? "")
      .replace(/\s+/g, " ")
      .slice(0, 80),
  };
}

function compactSnapshots(snapshot, params, key) {
  return {
    balance: compactBalance(snapshot.balance),
    summary: extractSummary(snapshot.summary),
    byModel: compactUsageByNeedle(snapshot.byModel, params.model),
    byKey: {
      id: key?.id ? compactUsageByNeedle(snapshot.byKey, key.id) : null,
      prefix: key?.prefix ? compactUsageByNeedle(snapshot.byKey, key.prefix) : null,
      name: key?.name ? compactUsageByNeedle(snapshot.byKey, key.name) : null,
    },
    transactions: compactTransactions(snapshot.transactions),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const params = {
    ...options,
    baseUrl: normalizeBaseUrl(options.baseUrl),
    gatewayUrl: normalizeBaseUrl(options.gatewayUrl),
  };

  if (
    !params.allowNonStaging &&
    (!isLocalOrStagingUrl(params.baseUrl) || !isLocalOrStagingUrl(params.gatewayUrl))
  ) {
    throw new Error(
      "Refusing non-staging URLs without --allow-non-staging. Use staging or localhost by default."
    );
  }

  params.auth = await resolveAuth(params);
  const before = await getSnapshots(params);
  const beforeBalance = extractBalance(before.balance);
  if (beforeBalance !== null && beforeBalance < params.minBalanceUsd) {
    throw new Error(
      `Portal balance ${beforeBalance.toFixed(6)} is below --min-balance-usd ${params.minBalanceUsd}.`
    );
  }

  let key = null;
  let gateway = null;
  let revoke = {
    attempted: false,
    ok: false,
    error: null,
  };
  let finalSnapshot = before;
  let evidence = null;

  try {
    key = await createApiKey(params);
    gateway = await callGateway(params, key.secret);

    for (let attempt = 1; attempt <= params.pollAttempts; attempt += 1) {
      if (attempt > 1 && params.pollIntervalSeconds > 0) {
        await sleep(params.pollIntervalSeconds * 1000);
      }
      finalSnapshot = await getSnapshots(params);
      evidence = evaluateEvidence(before, finalSnapshot, params, key);
      evidence.attempts = attempt;
      if (evidence.ok) break;
    }
  } finally {
    if (key && !params.keepKey) {
      revoke.attempted = true;
      try {
        await revokeApiKey(params, key.id);
        revoke.ok = true;
      } catch (error) {
        revoke.error = redact(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const report = {
    ok: Boolean(evidence?.ok) && (params.keepKey || revoke.ok),
    baseUrl: params.baseUrl,
    gatewayUrl: params.gatewayUrl,
    auth: {
      source: params.auth.description,
      user: params.auth.user,
    },
    window: {
      startDate: params.startDate,
      endDate: params.endDate,
    },
    model: params.model,
    request: gateway,
    apiKey: key
      ? {
          id: key.id,
          prefix: key.prefix,
          name: key.name,
          kept: params.keepKey,
          revoked: revoke,
        }
      : null,
    checks: evidence,
    failures: [
      ...(evidence?.failures ?? ["E2E did not reach evidence evaluation."]),
      ...(revoke.attempted && !revoke.ok ? [`Failed to revoke temporary API key: ${revoke.error}`] : []),
    ],
  };

  if (params.verbose) {
    report.snapshots = {
      before: compactSnapshots(before, params, key),
      after: compactSnapshots(finalSnapshot, params, key),
    };
  }

  if (report.ok) {
    report.failures = [];
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${redact(message)}\n`);
  process.exit(1);
});
