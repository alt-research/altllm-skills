---
name: altllm-portal-auth
description: Use this skill when the user asks to log in with a wallet, fetch a wallet sign-in challenge, verify an externally signed challenge, or troubleshoot AltLLM Portal wallet login for the local altllm CLI. Do NOT use for API key management, billing history, or payment links.
user-invocable: true
---

# AltLLM Portal Auth

Wallet login and session bootstrap for the local `altllm` CLI.

## Shared Setup

> Before the first `altllm` command in a fresh checkout, read and follow:
> - `../_shared/preflight.md`
> - `../_shared/session-and-target.md`

## Command Index

| Command | Purpose |
|---|---|
| `login-wallet` | Sign in with a locally available private key |
| `login-wallet --prepare` | Fetch a challenge for external signing |
| `login-wallet --nonce <nonce> --signature <sig>` | Verify an externally signed challenge and save the session |

## Rules

- Do not assume the CLI must control the wallet private key.
- If the wallet can sign the challenge message, use the prepare + verify flow.
- If neither a local private key nor `--signature` is available, return the challenge payload and stop.
- Current backend support is still limited to EVM addresses and Ethereum-style signatures.
- Save the resulting session to `~/.altllm/portal-cli-session.json` unless overridden.

## Reference

See [references/cli-reference.md](references/cli-reference.md) for commands, payloads, and troubleshooting notes.
