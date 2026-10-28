# Command Log

Important commands are recorded with purpose and observed outcome. Package-version queries were performed against the npm registry on 2026-08-01.

| Command                                                          | Purpose                               | Outcome                                                                              |
| ---------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `uname -a`, `cat /etc/os-release`, `free -h`, `df -h /home/arch` | Inspect OS, memory, and disk          | CachyOS x86-64; 14 GiB RAM; 52 GiB free                                              |
| `node --version`, `npm --version`, `pnpm --version`              | Inspect JavaScript tools              | Node 25.9.0, npm 11.13.0, pnpm absent                                                |
| `git -C /home/arch status`, project/path searches                | Check existing work                   | Home is not a Git repository; project absent                                         |
| `gcc`, `g++`, `make`, `python --version`                         | Check native build prerequisites      | Native toolchain available                                                           |
| `ss -ltnp 'sport = :4782'`                                       | Check required port                   | Port free before implementation                                                      |
| `git init`, `git branch -m main`                                 | Initialize isolated repository        | New repository created on `main`                                                     |
| `npm view <package> ...`                                         | Resolve stable compatible versions    | Exact versions recorded in package manifests                                         |
| `mise install`                                                   | Install project-local toolchain       | Node 24.18.1 and pnpm 11.18.0 installed; system Node unchanged                       |
| `pnpm install`                                                   | Install locked workspace dependencies | Install completed; a Svelte 5 peer mismatch in the Svelte Table adapter was detected |

The incompatible `@tanstack/svelte-table` adapter was replaced with official `@tanstack/table-core@8.21.3`, retaining TanStack Table without relying on a preview or unsupported peer range.

| Command                                   | Purpose                                            | Outcome                                                                               |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `mise exec -- pnpm peers check`           | Verify workspace compatibility                     | No peer dependency issues after Table adapter correction                              |
| Node `better-sqlite3` smoke script        | Verify native addon under Node 24                  | SQLite 3.53.4 opened, wrote, reopened, and used WAL successfully                      |
| `pnpm format:check` and `pnpm lint`       | Formatting and static lint                         | Passed                                                                                |
| `pnpm --filter @payment-ledger/web check` | Svelte/TypeScript diagnostics                      | 0 errors and 0 warnings                                                               |
| `pnpm test`                               | Focused parser, database, service, and API tests   | 3 files and 21 tests passed                                                           |
| `pnpm build`                              | Compile packages/server and static SPA             | Passed; production SPA written to `apps/web/build`                                    |
| `pnpm db:migrate`                         | Validate migration runner on a temporary data root | Two migrations applied successfully                                                   |
| `pnpm db:backup`                          | Validate online backup and integrity check         | Verified backup created with `integrity=ok`                                           |
| `pnpm smoke`                              | Validate production HTTP and network binding       | Health/static page passed; only `127.0.0.1:4782` listened; observed RSS about 145 MiB |
| `pnpm test:e2e`                           | One critical production browser workflow           | Chromium page and health workflow passed                                              |
| `pnpm install --frozen-lockfile`          | Confirm reproducible locked installation           | Lockfile accepted with no package changes                                             |

Implementation validation commands and their final results are appended after installation and testing.

## Complete website implementation

| Command or workflow            | Outcome                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Pre-migration `pnpm db:backup` | Existing local database backed up and verified before schema expansion               |
| `pnpm db:migrate`              | `003_product_features.sql` applied successfully                                      |
| Disposable HTTP product flow   | Payee, preview, save, correction/audit, report, CSV, and backup passed               |
| Production Chromium screenshot | Dashboard visually reviewed at 1440×900                                              |

## Six-month synthetic demo dataset

