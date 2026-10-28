# React Frontend Implementation Handoff

## Purpose

This document is the implementation brief for replacing the current Svelte presentation layer with a high-quality React frontend. It is written for an AI or engineer continuing the work in this repository.

The new interface must feel like a focused 2026 desktop payment workstation, not a generic admin dashboard. It must remain fast on the target Windows 10 computer with 4 GB RAM.

Do not implement Telegram. Do not modify financial behavior merely to simplify the frontend.

## First actions

Before changing files:

1. Inspect the repository, working tree, installed toolchain, current running application, and existing documentation.
2. Run the existing focused tests and record the baseline result.
3. Inspect all current API calls and response types used by `apps/web`.
4. Create the React frontend beside the Svelte frontend. Do not delete or overwrite `apps/web` during migration.
5. Record important commands in `docs/COMMAND_LOG.md`.

Do not ask for routine decisions already settled in this document. Stop only for a genuine data-safety or architecture blocker.

## Non-negotiable boundaries

Preserve without behavior changes:

- `apps/server`
- Hono API routes and response contracts
- `packages/core`
- `packages/database`
- `packages/parser`
- SQLite data and migrations
- Audit-log behavior
- Indian money parsing
- Backdated transaction support
- Review workflow
- Backup and restore behavior
- Binding exclusively to `127.0.0.1:4782`

Business rules must not move into React components. The frontend may format, validate for immediate feedback, and call APIs; the backend remains authoritative.

Never silently delete, rewrite, or reinterpret financial records. Editing and voiding must continue through the existing audited backend flows.

## Selected technology

Use the newest stable, mutually compatible releases available at implementation time. Pin exact resolved versions in `pnpm-lock.yaml`. Do not use alpha, beta, RC, canary, or preview packages in the production dependency graph.

### Core frontend

- React 19.2 stable line
- React DOM
- Vite 8 stable line
- TypeScript
- React Router 7 in SPA/declarative mode
- Tailwind CSS 4.3 stable line
- shadcn/ui CLI v4
- shadcn/ui components using the Base UI foundation
- TanStack React Query
- TanStack React Table v8
- TanStack React Virtual
- Zod
- Fuse.js
- Sonner
- Lucide React
- Apache ECharts using tree-shakable imports
- Motion for React, used selectively

### Testing and development

- Vitest
- React Testing Library
- Playwright for critical workflows
- React Scan only as an optional development dependency or temporary diagnostic tool
- Vite Devtools only in development
- Bundle analysis only as a development command

Do not add Redux, Zustand, Next.js, Material UI, Ant Design, Chakra UI, another chart library, another component system, or an admin template unless an actual requirement cannot be met otherwise.

## Project structure

Create the React application as a sibling while the existing application remains available:

```text
apps/
├── web/                         # Existing Svelte app; preserve as rollback
├── web-react/
│   ├── components.json
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── app/
│       │   ├── App.tsx
│       │   ├── router.tsx
│       │   └── query-client.ts
│       ├── api/
│       │   ├── client.ts
│       │   ├── queries.ts
│       │   └── mutations.ts
│       ├── components/
│       │   ├── ui/              # shadcn source owned by this project
│       │   ├── shell/
│       │   ├── payment-entry/
│       │   ├── transactions/
│       │   ├── payees/
│       │   ├── review/
│       │   └── reports/
│       ├── features/
│       ├── hooks/
│       ├── pages/
│       ├── styles/
│       │   ├── globals.css
│       │   └── tokens.css
│       ├── types/
│       └── main.tsx
```

Shared transport/domain types should come from `packages/shared` when available. Do not create competing copies of domain types across pages.

## Visual direction: Ledger OS

The application is a modern keyboard-first cash desk for one operator. It is dense, calm, fast, and operational.

It must not resemble a stock shadcn dashboard. shadcn is the accessible component source foundation, not the visual identity.

### Palette

