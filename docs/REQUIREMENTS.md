# Requirements

## Purpose

Record outgoing payments quickly and preserve who was paid, exact INR amount, business date/time, method, category, note, capture source, and every correction. The application is private, single-user, local-first, and continues to work without internet.

## Runtime constraints

- Target: Windows 10 Pro x64, i3-9100F, 4 GB RAM, SSD, GT 710.
- One Node.js 24 LTS process; no Docker, database server, Redis, Electron, cloud dependency, or unnecessary service.
- Listen only on `127.0.0.1:4782`; never bind a LAN interface.
- Store production data under `%LOCALAPPDATA%\PaymentLedger`.
- INR values are positive safe integers in paise. Floating-point money is forbidden.
- Business timezone is `Asia/Kolkata`; operational timestamps are UTC ISO-8601.

## Functional roadmap

The product covers master data, smart and manual capture, ledger corrections, reports/exports, verified backups/recovery, and an optional allowlisted Telegram companion. Telegram remains isolated behind the same core transaction service.

## Foundation acceptance

The exact toolchain installs, native SQLite loads, migrations are repeatable and tamper-evident, transaction changes are audited, health checks query the database, the static SPA is served by Hono in production, backups pass integrity checking, and automated checks plus a loopback-only smoke test pass.