| Command                                                       | Purpose                                               | Outcome                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `mise exec -- pnpm db:backup -- --tier=daily`                 | Preserve the empty live database before demo seeding  | Verified backup `daily-2026-08-01T154752818Z.sqlite3` created with `integrity=ok`                                    |
| `mise exec -- pnpm db:seed-demo`                              | Add deterministic synthetic data for local UI testing | Added 12 payees, 704 transactions, and 15 review entries for 2026-02-01 through 2026-08-01                            |
| `sqlite3 data/ledger.sqlite3 ...`                             | Basic post-seed verification                          | Integrity `ok`; 704 imported demo transactions totaling Rs 79,08,050.00                                              |
| `curl http://127.0.0.1:4782/api/health` and dashboard request | Confirm the running app sees seeded data              | Health and populated dashboard responses returned successfully                                                       |

## Cash-first UI and reporting redesign

| Command | Purpose | Outcome |
| --- | --- | --- |
| Official Apache ECharts and TanStack documentation research | Confirm current accessible, responsive chart and large-data patterns | Retained lazy-loaded ECharts with ARIA-enabled charts and server-side aggregates; retained server pagination for the ledger |
| `mise exec -- pnpm db:backup -- --tier=daily` | Preserve live data before removing obsolete closing tables | Verified backup `daily-2026-08-01T160208652Z.sqlite3` created |
| `mise exec -- pnpm db:migrate` | Apply the focused product migrations | Closing tables removed and nine operational categories added; 704 transactions and 704 audit rows preserved; integrity `ok` |
| `mise exec -- pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` | Focused validation | 0 Svelte/TypeScript warnings, lint passed, 21 tests passed, production build passed |

## Payment Desk frontend migration

| Command or decision | Purpose | Outcome |
| --- | --- | --- |
| npm registry compatibility inspection | Pin stable Svelte 5 and Tailwind 4 compatible packages | Skeleton 4.15.2, Ark UI 5.22.1, LayerChart 2.0.4, Fuse.js 7.5.0, Sonner 1.1.1, and Lucide 1.28.0 installed exactly |
| Removed `bits-ui`, `echarts`, shadcn config, and shadcn utility dependencies | Prevent mixed visual systems and overlapping runtimes | Skeleton custom theme is the only visual system; Ark remains behavior-only |
| `mise exec -- pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` | Validate the frontend migration | 0 Svelte/TypeScript warnings, lint passed, 21 tests passed, production build passed |
| Production restart and `/api/health` | Serve the rebuilt SPA locally | Healthy and listening only on `127.0.0.1:4782` |

## React Frontend Migration (Ledger OS Redesign)

| Command | Purpose | Outcome |
| --- | --- | --- |
| `mise exec -- pnpm info ...` | Query stable compatible versions for React 19 / Vite 8 stack | Resolved react@19.2.8, react-router@7.18.2, vite@8.2.0, tailwindcss@4.3.3, and motion@12.43.0 |
| `write_to_file apps/web-react/...` | Implement React frontend foundations, routing, API client, pages and components | Created parallel foundation structure for Ledger OS keyboard-first interface |
| `mise exec -- pnpm add geist --ignore-scripts` | Install local Geist Sans & Mono fonts offline | Packages added; woff2 fonts copied to public directory for complete offline-mode operation |
| `replace_file_content apps/server/src/app.ts` | Redirect static file serving path to web-react/build | Configured fallback chain to serve React SPA when available while keeping Svelte source untouched |
| `replace_file_content package.json` | Set web-react as default workspace target for build and dev tasks | Workspace builds default to React frontend |
| `mise exec -- pnpm run check` | Run TypeScript check on the React app and entire codebase | Resolved unused imports, missing Vite types, and compiled with 0 errors |
| `mise exec -- pnpm run build` | Compile packages, server, and React SPA for production deployment | Production build completed with tree-shaken and code-split ECharts chunk under 1.1s |
| `mise exec -- pnpm test` | Run baseline unit and integration tests | 28/28 tests passed successfully |
| `mise exec -- pnpm test:e2e` | Run Playwright E2E verification test suite | Test run passed successfully in 4.3 seconds |