```css
--ledger-ink: #10213f;
--ledger-blue: #2864c7;
--ledger-blue-hover: #1f55ad;
--ledger-selection: #e8f0fd;
--ledger-workspace: #f5f7fa;
--ledger-surface: #ffffff;
--ledger-border: #dce3ee;
--ledger-muted: #66738d;
--ledger-review: #c33c54;
```

Blue and white own the application shell. Review red is reserved for unresolved or destructive states. Charts may use sufficiently distinct blue tint depths and a restrained secondary data color when required for legibility.

### Typography

- Bundle Geist Sans Variable locally for interface text.
- Bundle Geist Mono locally for amounts, transaction IDs, dates, and times.
- Use tabular numerals for every financial value.
- Base text is 15–16 px.
- Avoid loose letter spacing on money.
- Do not add uppercase decorative eyebrow labels.
- Do not place repeated page headings below an already-active navigation item.
- Do not add generic explanatory subtitles such as “Spend intelligence” or “Financial log.”

### Surfaces and spacing

- Radius: generally 6–10 px, not large pill-shaped containers everywhere.
- Borders: subtle and more important than shadows.
- Shadows: small, blue-tinted, and uncommon.
- No heavy blur or glassmorphism.
- No decorative gradients or blobs.
- Use the 1920×1080 canvas efficiently.
- Keep the important Today workflow above the fold.
- Avoid equal-height columns when their content lengths differ.

### Motion

Use a single motion scale:

```css
--motion-fast: 120ms;
--motion-base: 180ms;
--motion-slow: 260ms;
--motion-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
```

Motion is allowed for:

- Drawer/dialog entry and exit
- A newly saved transaction entering the list
- Number changes after a confirmed save
- Active navigation indicator movement
- Small button press feedback

Do not animate blur, large shadows, every card on page load, or continuous decorative elements. Respect `prefers-reduced-motion` globally.

## Application shell

Use a slim sticky horizontal navigation:

```text
Payment Desk | Today | Ledger | Review 15 | Payees | Activity | Reports | System
```

- The active item should be obvious but compact.
- Do not repeat the page name as a large content heading immediately below navigation.
- Review should display the actionable count.
- Page-specific actions such as Export, Refresh, and Print belong in a compact content toolbar.
- The main content should begin close to the navigation rather than below a large empty banner.

Use real URL routes so refresh, back/forward navigation, and deep links work:

```text
/
/ledger
/ledger/:transactionId
/review
/payees
/payees/:payeeId
/activity
/reports
/system
```

## Today page

The command surface is the visual and functional hero.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ₹  Payee, amount, date, method, purpose…                         Enter ↵  │
├────────────────────────────────────────────────────────────────────────────┤
│ Payee suggestions or parsed transaction preview                           │
├────────────────────────────────────────────────────────────────────────────┤
│ Recent/favourite payees                                                    │
└────────────────────────────────────────────────────────────────────────────┘

┌ Total outgoing ┐ ┌ Cash ┐ ┌ Digital ┐ ┌ Needs review ┐

