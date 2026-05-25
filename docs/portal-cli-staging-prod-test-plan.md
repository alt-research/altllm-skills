# Portal CLI Staging And Production Test Plan

This plan validates the `altllm` CLI against the AltLLM Portal API with four wallet-backed users. It covers full functional testing in staging and controlled smoke testing in production.

## Secret Handling

Do not commit private keys, Portal session files, `.env` files, or generated wallet material.

Allowed in git:

- this test plan
- scripts that generate local wallets
- public wallet addresses when useful for coordination
- GitHub encrypted secret names

Not allowed in git:

- raw private keys
- `wallets.private.json`
- `*.session.json`
- funded-wallet details beyond public addresses

If GitHub storage is needed, use GitHub encrypted secrets, not committed files. Suggested secret names:

- `ALTLLM_STAGING_E2E_USER_1_PRIVATE_KEY`
- `ALTLLM_STAGING_E2E_USER_2_PRIVATE_KEY`
- `ALTLLM_STAGING_E2E_USER_3_PRIVATE_KEY`
- `ALTLLM_STAGING_E2E_USER_4_PRIVATE_KEY`
- `ALTLLM_PROD_E2E_USER_1_PRIVATE_KEY`
- `ALTLLM_PROD_E2E_USER_2_PRIVATE_KEY`
- `ALTLLM_PROD_E2E_USER_3_PRIVATE_KEY`
- `ALTLLM_PROD_E2E_USER_4_PRIVATE_KEY`

Keep production test wallets unfunded unless a real direct-payment smoke test is explicitly approved.

## Account Preparation

Generate four staging wallets:

```bash
npm run prepare:test-wallets -- \
  --out-dir .altllm-e2e/staging \
  --prefix staging-user \
  --secret-prefix ALTLLM_STAGING_E2E_USER
```

Generate four production wallets separately:

```bash
npm run prepare:test-wallets -- \
  --out-dir .altllm-e2e/prod \
  --prefix prod-user \
  --secret-prefix ALTLLM_PROD_E2E_USER
```

Generated files:

- `wallets.private.json`: local private keys, mode `0600`, never committed
- `wallets.public.json`: public addresses, env var names, and session-file paths
- `login-commands.sh`: login commands that read private keys from env vars
- `github-secrets-template.sh`: optional helper for setting GitHub encrypted secrets from exported env vars

The prepared public account registry is tracked in `docs/portal-cli-test-accounts.public.json`. It contains only wallet addresses and matching secret names. The private keys for those addresses must stay in local `.altllm-e2e/**/wallets.private.json` files or GitHub encrypted secrets.

To create Portal users, export the private keys, set the target URL, then run the generated login commands:

```bash
export ALTLLM_E2E_BASE_URL=https://altllm-portal-api.alt.technology
export ALTLLM_STAGING_E2E_USER_1_PRIVATE_KEY=0x...
export ALTLLM_STAGING_E2E_USER_2_PRIVATE_KEY=0x...
export ALTLLM_STAGING_E2E_USER_3_PRIVATE_KEY=0x...
export ALTLLM_STAGING_E2E_USER_4_PRIVATE_KEY=0x...
bash .altllm-e2e/staging/login-commands.sh
```

The login helper uses the external-signature flow (`login-wallet --prepare`, local message signing, then `login-wallet --nonce <nonce> --signature <signature>`) so it works against staging without weakening the CLI guardrail that blocks automatic private-key signing on non-production HTTPS hosts.

Production uses `https://platform-api.altllm.ai`, but run production only as a smoke test unless stress testing is explicitly approved.

## Reusable Multi-User Smoke

After the users are logged in, run the reusable smoke suite:

```bash
npm run smoke:multi-user -- \
  --base-url https://altllm-portal-api.alt.technology \
  --wallets .altllm-e2e/staging/wallets.public.json \
  --include-payment-links
```

The current multi-user smoke suite includes single-key API-key lifecycle checks
(`get-api-key`, `update-api-key`, and `revoke-api-key`). While the known
production single-key route limitation is present, keep this full suite on
staging. For production, run only read/list checks manually unless those routes
have been confirmed healthy; also omit payment-link creation unless it has been
explicitly approved:

```bash
BASE_URL=https://platform-api.altllm.ai
SESSION=.altllm-e2e/prod/sessions/prod-user1.session.json
node dist/cli.js credit --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js transactions --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js usage-summary --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js list-api-keys --base-url "$BASE_URL" --session-file "$SESSION"
```

The suite:

- uses each user's saved `sessionFile`
- runs the read-command matrix
- creates, renames, disables, enables, and revokes temporary API keys
- verifies cross-user API-key isolation
- runs concurrent read bursts
- optionally creates hosted payment links and verifies owner/isolation behavior

It never reads private keys, never prints session tokens or generated API-key
secrets, never uses `--auto-pay`, and never sends on-chain transactions.

