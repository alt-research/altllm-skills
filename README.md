# AltLLM CLI

TypeScript CLI and repo-local agent skills for AltLLM Portal operations.

If you want a task-oriented guide for what an agent can do with these skills, start with [GUIDE.md](./GUIDE.md).

## Introduction

**AltLLM** is a platform that gives users a managed way to access AltLLM models and infrastructure. In practice, the platform has two main surfaces:

- the **Portal API**, which handles user auth, wallet login, API keys, credit balance, billing history, promo redemption, and crypto payment links
- the **OpenAI-compatible gateway**, which is where generated API keys are used to call AltLLM models

This repository is the **TypeScript CLI for the Portal side** of that platform. It is meant for operational tasks such as:

- logging in with a wallet
- creating and managing Portal-issued API keys
- checking balance, transactions, and usage history
- creating and settling crypto top-up payments

This repository also includes **repo-local skills** for coding agents. Those skills are not runtime dependencies of AltLLM itself. They are structured guidance files that help agents choose the right commands, follow the right workflow, and avoid mixing up Portal operations with gateway usage.

It also hosts repo-local skills and local CLI wrappers for related AltLLM-operated surfaces such as **Cloud Claw / AltClaw**. The source implementation still lives in sibling repositories, but the operational workflow is discoverable and scriptable here.

Current commands:

- `altllm login-wallet`
- `altllm logout`
- `altllm credit`
- `altllm transactions`
- `altllm usage-summary`
- `altllm usage-timeline`
- `altllm usage-by-model`
- `altllm usage-by-key`
- `altllm list-api-keys`
- `altllm create-api-key`
- `altllm get-api-key`
- `altllm update-api-key`
- `altllm revoke-api-key`
- `altllm redeem-promo`
- `altllm topup-crypto`
- `altllm payment-status`
- `altllm pay-payment-link`
- `altllm cloud-claw-me`
- `altllm cloud-claw-deployments`
- `altllm cloud-claw-deployment`
- `altllm cloud-claw-deploy`
- `altllm cloud-claw-start`
- `altllm cloud-claw-stop`
- `altllm cloud-claw-restart`
- `altllm cloud-claw-renew`
- `altllm cloud-claw-auto-renew`
- `altllm cloud-claw-delete`
- `altllm cloud-claw-logs`

Portal commands target the AltLLM Portal API. Cloud Claw commands target Cloud Claw through Portal SSO. The `altllm` CLI commands do not operate the OpenAI-compatible gateway; generated API keys are used there separately.

## Default API

Production default:

- `https://platform-api.altllm.ai`

Only use `http://` for explicit local-development loopback targets such as `http://localhost` or `http://127.0.0.1`.

Commands that reuse a saved Portal session token, or forward that token to Cloud Claw via `portal-sso`, require `https://` for non-local hosts. Pre-auth flows such as `login-wallet --prepare` do not reuse a saved session token and are not blocked by that HTTPS guardrail.

If a command is reusing your saved Portal session token, the CLI will refuse to send that token to a different `--base-url` host unless you also pass `--allow-token-host-mismatch`.

## Install

```bash
npm install
npm test
npm run typecheck
npm run build
```

Run locally with:

```bash
node dist/cli.js <command> [options]
node dist/cli.js --version
```

Run the multi-user staging smoke suite after preparing wallets and logging them
in. This suite includes single-key API-key lifecycle commands (`get-api-key`,
`update-api-key`, and `revoke-api-key`), so keep it on staging unless those
production routes are known to be healthy:

```bash
npm run smoke:multi-user -- \
  --base-url https://altllm-portal-api.alt.technology \
  --wallets .altllm-e2e/staging/wallets.public.json \
  --include-payment-links
```

The smoke suite uses existing session files from the public wallet registry. It
does not read private keys, does not auto-pay, and prints a JSON summary.

Run the controlled model usage and billing E2E with a funded staging Portal
session or Portal cookie token:

```bash
read -r -s PORTAL_TOKEN
export PORTAL_TOKEN
npm run e2e:model-billing -- \
  --base-url https://altllm-portal-api.alt.technology \
  --gateway-url https://altllm-api.alt.technology \
  --portal-token-env PORTAL_TOKEN \
  --model altllm-native-fast
unset PORTAL_TOKEN
```

The model billing E2E is intentionally opt-in because it makes one real gateway
request. By default it refuses production-looking URLs, caps the observed
balance delta, creates a temporary API key, waits for Portal usage and billing
evidence, revokes the key, and prints a redacted JSON report.

## Available Skills

| Skill | Purpose | Use When |
|---|---|---|
| `altllm-portal-auth` | Wallet login, logout, and session bootstrap | Wallet challenge, local signing, external signature verification, local session removal |
| `altllm-portal-api-keys` | Portal API key lifecycle | Create, inspect, disable, re-enable, or revoke API keys |
| `altllm-portal-billing` | Balance, promo, transactions, and usage analytics | Credit balance, promo redemption, billing history, usage views |
| `altllm-portal-payments` | Payment-link creation, polling, and direct payment execution | Crypto top-up, payment status, direct wallet payment |
| `altllm-portal-cli` | Umbrella navigation skill | Workflows that span multiple domains |
| `cloud-claw-launch-agent` | Launch a new AltClaw / OpenClaw / PicoClaw / Ottie VM | New deployment workflow through the local `cloud-claw-*` CLI commands |
| `cloud-claw-manage-vm` | View and manage existing Cloud Claw VMs | List, inspect, start, stop, renew, logs, and dashboard |
| `cloud-claw` | Umbrella navigation skill for Cloud Claw | Cross-domain Cloud Claw flows |

## Typical Workflows

**Login and Create Gateway Key**

`altllm-portal-auth` -> `altllm-portal-api-keys`

Use this when the user needs to sign in to Portal, create a new API key, and then use that key against `https://api.altllm.ai/v1`.

**Check Balance and History**

`altllm-portal-billing`

Use this when the user wants current balance, billing transactions, or usage history by period, model, or key.

**Create and Settle Crypto Top-Up**

`altllm-portal-payments` -> `altllm-portal-billing`

Use this when the user needs to create a payment link, wait for settlement, and then confirm the resulting balance or usage changes.

**Launch and Manage AltClaw**

`cloud-claw-launch-agent` -> `cloud-claw-manage-vm`

Use this when the user wants to create a new AltClaw / PicoClaw / Ottie VM and then inspect status, logs, renewal, or dashboard access in Cloud Claw.

## Cloud Claw

Inspect Cloud Claw user state:

```bash
node dist/cli.js cloud-claw-me
```

If you intentionally point Cloud Claw commands at a non-trusted host with `--cloud-claw-base-url`, also pass `--allow-cloud-claw-token-forwarding`. Without that explicit override, the CLI will refuse to POST your saved Portal session token to that host.

List deployments:

```bash
node dist/cli.js cloud-claw-deployments
```

Get one deployment:

```bash
node dist/cli.js cloud-claw-deployment --name swift-owl-9
```

Launch a new PicoClaw:

```bash
export TELEGRAM_BOT_TOKEN=123456:ABC-your-telegram-bot-token
node dist/cli.js cloud-claw-deploy \
  --name swift-owl-9 \
  --agent-type picoclaw \
  --telegram-bot-token-env TELEGRAM_BOT_TOKEN \
  --telegram-allowed-users 123456789
```

Launch a new OpenClaw:

```bash
export TELEGRAM_BOT_TOKEN=123456:ABC-your-telegram-bot-token
node dist/cli.js cloud-claw-deploy \
  --name happy-fox-12 \
  --agent-type openclaw \
  --model altllm/altllm-standard \
  --telegram-bot-token-env TELEGRAM_BOT_TOKEN \
  --telegram-allowed-users 123456789
```

For Telegram-backed deployments:

- `--telegram-bot-token` is required for `picoclaw` and `aintern`
- safer alternatives are `--telegram-bot-token-env` and `--telegram-bot-token-file`
- omitting `--telegram-allowed-users` on `picoclaw` or `aintern` allows everyone to message the bot
- passing `--telegram-allowed-users ""` is rejected; use omission, not an empty string, for public bot behavior

Other deployment secrets also support non-argv input:

- `--altllm-api-key-env` / `--altllm-api-key-file`
- `--anthropic-api-key-env` / `--anthropic-api-key-file`

Manage an existing VM:

```bash
node dist/cli.js cloud-claw-start --name swift-owl-9
node dist/cli.js cloud-claw-stop --name swift-owl-9
node dist/cli.js cloud-claw-restart --name swift-owl-9
node dist/cli.js cloud-claw-renew --name swift-owl-9
node dist/cli.js cloud-claw-auto-renew --name swift-owl-9 --enabled true
node dist/cli.js cloud-claw-delete --name swift-owl-9
```

Read logs:

```bash
node dist/cli.js cloud-claw-logs --name swift-owl-9
node dist/cli.js cloud-claw-logs --name swift-owl-9 --stream
```

## Authentication

Log in with an EVM wallet:

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x... \
  --private-key-env ALTLLM_WALLET_PRIVATE_KEY
```

Successful login stores a session at:

- `~/.altllm/portal-cli-session.json`

On POSIX systems, the CLI saves the session directory and file with private permissions (`0700` for the directory and `0600` for the file).

Remove the local Portal session:

```bash
node dist/cli.js logout
```

`logout` only clears the local saved session file used by this CLI. It does not revoke API keys.

Use `ALTLLM_WALLET_PRIVATE_KEY` instead of passing `--private-key` inline whenever possible.

Local private-key input options:

- `ALTLLM_WALLET_PRIVATE_KEY=<private-key>` with the default `--private-key-env ALTLLM_WALLET_PRIVATE_KEY`
- `--private-key-env <ENV_NAME>`
- `--private-key-file <path>`
- `--private-key <hex>` with `--allow-unsafe-private-key-argv`

Direct `--private-key` usage is still available for compatibility, but requires `--allow-unsafe-private-key-argv` because command-line arguments can leak through shell history and process listings:

```bash
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x... \
  --private-key <hex-private-key> \
  --allow-unsafe-private-key-argv
```

If the wallet can sign but you do not control its private key locally, prepare a challenge first:

```bash
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x... \
  --prepare
```

This prints the `message`, `nonce`, and `expiresAt`. Sign the message with the external wallet, then verify the signature:

```bash
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x... \
  --nonce <nonce> \
  --signature <hex-signature>
```

Notes:

- The CLI no longer assumes it must hold the user's private key.
- External signers such as Privy are supported as long as they can sign the challenge message and return the wallet signature.
- Local auto-signing now validates that the returned challenge matches the requested wallet, chain, and expected AltLLM login message shape before signing.
- Automatic local signing is only allowed for the default production Portal API or loopback hosts. For other hosts, use `--prepare` and sign externally.
- The current Portal backend still validates EVM addresses and Ethereum-style signatures.
- If you run `login-wallet` without a local private key or `--signature`, it now returns a challenge payload instead of failing immediately.

## API Keys

List existing keys:

```bash
node dist/cli.js list-api-keys \
  --base-url https://platform-api.altllm.ai
```

Create a key with default permissions:

```bash
node dist/cli.js create-api-key \
  --base-url https://platform-api.altllm.ai \
  --name "Agent Key"
```

Create a key restricted to selected models:

```bash
node dist/cli.js create-api-key \
  --base-url https://platform-api.altllm.ai \
  --name "Codex Agent" \
  --model altllm-native-fast \
  --model altllm-standard
```

Create a Flex-aware key allowlist:

```bash
node dist/cli.js create-api-key \
  --base-url https://platform-api.altllm.ai \
  --name "Flex Agent" \
  --model altllm-standard \
  --model altllm-flex-gpt-5.5 \
  --model altllm-flex-opus-4.7 \
  --model altllm-flex-gemini-3.1