┌ Recent payments ────────────────────────────────┬ Today status ────────────┐
│ Clickable transaction rows                      │ Operational facts        │
└─────────────────────────────────────────────────┴──────────────────────────┘
```

### Dynamic payee autocomplete

- Suggestions update while the operator types.
- Exact prefix matches rank before fuzzy matches.
- Search names and aliases through Fuse.js.
- Recent/frequent payees receive a small deterministic ranking boost.
- Highlight matching text.
- Arrow Up/Down changes the active suggestion.
- Tab accepts the suggestion and leaves the input ready for the amount.
- Enter records only when the parsed transaction is valid.
- Escape closes the suggestion layer.
- Do not show irrelevant fuzzy matches merely to fill the list.
- Free-form unknown payee names must remain possible.

Use shadcn/Base UI Autocomplete or compose the accessible behavior from its primitives. Do not implement an inaccessible custom listbox.

### Parsing and preview

The existing backend parser remains authoritative. The preview must clearly expose:

- Payee
- Amount in Indian formatting
- Transaction date
- 12-hour time
- Payment method
- Category
- Purpose/note
- New-payee state
- Review state

Cash is the default unless another method is explicit. Preserve support for Indian amounts and dates already implemented by the backend.

### Detailed and batch entry

- Detailed entry opens in a right-side shadcn Drawer.
- Batch entry uses a large Dialog or Drawer with responsive grid rows.
- Batch rows default to Cash.
- No horizontally clipped 1200 px table.
- Backdated dates remain supported.
- Save validation must be explicit and focus the first invalid field.

## Ledger

Build the ledger with shadcn Table markup, TanStack React Table, and server-side pagination.

Required behavior:

- Sorting
- Date filtering
- Text search
- Review and void filters
- Saved/common views
- Server pagination
- Column visibility where useful
- Sticky header
- Tabular, right-aligned amounts
- Entire rows are clickable
- Selected row state
- Keyboard row navigation
- Empty results state
- CSV export

Clicking a transaction opens a right-side, optionally resizable details drawer containing its full note and audit history. Deep-link selection through `/ledger/:transactionId`.

Never render thousands of rows into the DOM. Use pagination and add TanStack Virtual only where it materially improves a real long list.

## Review inbox

Treat Review as an operational inbox, not another ledger filter.

- Show why each item requires review.
- Allow category selection per transaction; payee defaults must never incorrectly force every payment for that payee into the same category.
- Allow verification of automatically created payees.
- Provide safe bulk actions only when their meaning is unambiguous.
- Updating one field must not alter unrelated transaction fields.
- The navigation count updates after each resolution.

## Payees

Support:

- People and companies
- Aliases
- Active/inactive state
- Favourite state
- Payment history
- Spend total and average
- Category distribution
- Recent activity
- Similar-name warning
- Add/edit forms

Avoid a permanent short form next to a long directory that creates a large dead column. Prefer a full-width directory with Add/Edit in a Drawer.

## Reports

Lazy-load the Reports route and ECharts implementation. Import only required ECharts modules.

Required reporting experiences:

- Daily, weekly, and monthly totals
- Cash versus digital
- Category totals and average transaction per category
- Payee concentration
- Largest payments
- Repeated payments
- Unusually high spending
- Period-over-period comparison
- CSV export
- Printable summary

Chart rules:

- Render a trend chart only when at least two time buckets exist.
- For one bucket, use a single comparison bar or direct textual summary.
- Never render a large meaningless area rectangle.
- Category colors must be distinguishable.
- Performance bars must be thick enough to compare visually.
- Tooltips use Indian currency formatting.
- Chart selection should cross-highlight the corresponding table when useful.

## Modern interaction features

Implement when stable and useful:

- `Ctrl+K` command palette
- `/` focuses quick entry
- `G` then `T/L/R/P` navigation chords
- `J`/`K` row navigation
- `Enter` opens selected row
- `Escape` closes the topmost layer
- Optimistic list insertion through React Query, reconciled with the server response
- CSS View Transitions as progressive enhancement
- Container-query responsive components
- URL-backed filter and detail state
- Locally remembered density preference

Shortcuts should appear in tooltips or a help overlay, not as permanent noisy labels across the interface.

## shadcn/ui usage

Initialize shadcn through its current Vite and monorepo workflow, using Base UI as the component foundation. Components are owned source code and should be customized.

Likely components:

- Alert Dialog
- Autocomplete
- Badge
- Button
- Calendar
- Checkbox
- Command
- Context Menu
- Dialog
- Drawer
- Dropdown Menu
- Field
- Input and Input Group
- Menubar
- Pagination
- Popover
- Scroll Area
- Select
- Separator
- Sheet
- Skeleton
- Sonner
- Table
- Tooltip

Do not add every registry component in advance. Add a component only when a screen uses it.

Do not use the repetitive default pattern of Card + CardHeader + CardDescription for every block. Compose dedicated Payment Desk components from the shadcn primitives.

## Performance budget

The target is a Windows 10 PC with an i3-9100F and 4 GB RAM.

- One production Node process only.
- Hono serves the React static build and API.
- No SSR runtime is needed.
- No separate frontend server in production.
- Lazy-load routes other than Today.
- Lazy-load ECharts and Motion-heavy components.
- Avoid broad barrel imports when they prevent tree shaking.
- Keep Today free from chart dependencies.
- Bound React Query cache retention and result sizes.
- Use server-side pagination.
- Avoid expensive blur and large paint effects.
- Measure the production bundle by route.
- React Scan and Devtools must not ship to production.

Establish and document actual bundle budgets after the first production build rather than inventing thresholds without measurement.

## Migration sequence

### Stage 1 — Parallel foundation

1. Create `apps/web-react`.
2. Configure React, Vite, TypeScript, Tailwind, shadcn/Base UI, linting, tests, and aliases.
3. Create tokens, typography, application shell, routing, API client, Query client, error boundary, and Sonner host.
4. Verify a production build that Hono can serve from an alternate build path without switching the live app.

### Stage 2 — Today quality benchmark

1. Port dashboard API data.
2. Build the command surface and autocomplete.
3. Build parsed preview, new-payee confirmation, and save behavior.
4. Build detailed and batch entry.
5. Build summary metrics and recent transactions.
6. Capture and inspect 1920×1080 and 1366×768 screenshots.

Do not continue blindly if Today still resembles a generic dashboard. Correct the visual system here first because every later screen inherits it.

### Stage 3 — Operations

1. Port Ledger.
2. Port transaction detail/edit/void/audit drawer.
3. Port Review inbox.
4. Port Payees and payee profile.
5. Port Activity and System utilities.

### Stage 4 — Reports

1. Port report controls and tabular summaries.
2. Add lazy ECharts visualizations.
3. Implement single-bucket fallbacks and chart/table interactions.
4. Verify print and CSV workflows.

### Stage 5 — Cutover

1. Run focused unit, integration, and Playwright workflows.
2. Run production build and loopback smoke test.
3. Verify no route loads from the internet.
4. Verify Hono still binds only to `127.0.0.1`.
5. Switch Hono static output from the Svelte build to the React build.
6. Keep the Svelte source as a rollback until the user approves the React application.
7. Remove Svelte dependencies only in a later explicit cleanup step.

## Required verification

At minimum verify:

1. Health endpoint and static SPA serving.
2. Known payee autocomplete and Tab selection.
3. Unknown longer payee names do not resolve to partial aliases.
4. Cash default and explicit UPI/bank/cheque overrides.
5. Indian amounts including `k`, `l`, and `lakh` forms.
6. Backdated formats such as `3-jan`, `3-1`, `3-1-2026`, and slash variants.
7. New-payee creation and Review routing.
8. Manual entry and atomic batch entry.
9. Ledger filtering, pagination, details, correction, and void flow.
10. Audit history remains visible and immutable.
11. Review resolution changes only intended fields.
12. Reports with zero, one, and multiple time buckets.
13. Offline operation with no external resource requests.
14. 1920×1080 and 1366×768 layouts without horizontal page overflow.
15. Keyboard focus order, Escape behavior, and reduced motion.
16. Production build, RAM-sensitive route splitting, and local smoke test.

Do not create large quantities of test data or run excessive browser suites. Use focused tests proportional to the migration risk.

## Completion report

When the React implementation is complete, report:

- Files created and changed
- Exact packages and versions installed
- Important commands executed
- Routes migrated
- Existing functionality preserved
- Tests and screenshots performed
- Production build result
- Bundle sizes by important route
- Performance decisions for the 4 GB target
- Known limitations
- Remaining cleanup before removing Svelte
- Exact development command
- Exact production build command
- Exact local production start command

## Final quality bar

The result is accepted only when it is:

- Faster to understand than the current interface
- Faster to operate with a keyboard
- Visually distinctive from default shadcn
- Dense without becoming cramped
- Clear about parsed versus saved financial data
- Safe around review, correction, and void operations
- Fully local and offline
- Smooth on the target Windows PC
- Built without changing the core database or business logic
