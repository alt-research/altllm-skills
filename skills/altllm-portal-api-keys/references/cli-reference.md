# AltLLM Portal API Keys — CLI Reference

## Commands

### List keys

```bash
node dist/cli.js list-api-keys \
  --base-url https://platform-api.altllm.ai
```

### Create key

```bash
node dist/cli.js create-api-key \
  --base-url https://platform-api.altllm.ai \
  --name "Codex Agent" \
  --model altllm-native-fast \
  --model altllm-standard
```

Representative stdout:

```json
{
  "id": "key_123",
  "name": "Codex Agent",
  "key": "sk-alt-abcdefghijklmnopqrstuvwxyz0123456789ABCD",
  "key_prefix": "sk-alt-abcd..."
}
```

### Inspect key

```bash
node dist/cli.js get-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id>
```

### Update key

```bash
node dist/cli.js update-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id> \
  --name "Codex Agent v2" \
  --status active \
  --model altllm-native-fast
```

### Revoke key

```bash
node dist/cli.js revoke-api-key \
  --base-url https://platform-api.altllm.ai \
  --key-id <id>
```

## Notes

- Keys created through Portal are for the AltLLM OpenAI-compatible gateway at `https://api.altllm.ai/v1`.
- `get-api-key` depends on the corresponding Portal API endpoint being healthy.
