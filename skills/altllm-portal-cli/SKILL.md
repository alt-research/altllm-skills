---
name: altllm-portal-cli
description: Use the altllm CLI in this repository to authenticate to the AltLLM Portal with an EVM wallet and inspect Portal credit balance. Use when Codex or Claude is working inside the altllm-cli repository and needs to run the local CLI against the production AltLLM Portal API at https://platform-api.altllm.ai.
user-invocable: true
---

# AltLLM Portal CLI

Use this skill to operate the `altllm` CLI in this repository against the production AltLLM Portal API.

Supported tasks:

- Log in with an EVM wallet
- Check current Portal credit balance

## Default Target

Unless the user explicitly says otherwise, use the production Portal API:

- `https://platform-api.altllm.ai`

Do not default to localhost in this skill.

## Preflight

Before using the CLI:

1. Run `npm install`
2. Run `npm run build`

You may then invoke either:

- `node dist/cli.js ...`
- `altllm ...` if the package has already been installed globally

For repo-local execution, prefer:

```bash
node dist/cli.js ...
```

## Wallet Login

Use:

```bash
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address <wallet-address>
```

Private key handling:

- Prefer `ALTLLM_WALLET_PRIVATE_KEY`
- Only use `--private-key` when the user explicitly provides a raw private key for one-off execution

Example:

```bash
ALTLLM_WALLET_PRIVATE_KEY=<private-key> \
node dist/cli.js login-wallet \
  --base-url https://platform-api.altllm.ai \
  --wallet-address 0x...
```

Successful login writes a session file at:

- `~/.altllm/portal-cli-session.json`

## Credit Lookup

After login, use:

```bash
node dist/cli.js credit \
  --base-url https://platform-api.altllm.ai
```

This uses the saved session token and returns the Portal billing balance payload.

## Working Rules

- Always build the CLI before first use in a fresh checkout
- Default to the production API URL in this skill
- Do not print private keys back to the user
- Treat the session file as sensitive
- If login fails, verify:
  - wallet address matches the private key
  - production API URL is reachable
  - the Portal wallet login endpoints are enabled

## Reference

See [reference.md](reference.md) for exact commands and file locations.