### Model Usage And Billing E2E

Use this when validating that a real gateway model call flows through Portal
usage and billing:

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

The suite:

- creates one temporary Portal API key
- calls the OpenAI-compatible gateway with a tiny capped chat completion
- polls `usage-by-key`, `usage-by-model`, `usage-summary`, `credit`, and usage transactions
- requires new model usage, key usage, and billing evidence before passing
- revokes the temporary API key unless `--keep-key` is passed

It is staging-first and refuses production-looking URLs unless
`--allow-non-staging` is passed. Keep the default `--max-tokens` low and leave
`--max-balance-delta-usd` in place so the test stays cheap.

## Environment Matrix

Staging should run the full suite:

- wallet login for four users
- all read commands
- API key create/get/update/revoke
- payment-link creation
- model usage and billing E2E with one funded staging session
- discount-code preview and guardrails
- concurrency and stress tests

Production should run smoke tests only:

- wallet login for four test users
- read commands
- API key list only while the known single-key route limitation is present
- a small number of payment-link creations
- discount-code preview behavior

Do not run production stress, mass payment-link creation, model billing E2E, or
real on-chain payment without explicit approval.

## Functional Test Matrix

Run these commands per user with that user's session file. Set the date range to
the current UTC month unless the test is intentionally targeting another period:

```bash
START_DATE="$(date -u +%Y-%m-01)"
END_DATE="$(date -u +%F)"
node dist/cli.js credit --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js transactions --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js usage-summary --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js usage-timeline --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js usage-by-model --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js usage-by-key --start-date "$START_DATE" --end-date "$END_DATE" --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js list-api-keys --base-url "$BASE_URL" --session-file "$SESSION"
```

API key lifecycle. Run the full lifecycle in staging. In production, do not
create temporary keys unless `revoke-api-key` has been confirmed healthy or
there is an approved cleanup path:

```bash
KEY_JSON="$(node dist/cli.js create-api-key --name e2e-smoke --base-url "$BASE_URL" --session-file "$SESSION")"
KEY_ID="$(printf '%s' "$KEY_JSON" | node -e 'let data=\"\"; process.stdin.on(\"data\", c => data += c); process.stdin.on(\"end\", () => console.log(JSON.parse(data).id));')"
node dist/cli.js get-api-key --key-id "$KEY_ID" --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js update-api-key --key-id "$KEY_ID" --name e2e-smoke-updated --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js revoke-api-key --key-id "$KEY_ID" --base-url "$BASE_URL" --session-file "$SESSION"
```

Payment-link smoke tests:

```bash
node dist/cli.js topup-crypto --amount 5 --base-url "$BASE_URL" --session-file "$SESSION"
```

Discount-code smoke tests:

```bash
node dist/cli.js topup-crypto --amount 5 --discount-code SOLANA --base-url "$BASE_URL" --session-file "$SESSION"
node dist/cli.js topup-crypto --amount 5 --discount-code SOLANA --pay-currency sol --base-url "$BASE_URL" --session-file "$SESSION"
```

Expected discount-code behavior:

- single-token discount auto-resolves its pay currency before payment-link creation
- matching explicit `--pay-currency` succeeds
- mismatched explicit `--pay-currency` fails before payment-link creation
- multi-token discounts without `--pay-currency` fail with valid choices
- missing or empty `allowed_pay_currencies` fails before payment-link creation

## Stress Test Scope

Stress only staging by default.

Safe stress scenarios:

- concurrent `credit`
- concurrent `transactions`
- concurrent `usage-*`
- concurrent `list-api-keys`
- create/update/revoke API keys with unique names
- discount-code preview and fail-fast paths
- limited payment-link creation if the provider/invoice volume is approved

Avoid in stress:

- `topup-crypto --auto-pay`
- `pay-payment-link`
- funded production wallets
- production stress without explicit approval

Suggested concurrency levels:

- 4 users x 5 concurrent commands
- 4 users x 25 concurrent commands
- 4 users x 100 total iterations

Collect:

- success/failure count
- p50/p95/p99 latency
- non-JSON output count
- HTTP 4xx/5xx breakdown
- rate-limit responses
- whether any command leaks private key or session data

## Funds Policy

Wallet users do not need funds for login, read commands, API key commands, or hosted payment-link creation.

Funds are needed only for commands that send on-chain transactions:

- `topup-crypto --auto-pay`
- `pay-payment-link`

Run real direct payment only as a separate tiny smoke test with one funded wallet, one known supported network/token, and explicit approval.

## Acceptance Criteria

- all command outputs are valid JSON on success
- failures are clear and do not create unsafe side effects
- user isolation holds across all four sessions
- no private key or session content appears in logs, git, PR comments, or command output
- staging stress has no unexplained 5xx errors
- production smoke has no unexpected payment-provider side effects
