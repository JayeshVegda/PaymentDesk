# Payee production deployment design

## Goal

Serve the existing Payment Ledger application at `https://payee.zayu.dev` on this VPS while preserving `/opt/stacks/sites/payee/data`. The site is intentionally accessible without an authentication prompt.

## Architecture

- Build the pnpm monorepo reproducibly in a multi-stage Node 24 container image.
- Run the existing single Hono production process as the unprivileged `node` user on port 4782.
- Join the existing external `proxy-net`; Caddy terminates TLS and proxies to `payee:4782`.
- Persist the SQLite database and backups through host bind mounts at `./data` and `./backups`.
- Retain Host and Origin validation for `payee.zayu.dev` and its HTTPS origin.

## Deployment and rollback

Validate tests and the image before starting it. Back up and integrity-check the SQLite database before cutover. Validate the Caddy configuration before reloading it. If the app fails, stop the Payee container and remove its Caddy site block; the pre-deployment database backup remains available.

## Verification

- Container health reports healthy.
- `https://payee.zayu.dev/api/health` returns an OK application and database status.
- The SPA loads through HTTPS and an API read succeeds.
- The mounted database remains the existing ledger database.
- A foreign Host or Origin remains rejected.