```

Inspect one key:

```bash
node dist/cli.js get-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id>
```

Rename or change model permissions:

```bash
node dist/cli.js update-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id> \
  --name "Codex Agent v2" \
  --model altllm-native-fast
```

Disable or re-enable a key:

```bash
node dist/cli.js update-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id> \
  --status disabled
```

```bash
node dist/cli.js update-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id> \
  --status active
```

Revoke a key permanently:

```bash
node dist/cli.js revoke-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id>
```

Notes:

- `create-api-key` returns the full `key` only once. Save it securely.
- If you do not pass `--model` or `--models`, the Portal API uses its default model allowlist for new keys.
- Key permissions are an allowlist, but gateway balance checks and subscription-tier model access still apply.
- Model validation accepts any model ID with the `altllm-` prefix, including Flex-only IDs such as `altllm-flex-gpt-5.5`.

Use the returned API key against the AltLLM OpenAI-compatible gateway:

```bash
curl https://api.altllm.ai/v1/chat/completions \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "altllm-native-fast",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Billing

Check Portal balance:

```bash
node dist/cli.js credit \
  --base-url https://platform-api.altllm.ai
```

The balance response is passed through unchanged. When the Portal API includes plan fields such as `subscription_tier`, `allowed_models`, or related model-access metadata, use this command to inspect whether the account is on Business/Flex (`subscription_tier: "flex"`) and which models the backend currently allows.

AltLLM plan families:

- Personal: `free`, `basic`, `pro`, `power`
- Business: `flex`

Flex is pay-per-use. Flex accounts can use normal AltLLM models and may also use Flex-only native models such as `altllm-flex-gpt-5.5`, `altllm-flex-opus-4.7`, and `altllm-flex-gemini-3.1`, subject to backend access checks.

Redeem a promo code:

```bash
node dist/cli.js redeem-promo \
  --base-url https://platform-api.altllm.ai \
  --code PROMO-XXXX
```

`credit` and `redeem-promo` return the API response JSON unchanged.

View billing transaction history:

```bash
node dist/cli.js transactions \
  --base-url https://platform-api.altllm.ai \
  --limit 20
```

Filter transactions by type:

```bash
node dist/cli.js transactions \
  --base-url https://platform-api.altllm.ai \
  --type usage
```

View usage summary for the current calendar month:

```bash
node dist/cli.js usage-summary \
  --base-url https://platform-api.altllm.ai
```

View daily usage history:

```bash
node dist/cli.js usage-timeline \
  --base-url https://platform-api.altllm.ai \
  --month 2026-03
```

View usage by model:

```bash
node dist/cli.js usage-by-model \
  --base-url https://platform-api.altllm.ai \
  --month 2026-03
```

View usage by API key:

```bash
node dist/cli.js usage-by-key \
  --base-url https://platform-api.altllm.ai \
  --start-date 2026-03-01 \
  --end-date 2026-03-31
```

## Payments

Create a hosted crypto payment link:

```bash
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 25
```

Create a discounted payment link with an explicit pay currency:

```bash
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 100 \
  --pay-currency sol \
  --discount-code SOLANA
```

Create a direct payment link and auto-pay it:

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js topup-crypto \
  --base-url https://platform-api.altllm.ai \
  --amount 25 \
  --pay-currency usdcbase \
  --private-key-env ALTLLM_WALLET_PRIVATE_KEY \
  --auto-pay \
  --wait
```

Poll an existing payment link:

```bash
node dist/cli.js payment-status \
  --base-url https://platform-api.altllm.ai \
  --payment-link-id <id> \
  --wait
```

Pay an existing direct-payment link:

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js pay-payment-link \
  --base-url https://platform-api.altllm.ai \
  --payment-link-id <id> \
  --private-key-env ALTLLM_WALLET_PRIVATE_KEY \
  --wait
```

Wallet private-key input options for payment commands:

