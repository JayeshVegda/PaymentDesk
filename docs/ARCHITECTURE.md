# Architecture

## Dependency direction

1. `apps/web-react`: presentation, table views, and client-side server-state caching only.
2. `apps/server`: Hono routes, middleware, static serving, and dependency composition.
3. `packages/core`: business services and repository interfaces.
4. `packages/database`: Kysely types, SQLite adapters, migrations, pragmas, and reporting queries.
5. `packages/parser`: deterministic local quick-entry parsing.
6. Future job and integration adapters call core services; core never imports them.

Route handlers validate transport concerns and call services. React components never contain accounting rules. Repositories contain persistence behavior but not user workflows. Every capture source uses the same `TransactionService`.

## Runtime

Production starts one Hono process on `127.0.0.1:4782`. API routes use `/api`; hashed frontend assets and the SPA fallback are served from `apps/web-react/build`. SQLite uses a single in-process `better-sqlite3` connection through Kysely. Short transactions and a busy timeout avoid lock surprises.

Development uses Vite on loopback port 4782 and Hono on loopback port 4783. This second process is development-only.

## Transaction flow

Input is validated with shared Zod schemas. The repository writes the transaction and audit snapshot in one SQLite transaction. Corrections use `updated_at` optimistic concurrency. Undo is a void action, never deletion.

## Website modules

The static React SPA provides Today, Payment Inbox, Payees, Reports, Activity, Export, and System workspaces. API routes delegate to `LedgerService`; route and component code do not contain SQL. Tailwind and the custom Payment Desk theme own the visual token system. Behavior primitives remain limited to accessible interactions, TanStack Table/query patterns drive data views, Fuse.js powers payee search, and report charts are dynamically imported only when Reports needs them.

## External integrations

Future Telegram, import, and scheduled jobs are adapters. They provide a source value and call the same parser/core APIs. Durable outgoing notifications use `notification_outbox`; retries do not alter transaction creation semantics.
