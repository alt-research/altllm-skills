---
name: cloud-claw-manage-vm
description: Use this skill when the user wants to view or manage an existing Cloud Claw VM: list deployments, inspect one VM, start, stop, restart, renew, toggle auto-renew, delete, stream logs, or open the dashboard, using the local altllm cloud-claw commands. Do NOT use for creating a brand-new deployment — use cloud-claw-launch-agent.
user-invocable: true
---

# Manage Cloud Claw VM

Use this skill for **existing VM lifecycle** tasks exposed in the Cloud Claw UI, via the local CLI commands in this repository.

The implementation source of truth is the sibling repository:

- `../cloud-claw`

## Shared Setup

> Before using this skill, read:
> - `../_shared/cloud-claw-preflight.md`
> - `../_shared/cloud-claw-api-surface.md`

## Supported Operations

| Operation | API |
|---|---|
| List my VMs | `GET /api/vm/deployments` |
| List all VMs (admin) | `GET /api/vm/deployments?includeAll=true&includeUserInfo=true` |
| Get one VM | `GET /api/vm/deployments/:name` |
| Start | `POST /api/vm/deployments/:name/start` |
| Stop | `POST /api/vm/deployments/:name/stop` |
| Restart | stop -> start |
| Renew | `POST /api/vm/deployments/:name/renew` |
| Toggle auto-renew | `POST /api/vm/deployments/:name/auto-renew` |
| Delete | `DELETE /api/vm/deployments/:name` |
| Fetch logs | `GET /api/vm/deployments/:name/logs` |
| Stream logs | `GET /api/vm/deployments/:name/logs/stream` |
| Open dashboard | `/dash/:vmName/...` |

## Rules

- Resolve VM names the same way the backend does:
  - user-facing short name
  - or full names with `openclaw-`, `picoclaw-`, `aintern-`
- `restart` is not a dedicated API endpoint. Treat it as:
  - stop
  - wait for completion
  - start
- `renew` and `auto-renew` are user-facing billing operations, not infra-only actions.
- Prefer the local `altllm cloud-claw-*` commands over raw HTTP.
- Logs and dashboard access are part of VM management because they are visible in the UI.
- Respect ownership checks unless the user is explicitly acting in admin mode.

## Reference

See [references/cli-reference.md](references/cli-reference.md) for request examples and response patterns.