- `ALTLLM_WALLET_PRIVATE_KEY=<private-key>` with the default `--private-key-env ALTLLM_WALLET_PRIVATE_KEY`
- `--private-key-env <ENV_NAME>`
- `--private-key-file <path>`
- `--private-key <hex>` with `--allow-unsafe-private-key-argv`

Direct `--private-key` usage requires `--allow-unsafe-private-key-argv` because command-line arguments can leak through shell history and process listings.

## Payment Behavior

- All commands print machine-readable JSON to stdout.
- API key management commands return raw Portal API JSON.
- History commands return raw Portal API JSON.
- `topup-crypto --discount-code <code>` applies a discount code when creating a credit top-up invoice.
- `--pay-currency` asks Portal for direct payment fields; `--auto-pay` is limited to the supported EVM-compatible currencies listed below.
- Discount metadata returned by Portal payment-link endpoints is printed in payment command JSON output as `discountCode`, `originalAmount`, `discountPercent`, `discountAmount`, `finalAmount`, and `allowedPayCurrencies`.
- Discount codes on `topup-crypto` are for credit top-ups, not subscriptions.
- Discount-code top-ups are previewed before the CLI creates a payment link. If Portal returns exactly one allowed token, the CLI uses it automatically; if multiple tokens are allowed, pass one with `--pay-currency`.
- Token-scoped discount codes are guarded client-side when Portal returns `allowedPayCurrencies`: mismatched `--pay-currency` values fail clearly before payment-link creation.
- `pay-payment-link --wait` prints one final JSON document.
- The CLI does not silently downgrade from direct payment mode to hosted checkout mode.
- Terminal payment-link statuses such as `completed`, `expired`, `failed`, and `deactivated` are rejected before direct payment is sent.
- `payment-status` and `pay-payment-link` currently depend on the newest `100` Portal payment links exposed by `GET /api/billing/payment-links?limit=100`.
- Older payment links may be unreachable from the CLI until the backend exposes either lookup by ID or older-page pagination.

## HTTP Timeouts

- Non-stream CLI HTTP requests time out after `30000ms` by default.
- Override this with `ALTLLM_HTTP_TIMEOUT_MS` if you need a different non-stream request timeout.

Supported automatic direct-payment currencies:

- `eth`
- `usdterc20`
- `usdcerc20`
- `usdcbase`
- `usdtbase`

## Local Development

Local Portal API example:

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js login-wallet \
  --base-url http://localhost:7040 \
  --wallet-address 0x... \
  --private-key-env ALTLLM_WALLET_PRIVATE_KEY
```

## Repository Layout

- `src/cli.ts`: command registration
- `src/commands/`: command implementations
- `src/lib/api.ts`: HTTP wrapper and CLI error handling
- `src/lib/session.ts`: saved session token handling
- `src/lib/wallet.ts`: wallet signing and direct payment execution
- `skills/_shared/`: shared skill notes used across focused skills
- `skills/altllm-portal-cli/`: umbrella repo-local skill that maps the CLI domains
- `skills/altllm-portal-auth/`: wallet login and challenge/signature flow
- `skills/altllm-portal-api-keys/`: Portal API key lifecycle
- `skills/altllm-portal-billing/`: balance, promo, transactions, and usage history
- `skills/altllm-portal-payments/`: payment-link creation, polling, and direct payment
- `skills/cloud-claw/`: umbrella skill for Cloud Claw workflows
- `skills/cloud-claw-launch-agent/`: new deployment workflow for AltClaw / OpenClaw / PicoClaw / Ottie
- `skills/cloud-claw-manage-vm/`: VM list, lifecycle, logs, renewals, and dashboard access

## Repo-Local Skills

This repository now follows a more modular repo-local skill layout:

- one thin umbrella skill for navigation
- focused domain skills for auth, API keys, billing/history, and payments
- shared `_shared/` docs for repeated preflight and environment rules
- per-skill `references/cli-reference.md` files for detailed command usage
