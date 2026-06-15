# Agent Instructions

This repository contains the TypeScript CLI for AltLLM Portal operations.

## Scope

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

Common aliases:

- `altllm balance` -> `altllm credit`
- `altllm keys` -> `altllm list-api-keys`

Portal commands target the AltLLM Portal API. Cloud Claw commands target Cloud Claw through Portal SSO. The `altllm` CLI commands do not operate the OpenAI-compatible gateway; generated API keys are used there separately.

## Default Target

Default production API base URL:

- `https://platform-api.altllm.ai`

Do not change the default API base URL to localhost unless the task is explicitly about local development.
Commands that reuse a saved Portal session token, or forward that token to Cloud Claw, must use `https://` for non-local hosts. Pre-auth flows such as `login-wallet --prepare` are outside that guardrail.

## Repo Structure

- `src/cli.ts`
  - command registration
- `src/commands/`
  - one file per command
- `src/lib/api.ts`
  - HTTP wrapper and CLI error handling
- `src/lib/session.ts`
  - saved session token handling
- `src/lib/wallet.ts`
  - wallet signing and direct payment execution
- `skills/altllm-portal-cli/`
  - umbrella repo-local skill docs for agents
- `skills/altllm-portal-auth/`
  - focused auth/login skill
- `skills/altllm-portal-api-keys/`
  - focused API key management skill
- `skills/altllm-portal-billing/`
  - focused balance/history/usage skill
- `skills/altllm-portal-payments/`
  - focused payment-link and direct-payment skill
- `skills/altllm-x402/`
  - focused x402 Portal credit top-up and Binance B402 skill
- `skills/_shared/`
  - shared preflight and environment notes reused by the focused skills

## Development Rules

- Keep the CLI TypeScript-first.
- Prefer `viem` for wallet signing and transaction sending.
- Keep command output machine-readable JSON.
- Fail fast on unsupported chains or `pay_currency` values.
- Do not silently downgrade from direct payment mode to hosted checkout mode.
- Keep NOWPayments payment-link flows separate from x402 Portal quote/settle flows.
- For current x402 work, match `alt-research/altllm`: Binance B402, `bsc`/`eip155:56`, and normally `usdt`.
- Do not print private keys or persist them outside user-controlled environment variables or files.

## Validation

Before shipping a change:

```bash
npm install
npm test
npm run typecheck
npm run build
```

If the change touches a live command, also run a real end-to-end check against the intended environment when practical.

## Local Testing

Local Portal API base URL:

- `http://localhost:7040`

Example local flow:

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js login-wallet \
  --base-url http://localhost:7040 \
  --wallet-address 0x... \
  --private-key-env ALTLLM_WALLET_PRIVATE_KEY
```

## Direct Crypto Payment Constraints

Direct payment execution currently assumes the API returns:

- `payment_id`
- `pay_address`
- `pay_amount`
- `pay_currency`

Only supported EVM-compatible `pay_currency` values should be auto-paid. Unsupported values must return a clear error.

## x402 Constraints

x402 support in this repository is currently skill/documentation guidance, not an `altllm` CLI command surface. The implementation source of truth is `alt-research/altllm`.

- Do not describe NOWPayments hosted/direct payment links as x402.
- Current AltLLM x402 top-ups use Portal API `/api/billing/x402/quote`, `/api/billing/x402/settle`, and `/api/billing/x402/{payment_id}/cancel`.
- Quote BNB Chain mainnet with `network: "bsc"` and usually `asset: "usdt"` unless the main AltLLM repo changes.
- Keep Portal session tokens and generated AltLLM gateway API keys separate from x402 wallet payment credentials.
- If an x402-protected service calls the AltLLM gateway, keep the AltLLM API key server-side.

## Security

- Never commit secrets, private keys, session files, or local env files.
- Common local `.env`-style files are gitignored, but still treat them as sensitive local-only state.
- Treat `~/.altllm/portal-cli-session.json` as sensitive local state.
- Prefer environment variables such as `ALTLLM_WALLET_PRIVATE_KEY` over inline secret arguments.
- If the wallet signs externally, prefer challenge + signature verification flow instead of requiring the raw private key locally.
