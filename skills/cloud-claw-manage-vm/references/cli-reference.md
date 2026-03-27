# Cloud Claw Manage VM — CLI Reference

## List my deployments

```bash
node dist/cli.js cloud-claw-deployments
```

## Get one deployment

```bash
node dist/cli.js cloud-claw-deployment --name swift-owl-9
```

## Stop a VM

```bash
node dist/cli.js cloud-claw-stop --name swift-owl-9
```

## Start a VM

```bash
node dist/cli.js cloud-claw-start --name swift-owl-9
```

## Restart a VM

There is no dedicated backend restart endpoint. The local CLI wraps restart as:

```bash
node dist/cli.js cloud-claw-restart --name swift-owl-9
```

## Renew a VM

```bash
node dist/cli.js cloud-claw-renew --name swift-owl-9
```

## Toggle auto-renew

```bash
node dist/cli.js cloud-claw-auto-renew --name swift-owl-9 --enabled true
```

## Delete a VM

```bash
node dist/cli.js cloud-claw-delete --name swift-owl-9
```

## One-shot logs

```bash
node dist/cli.js cloud-claw-logs --name swift-owl-9
```

## Stream logs

```bash
node dist/cli.js cloud-claw-logs --name swift-owl-9 --stream
```

## Dashboard

For OpenClaw VMs, use the proxied dashboard path:

```text
/dash/<vmName>/
```

If the client needs auth bootstrap, the UI uses `?auth=<jwt>`.
