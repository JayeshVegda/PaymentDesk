# Muse AI direct-access API (PaymentDesk)

Muse is an external AI assistant that can read the ledger and record actual
payments. There is **no draft/review staging** — Muse writes through the same
`LedgerService` the web UI uses, so every write is paise-exact, duplicate-checked,
and audited (`transaction_audit`, append-only; voids are reversible).

## How Muse connects

- PaymentDesk itself stays **loopback-only** (`127.0.0.1:4782`).
- The **KapilCaddy** service (`:4174`, also reachable at
  `http://100.75.200.72:4174` / `http://kapil-products:4174` over Tailscale)
  proxies `/muse/*` to PaymentDesk. The Caddy rewrite restores
  `Host: 127.0.0.1:4782`, so the host allowlist still holds.
- Every Muse request must carry the key: `X-Muse-Key: <MUSE_API_KEY>` or
  `Authorization: Bearer <MUSE_API_KEY>`. The key lives in `C:\PaymentDesk\.env`
  (`MUSE_API_KEY`, loaded into the service by `scripts/start-production.mjs`).
- Without `MUSE_API_KEY` set, the whole `/muse` surface is not mounted at all.

## Endpoints (`/muse` prefix → `/muse/v1/...`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/state` | One-call bootstrap: clock + master data + system status |
| GET | `/v1/transactions?date=&from=&to=&search=&methodId=&categoryId=&payeeId=&includeVoided=&voidedOnly=&page=&pageSize=` | Filtered listing (`items`, `total`, `page`, `pageSize`) |
| GET | `/v1/payees/:id/transactions?pageSize=` | A payee's history |
| POST | `/v1/quick-entry/preview` `{command}` | Parse without saving |
| POST | `/v1/quick-entry/save` `{command, confirmNewPayee?, confirmDuplicate?, source?}` | Record a payment (source: `muse`) |
| POST | `/v1/transactions/:id/void` `{reason}` | Audited void |
| POST | `/v1/transactions/:id/unvoid` | Restore a voided transaction |
| GET | `/v1/transactions/:id/audit` | Full audit trail of one transaction |
| GET | `/v1/dashboard?date=` | Today-style summary |
| GET | `/v1/activity?limit=` | Recent audit activity |
| GET | `/v1/reports?from=&to=&reportGroup=&categoryId=&payeeId=&needsReview=` | Monthly reports |

Errors are typed, e.g. `NEW_PAYEE_UNCONFIRMED` (409) → retry with
`confirmNewPayee: true`; `DUPLICATE_TRANSACTION` (409) → confirm or stop.

## Quick-entry grammar (the only way Muse records payments)

`<payee> <amount> [<method>] [<category-words>] "note"` — amounts accept
`2.5k`, `1l`, `2.40lakh`, `240 lakh`; dates accept `3-jan`, `21/7`, `yesterday`;
methods accept `c`/`upi`/`b`/`ch`. See `docs/QUICK_ENTRY_GRAMMAR.md`.

## Local verification

```powershell
# loopback
Invoke-RestMethod http://127.0.0.1:4782/muse/v1/state -Headers @{ 'X-Muse-Key' = '<key>' }

# through Caddy over Tailscale
Invoke-RestMethod http://100.75.200.72:4174/muse/v1/state -Headers @{ 'X-Muse-Key' = '<key>' }
```

After changing server code or the key: rebuild (`pnpm build`) and restart the
`PaymentDesk` service (backup first, admin required). Changing the Caddyfile
requires restarting `KapilCaddy`.
