---
name: altllm-portal-api-keys
description: Use this skill when the user asks to list, create, inspect, update, disable, re-enable, or revoke AltLLM Portal API keys for external agents or applications. Do NOT use for wallet login, billing history, or payment links.
user-invocable: true
---

# AltLLM Portal API Keys

Portal API key lifecycle management for the local `altllm` CLI.

## Shared Setup

> Before the first `altllm` command in a fresh checkout, read and follow:
> - `../_shared/preflight.md`
> - `../_shared/session-and-target.md`

## Command Index

| Command | Purpose |
|---|---|
| `list-api-keys` | List active and disabled keys |
| `create-api-key` | Create a new key, optionally with a model allowlist |
| `get-api-key` | Inspect one key |
| `update-api-key` | Rename a key, change status, or replace the model allowlist |
| `revoke-api-key` | Permanently revoke a key |

## Rules

- `create-api-key` returns the full key only once.
- If no model allowlist is passed, the Portal API applies its default AltLLM model set.
- Key permissions narrow accessible models, but gateway balance and tier checks still apply.
- `update-api-key --status disabled` is reversible.
- `revoke-api-key` is permanent.

## Known Production Limitation

- The single-key Portal API routes are currently broken in production.
- Affected commands:
  - `get-api-key`
  - `update-api-key`
  - `revoke-api-key`
- Commands that still work:
  - `list-api-keys`
  - `create-api-key`

## Reference

See [references/cli-reference.md](references/cli-reference.md) for command examples and representative responses.
