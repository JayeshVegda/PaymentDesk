# Payment Desk — Dedicated Reports Page Build Specification

> **Purpose:** This document is an implementation brief for an AI coding tool.
>
> Build a single high-quality **Reports** page for the existing Payment Desk React application.
> The page must be optimized for quickly understanding cash outflow, business spending, categories, payees, and individual payments.
>
> **Do not create multiple report pages for this task.** Everything should live on one dedicated, interactive report page.

---

## 1. Product Goal

The report page must answer these questions in this order:

1. **How much money went out?**
2. **How much of that was actual business operating spend?**
3. **Where did the money go?**
4. **When did it go out?**
5. **Who received it?**
6. **Which exact transactions caused those numbers?**
7. **Is anything waiting for review?**

The page should feel like a polished financial control panel, not a collection of unrelated charts.

The visual hierarchy must be:

**Filters → KPI summary → time trend → spending breakdown → payee ranking → transaction detail**

---

# 2. Existing Database Context

The existing SQLite database contains these relevant tables:

- `transactions`
- `payees`
- `categories`
- `payment_methods`
- `transaction_audit`

Important transaction fields:

```text
transactions.id
transactions.transaction_date
transactions.transaction_time
transactions.payee_id
transactions.amount_paise
transactions.category_id
transactions.payment_method_id
transactions.note
transactions.source
transactions.status
transactions.needs_review
transactions.created_at
transactions.updated_at
transactions.version
```

Relevant relationships:

```text
transactions.payee_id          -> payees.id
transactions.category_id       -> categories.id
transactions.payment_method_id -> payment_methods.id
transaction_audit.transaction_id -> transactions.id
```

Amounts are stored as **paise integers**.

Never perform financial calculations using JavaScript floating-point source values from the database.

Use integer paise for source calculations where practical, and convert only for presentation:

```ts
amountRupees = amountPaise / 100
```

Only normal posted transactions should contribute to headline cash-outflow metrics unless a specific report explicitly says otherwise:

```text
status = 'posted'
```

---

# 3. Reporting Classification

The database is primarily a **cash-out ledger**, not a pure accounting-expense ledger.

Therefore **Total Cash Outflow** and **Business Operating Spend** must be separate metrics.

Create a reporting classification named `reportGroup`.

## Business Operating

These are normal business operating expenses:

```text
Raw Material
Tools
Supplies
Repairs
Wages
Outside Work
Power & Fuel
Transport
Packing
Factory Expense
Office Expense
Tax & Fees
```

## Business Capital

```text
Machines
```

## Advance / Unsettled

```text
Advance
```

## Investment / Asset Transfer

```text
Investment
```

The database category note explicitly states that Investment is not a normal expense.

## Personal / House

```text
Construction
Home Expense
```

## Important Rule

Do **not** mix the following into the main `Business Operating Spend` KPI:

- Investment
- Construction
- Home Expense
- Machines
- Advance

They still count in **Total Cash Outflow** because cash actually left the payment desk.

Long term, prefer storing `report_group` or `accounting_treatment` directly on categories. Until then, centralize this mapping in one backend/reporting function or SQL expression. Do **not** duplicate the mapping independently across multiple frontend components.

---

# 4. Recommended React Stack

Use the existing application architecture where possible. Do not rewrite the entire application just for this page.

Prefer external, mature components over building generic UI primitives manually.

## Primary UI System — shadcn/ui

Use **shadcn/ui** as the primary component system.

Use existing project shadcn components when already installed. Add only missing components.

Recommended components:

```text
Card
Button
Badge
Select
Popover
Calendar
Command
DropdownMenu
Tooltip
Skeleton
Alert
Sheet
Progress
Separator
Table
ScrollArea
```

Use shadcn's existing dashboard patterns as inspiration, but implement this page specifically for Payment Desk.

Do not create hand-built replacements for:

- dropdowns
- popovers
- calendars
- searchable comboboxes
- tooltips
- sheets/drawers
- skeleton loaders
- alert/status UI

## Styling — Tailwind CSS

Use the existing Tailwind setup.

If the project uses modern Vite + Tailwind, use the current Tailwind Vite integration rather than introducing a second CSS framework.

Do not install Bootstrap.

Do not combine multiple full design systems such as:

```text
shadcn + MUI + Ant Design
```

Choose one primary UI system.

For this project, prefer **shadcn + Tailwind**.

---

# 5. Charts — Recharts

Use **Recharts v3-compatible APIs** for charts.

Do not manually draw:

- SVG bars
- canvas charts
- line graphs
- chart axes
- tooltips
- legends

Use Recharts.

Use the shadcn chart wrapper only if the installed shadcn version is compatible with the project's installed Recharts version.

If there is a compatibility mismatch, use Recharts directly and style the chart container to match shadcn cards.

Required chart components will primarily come from:

```ts
LineChart
BarChart
ResponsiveContainer
XAxis
YAxis
CartesianGrid
Tooltip
Bar
Line
ReferenceLine
```

Avoid adding another chart library unless there is a feature Recharts genuinely cannot support.

Do not install Chart.js, ApexCharts, ECharts, MUI Charts, and Recharts together.

---

# 6. Transaction Table — TanStack Table

Use:

```text
@tanstack/react-table
```

Do not manually implement table state logic.

TanStack Table should own:

- sorting
- pagination
- column visibility
- row model
- filtering hooks where useful
- header rendering
- table state

Use shadcn `<Table>` components for the visual markup and TanStack Table for behavior.

Recommended transaction columns:

```text
Date
Payee
Category
Note
Method
Amount
```

Optional hidden/detail fields:

```text
Time
Source
Status
Needs Review
Version
Transaction ID
```

Default sorting:

```text
transaction_date DESC
transaction_time DESC
```

Amount must be right-aligned.

Do not expose technical IDs in the default visible table.

---

# 7. Server-State / Data Fetching — TanStack Query

Use:

```text
@tanstack/react-query
```

Use TanStack Query for:

- loading report data
- caching
- refreshing after a transaction changes
- query keys based on report filters
- error handling
- stale/fresh behavior

Do not build a custom global fetching/cache layer.

Example query-key concept:

```ts
[
  "reports",
  "payment-overview",
  {
    from,
    to,
    reportGroup,
    categoryId,
    payeeId,
  },
]
```

If the report is local/offline-first, avoid aggressive unnecessary polling.

A small stale time is acceptable, for example 30–120 seconds, but invalidate the report query immediately after transaction create/edit/delete/correction operations.

---

# 8. Other Recommended Libraries

## Icons

Use:

```text
lucide-react
```

Suggested icons:

```text
IndianRupee
WalletCards
Factory
PackageOpen
ReceiptIndianRupee
Users
CalendarDays
AlertTriangle
CircleCheck
Search
Filter
ChevronRight
ArrowUpDown
RefreshCw
```

Do not mix multiple icon packs.

## Notifications

Use:

```text
sonner
```

Use only for meaningful actions/errors, such as:

- report refresh failed
- transaction update succeeded
- export failed

Do not toast normal filtering actions.

## Dates

Prefer the existing shadcn Calendar/Date Picker implementation.

For formatting and date calculations, use the project's existing date library. If there is none, use:

```text
date-fns
```

Do not manually implement date-range calendar logic.

---

# 9. What NOT to Add

Avoid unnecessary dependencies.

Do not install a new library for something already handled well by:

- shadcn/ui
- Recharts
- TanStack Table
- TanStack Query
- Lucide
- date-fns
- the browser's `Intl` APIs

Avoid adding:

```text
Redux
MobX
Chart.js
ApexCharts
MUI
Ant Design
Bootstrap
Moment.js
Lodash
```

unless the existing application already relies on one of them and replacing it would make the code worse.

For this single report page, React state + URL state + TanStack Query is sufficient.

---

# 10. Page Route

Use the application's existing routing system.

Recommended route:

```text
/reports
```

Page title:

```text
Reports
```

Subtitle:

```text
Payment & Cash Outflow
```

Do not create a separate route for category, payee, or raw material analysis yet.

Those views should be achieved through interactive filters on the same report page.

---

# 11. Overall Desktop Layout

Use a responsive 12-column grid.

Recommended content width:

```text
max-width: 1500–1600px
```

Center it within the application content area.

Recommended page padding:

```text
24px desktop
16px tablet
12–16px mobile
```

Layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ PAGE HEADER + FILTERS                                        │
└──────────────────────────────────────────────────────────────┘

┌─────────┬─────────┬─────────┬─────────┐
│ KPI     │ KPI     │ KPI     │ KPI     │
│ 3 cols  │ 3 cols  │ 3 cols  │ 3 cols  │
└─────────┴─────────┴─────────┴─────────┘

┌──────────────────────────────────────┬───────────────────────┐
│ CASH OUTFLOW TREND                   │ OUTFLOW TYPE          │
│ 8 cols                               │ 4 cols                │
└──────────────────────────────────────┴───────────────────────┘

┌────────────────────────────────┬─────────────────────────────┐
│ SPEND BY CATEGORY              │ TOP PAYEES                  │
│ 7 cols                         │ 5 cols                      │
└────────────────────────────────┴─────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ TRANSACTION TABLE                                            │
│ 12 cols                                                      │
└──────────────────────────────────────────────────────────────┘
```

Mobile:

```text
all cards/charts -> single column
```

Tablet:

```text
KPI cards -> 2 columns
major charts -> stack where needed
```

---

# 12. Header

Use a compact header.

Left:

```text
Reports
Payment & Cash Outflow
```

Right:

```text
Last updated 1:25 PM
Refresh icon button
```

Do not make the page title oversized.

Approximate hierarchy:

```text
Page title: 22–26px, semibold
Subtitle: 13–14px, muted
```

Use the existing application typography rather than introducing another font.

---

# 13. Global Filter Bar

Place filters directly beneath the heading.

Recommended filters:

1. Date Range
2. Report Group
3. Category
4. Payee

Optional later:

5. Payment Method

Keep the default row compact.

Example:

```text
[ This Month ▾ ] [ All spending ▾ ] [ All categories ▾ ] [ All payees ▾ ]
```

## Date Range

Use a shadcn Date Picker/Calendar inside a Popover.

Provide quick presets:

```text
Today
Yesterday
This Week
This Month
Last Month
Last 30 Days
Custom
```

Default:

```text
This Month
```

When Custom is selected, allow date-range selection.

## Category

There are a small number of categories, so shadcn Select is acceptable.

## Payee

Use a **searchable combobox**:

```text
Popover + Command
```

Do not use a plain select once the payee list grows.

## Report Group

Options:

```text
All spending
Business Operating
Business Capital
Advance / Unsettled
Investment / Asset Transfer
Personal / House
```

## Filter Behavior

All cards, charts, ranking lists, and transaction tables must use the same active filters.

Do not let individual widgets silently use different date ranges.

---

# 14. Persist Filters in the URL

If the current router supports search params, store report filters in URL query parameters.

Example:

```text
/reports?range=this-month&group=business-operating&category=18&payee=12
```

Benefits:

- refresh preserves filters
- browser back/forward works
- report states can be bookmarked
- filtered report URLs can be shared internally

Do not introduce a global state library solely for report filters.

---

# 15. KPI Row

Use **4 KPI cards**.

Do not fill the page with 8–12 small KPI cards.

Each KPI card should contain one primary number and at most one or two short contextual values.

Use shadcn `<Card>`.

Recommended consistent card height:

```text
110–130px
```

## KPI 1 — Total Outflow

Label:

```text
Total Outflow
```

Large value:

```text
₹31.32L
```

Secondary text:

```text
15 payments
```

Definition:

```text
SUM(amount_paise)
WHERE status = 'posted'
AND active filters
```

This is the hero metric.

---

## KPI 2 — Business Spend

Label:

```text
Business Spend
```

Large value:

```text
₹XX.XXL
```

Secondary:

```text
Operating only
```

Definition:

```text
posted transactions
AND reportGroup = Business Operating
```

Do not include Investment, Construction, Home Expense, Advance, or Machines.

---

## KPI 3 — Raw Material

Label:

```text
Raw Material
```

Large value:

```text
₹29.44L
```

Secondary:

```text
94.0% of outflow
```

If Raw Material is filtered out by another category filter, either:

- adapt this card to the selected context, or
- hide/replace it with a context-appropriate metric.

Do not show a meaningless zero Raw Material card while the user intentionally filters to Wages.

A good rule is:

- default/unfiltered view -> Raw Material KPI
- category-filtered view -> Average Payment or Largest Payment KPI

---

## KPI 4 — Payments

Label:

```text
Payments
```

Large value:

```text
15
```

Secondary:

```text
₹XX,XXX average
```

If `needs_review > 0`, show a compact warning badge:

```text
3 need review
```

If zero:

```text
No review pending
```

Do not make "Needs Review" its own permanent KPI card unless review volume becomes operationally important.

---

# 16. KPI Card Visual Design

Use restrained styling.

Recommended:

```text
border: subtle
radius: 10–12px
padding: 16–20px
shadow: none or extremely subtle
background: normal surface/card token
```

Do not use:

- gradients
- neon colors
- oversized icons
- giant shadows
- colored background for every KPI
- decorative mini charts with no analytical purpose

Icons may be small and muted.

Numbers should dominate the card.

Typography:

```text
KPI label: 12–14px, medium, muted
KPI number: 26–32px, semibold/bold
Context: 12–13px, muted
```

---

# 17. Money Formatting

Use Indian number formatting.

Exact amounts in table/tooltips:

```text
₹31,32,500
₹2,50,000
₹18,750
```

Use:

```ts
new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})
```

For large KPI values, use compact Indian display:

```text
₹31.32L
₹1.20Cr
₹84.5k
```

Create one shared `formatCompactINR()` helper.

Do not implement slightly different currency formatting in every component.

---

# 18. Section 1 — Cash Outflow Over Time

This is the **largest chart**.

Grid width:

```text
8 / 12 columns
```

Approximate height:

```text
300–340px
```

Card title:

```text
Cash Outflow Over Time
```

Subtitle should show current grain/range, for example:

```text
Daily cash outflow · 1–31 Aug
```

## Chart Type Logic

For sufficiently rich time-series history:

```text
Line chart
```

For very sparse data with only a few active dates:

```text
Column / vertical bar chart
```

Suggested automatic rule:

```text
< 8 meaningful time points  -> BarChart
>= 8 meaningful time points -> LineChart
```

Do not draw a misleading two- or three-point line and imply a trend.

## Aggregation Grain

Suggested:

```text
<= 45 day range     -> daily
46–180 day range    -> weekly
> 180 day range     -> monthly
```

The backend should return the correct aggregation rather than the client fetching all transactions and grouping thousands of rows.

## Line Chart

Use:

```text
Recharts LineChart
```

Data:

```ts
type TrendPoint = {
  period: string
  totalOutflowPaise: number
  paymentCount: number
  businessOperatingPaise: number
}
```

Primary plotted series:

```text
Total Outflow
```

Do not plot 5 lines by default.

Optionally add Business Operating as a second line later if it materially helps.

## Tooltip

Tooltip should show:

```text
9 Aug 2026

Total Outflow     ₹3,82,500
Business Spend    ₹3,40,000
Payments          4
```

Use a custom Recharts tooltip component styled to match shadcn.

## Axis Design

Keep axes quiet.

- subtle horizontal grid
- no unnecessary vertical grid
- compact rupee values on Y axis
- readable dates on X axis
- do not rotate labels unless absolutely necessary

---

# 19. Section 2 — Outflow Type

Place beside the trend.

Grid width:

```text
4 / 12 columns
```

Card title:

```text
Outflow Type
```

This section explains the difference between:

```text
Business Operating
Business Capital
Investment
Advance
Personal / House
```

Do not use a pie chart by default.

Preferred design:

## Ranked compact progress rows

Use shadcn Progress or a simple Recharts horizontal bar.

Example:

```text
Business Operating
₹29.8L                                   95%
████████████████████████████████

Investment
₹80k                                     2.6%
██

Personal / House
₹45k                                     1.4%
█
```

Show:

```text
group name
amount
share of total
visual bar
```

Sort by amount descending.

If there are many zero-value groups, hide zero rows.

---

# 20. Section 3 — Spend by Category

Grid width:

```text
7 / 12 columns
```

Card title:

```text
Spend by Category
```

Use a:

```text
horizontal BarChart
```

Do not use a vertical column chart because category labels are longer.

Example visual:

```text
Raw Material      ███████████████████████  ₹29.44L
Investment        ███                         ₹80k
Construction      ██                          ₹45k
Wages             █                           ₹25k
Transport         ▍                            ₹8k
```

## Visible Rows

Show:

```text
Top 6 categories
```

If fewer exist, show all.

Provide:

```text
View all
```

only if useful.

If View all is needed, use a Sheet or Dialog rather than navigating to another report page.

## Tooltip

Show:

```text
Raw Material

₹29,44,000
8 payments
94.0% of outflow
Average ₹3,68,000
```

## Click Interaction

Clicking a category bar should apply that category as a global report filter.

Example:

```text
Category: Raw Material ×
```

All KPI cards, charts, payees, and transactions should refresh under the new filter.

This is a core interaction.

---

# 21. Section 4 — Top Payees

Grid width:

```text
5 / 12 columns
```

Card title:

```text
Top Payees
```

Prefer a ranked list with compact progress bars instead of another full axis-heavy chart.

Example:

```text
1  ABC Metals
   ₹8,40,000                              26.8%
   ███████████████████

2  XYZ Brass
   ₹5,25,000                              16.7%
   ████████████

3  Supplier C
   ₹3,70,000                              11.8%
   █████████
```

Show top:

```text
5 payees
```

Each row should include:

```text
rank
payee name
amount
share
mini/progress bar
```

Optional secondary text:

```text
3 payments
```

## Click Interaction

Clicking a payee applies it as the global Payee filter.

Example filter state:

```text
Category: Raw Material ×
Payee: ABC Metals ×
```

Do not navigate to another page.

---

# 22. Cross-Filtering

This is one of the most important UX features.

The dedicated report page should behave like an exploratory dashboard.

Interactions:

```text
click category -> set category filter
click payee -> set payee filter
click "needs review" -> filter transactions to needs_review
```

Active filters should appear as removable badges/chips.

Example:

```text
Raw Material ×
ABC Metals ×
```

Include:

```text
Clear all
```

when multiple filters are active.

Do not hide active filter state.

---

# 23. Bottom Section — Transaction Table

Full width:

```text
12 / 12 columns
```

Card title:

```text
Transactions
```

Subtitle:

```text
Payments matching the current report filters
```

Use:

```text
TanStack Table + shadcn Table
```

Default visible columns:

| Column | Behavior |
|---|---|
| Date | readable local date |
| Payee | text |
| Category | badge or plain text |
| Note | truncated with tooltip when long |
| Method | compact badge/text |
| Amount | right aligned, tabular numbers |

Default sort:

```text
newest first
```

## Amount

Use:

```css
font-variant-numeric: tabular-nums;
text-align: right;
```

## Pagination

Use server-side or bounded pagination.

Recommended default:

```text
20 rows per page
```

Options:

```text
20
50
100
```

Do not load every historical transaction just to render the first page.

## Row Click

Clicking a transaction row should open a shadcn:

```text
Sheet
```

or existing application transaction-details UI.

Sheet content:

```text
Amount
Payee
Category
Date
Time
Payment Method
Note
Status
Needs Review
Source
Version
```

If audit history exists, show it below in the Sheet as a secondary section.

Do not clutter the main table with audit details.

---

# 24. Review / Exception Behavior

Do not dedicate a large permanent chart to review state.

If there are no issues:

```text
✓ No review pending
```

Use a quiet success treatment.

If issues exist:

```text
⚠ 3 payments need review
```

Use a warning Badge/Alert.

Clicking the warning should filter the transaction table to review items.

Possible review definition:

```text
needs_review = 1
OR status != 'posted'
```

Use the existing application business rules if they differ.

---

# 25. Loading States

Use shadcn Skeleton.

Do not show an empty white dashboard while data loads.

Loading pattern:

```text
KPI -> rectangular number skeleton
chart -> full card skeleton
ranking -> 4–5 row skeleton
table -> row skeletons
```

Avoid a single giant spinner for the whole page.

If filters change and cached data exists, keep the current layout visible while refreshing where possible.

TanStack Query should support this behavior.

---

# 26. Empty States

Each section needs a deliberate empty state.

Examples:

## Entire date range has no payments

```text
No payments found
Try a different date range or clear filters.
```

## No payees in current filter

```text
No payees match this selection.
```

## No category data

```text
No category spending for this period.
```

Do not render broken axes or `NaN%`.

---

# 27. Error States

If report data fails to load:

Use shadcn Alert.

Show:

```text
Unable to load report data.
[Try again]
```

Do not show raw stack traces to the normal user.

Use Sonner only for transient errors after an action.

---

# 28. Backend / API Design

Do not fetch every transaction into React and calculate the whole report in the browser.

Perform aggregations in SQLite/backend.

Prefer one overview endpoint plus a paginated transactions endpoint.

Example conceptual APIs:

```text
GET /api/reports/payment-overview
GET /api/reports/transactions
```

Common query params:

```text
from
to
reportGroup
categoryId
payeeId
paymentMethodId
needsReview
```

## Overview Response Shape

Recommended contract:

```ts
type PaymentReportOverview = {
  range: {
    from: string
    to: string
    grain: "day" | "week" | "month"
  }

  kpis: {
    totalOutflowPaise: number
    businessOperatingPaise: number
    rawMaterialPaise: number
    paymentCount: number
    averagePaymentPaise: number
    needsReviewCount: number
  }

  trend: Array<{
    period: string
    totalOutflowPaise: number
    businessOperatingPaise: number
    paymentCount: number
  }>

  outflowGroups: Array<{
    group: string
    amountPaise: number
    transactionCount: number
  }>

  categories: Array<{
    categoryId: number
    categoryName: string
    amountPaise: number
    transactionCount: number
  }>

  payees: Array<{
    payeeId: number
    payeeName: string
    amountPaise: number
    transactionCount: number
  }>

  meta: {
    generatedAt: string
  }
}
```

Frontend should compute percentages from the returned group/category totals only when safe, or backend may return them.

All denominator rules must remain consistent.

---

# 29. SQL / Aggregation Principles

Use database-side aggregation.

Examples conceptually:

```sql
SUM(amount_paise)
COUNT(*)
GROUP BY transaction_date
GROUP BY category_id
GROUP BY payee_id
```

Always apply the same filter predicate to all dashboard aggregates.

Centralize filtering.

Do not let one KPI use `status='posted'` while another accidentally includes voided/non-posted rows.

Use indexed columns where appropriate if transaction volume grows.

Potential useful indexes to check before adding new ones:

```text
transactions.transaction_date
transactions.payee_id
transactions.category_id
transactions.status
transactions.needs_review
```

Do not add duplicate indexes without checking the existing schema.

---

# 30. Responsive Behavior

## Desktop >= 1200px

```text
4 KPI cards in one row
Trend 8 cols / Outflow type 4 cols
Category 7 cols / Payees 5 cols
Table full width
```

## Tablet

```text
KPI cards: 2 x 2
Trend: full width
Outflow type: full width or 5/7 split if space permits
Category / Payees: stack
```

## Mobile

```text
single column
filters become horizontally scrollable or compact popovers
KPI cards can use 2 columns if >= 420px
charts full width
table hides Note/Method if necessary
row click still opens details
```

Do not force desktop chart widths onto mobile.

Use Recharts ResponsiveContainer.

---

# 31. Visual Language

The dashboard should look:

```text
clean
financial
calm
dense enough for desktop work
professional
modern
not decorative
```

## Surfaces

Use:

```text
subtle card border
neutral surface
small radius
minimal shadow
```

Avoid:

```text
glassmorphism
gradient backgrounds
glowing borders
neumorphism
huge drop shadows
3D charts
```

---

# 32. Color Strategy

Do not assign a completely different bright color to every category.

Use a restrained palette.

Recommended semantic use:

```text
Primary accent     -> normal business data
Muted neutral      -> personal/non-business/context
Amber/orange       -> needs review / warning
Red                -> error / voided / destructive
Green              -> resolved/success status only
```

For category bar charts, one accent color is sufficient.

For outflow-group composition, use restrained differentiated colors only if necessary.

Charts must remain understandable even without relying entirely on color.

---

# 33. Chart Rules

## Use Line Chart For

```text
movement over time
```

## Use Vertical Bar For

```text
sparse daily period totals
```

## Use Horizontal Bar For

```text
category ranking
```

## Use Ranked List + Progress For

```text
top payees
outflow group composition
```

## Use KPI Number For

```text
total outflow
business spend
raw material amount
payment count
```

## Use Table For

```text
exact transaction lookup
```

## Do Not Use Pie Chart on Main Page

Raw Material is likely to dominate the ledger, making smaller slices difficult to compare.

A sorted horizontal bar or compact composition list is more useful.

---

# 34. Chart Interaction

All charts should have:

```text
hover tooltip
keyboard/focus accessibility where supported
clear labels
responsive width
loading state
empty state
```

Category chart:

```text
click bar -> filter category
```

Payee list:

```text
click row -> filter payee
```

Trend chart:

A click does not need to filter unless there is a clear UX. Hover is enough for v1.

Do not add zoom/pan for this report unless the actual dataset later requires it.

---

# 35. Number Precision

Dashboard cards:

```text
₹31.32L
₹84.5k
₹1.20Cr
```

Tooltips/table:

```text
₹31,32,500
₹84,500
₹1,20,00,000
```

Percentages:

```text
94.0%
2.6%
```

Counts:

```text
15
```

Do not show:

```text
₹31.320000L
94.027183%
```

---

# 36. Accessibility

Use external components' accessibility features rather than recreating them.

Requirements:

- all dropdowns keyboard accessible
- tooltips are not the only source of essential information
- buttons have accessible names
- chart colors meet reasonable contrast
- active filter state is visible in text
- warning state is not indicated by color alone
- focus outlines remain visible
- table headers use proper semantic markup

Do not remove focus rings globally.

---

# 37. Performance

The Payment Desk report should feel instant on a local workstation.

Rules:

- aggregate on backend
- paginate transactions
- cache overview with TanStack Query
- memoize expensive frontend transformations only when necessary
- do not overuse `useMemo`
- do not fetch chart data separately if one overview response can supply it
- use stable query keys
- avoid unnecessary dashboard polling
- invalidate after payment changes

Lazy-load the Reports route if the application already uses route-level code splitting.

---

# 38. Suggested React Component Structure

Do not put the entire dashboard in one 1,000-line component.

Suggested structure:

```text
src/
  features/
    reports/
      api/
        report-api.ts
        report-queries.ts

      components/
        ReportHeader.tsx
        ReportFilters.tsx
        ActiveFilterChips.tsx

        KpiGrid.tsx
        KpiCard.tsx

        CashOutflowTrend.tsx
        OutflowTypeCard.tsx
        CategorySpendChart.tsx
        TopPayeesCard.tsx

        TransactionsTable.tsx
        TransactionDetailSheet.tsx

        ReportEmptyState.tsx
        ReportErrorState.tsx

      lib/
        report-groups.ts
        report-filter-state.ts
        format-inr.ts

      types/
        report-types.ts

      PaymentReportsPage.tsx
```

Adapt paths to the current project conventions.

Do not reorganize unrelated areas of the application.

---

# 39. Component Responsibilities

## `PaymentReportsPage`

Owns:

```text
page composition
active report filter state
query orchestration
cross-filter callbacks
```

Should not contain chart drawing logic.

## `ReportFilters`

Owns:

```text
date selector
report-group selector
category selector
payee combobox
clear filters
```

## `KpiGrid`

Pure presentation from KPI data.

## `CashOutflowTrend`

Receives already aggregated trend points.

It decides only:

```text
BarChart vs LineChart based on point density
```

It must not query SQLite itself.

## `CategorySpendChart`

Receives sorted category summary.

Emits:

```ts
onCategorySelect(categoryId)
```

## `TopPayeesCard`

Receives ranked payee summary.

Emits:

```ts
onPayeeSelect(payeeId)
```

## `TransactionsTable`

Owns table presentation/state and emits row selection.

## `TransactionDetailSheet`

Displays full transaction detail/audit context.

---

# 40. Filter State Type

Example:

```ts
type ReportFilters = {
  preset:
    | "today"
    | "yesterday"
    | "this-week"
    | "this-month"
    | "last-month"
    | "last-30-days"
    | "custom"

  from?: string
  to?: string

  reportGroup?: ReportGroup
  categoryId?: number
  payeeId?: number
  paymentMethodId?: number

  needsReview?: boolean
}
```

Use one source of truth for filters.

Avoid keeping the same filter independently in:

```text
URL params
component state
TanStack Query state
chart state
```

Derive one from the other.

---

# 41. Active Filter Chips

When drill-down filters are active, show chips below the main filter row.

Example:

```text
Raw Material ×
ABC Metals ×

Clear all
```

Use shadcn Badge/Button.

Do not make the user reopen dropdowns just to discover what is active.

---

# 42. Date/Comparison Future-Proofing

Do not overbuild comparison logic now.

Structure APIs so a later version can add:

```text
vs previous period
vs last month
rolling 7 days
rolling 30 days
```

For now, if there is insufficient history, do not display fake deltas such as:

```text
+0%
```

Simply omit period-over-period comparison.

---

# 43. Raw Material Future Extension

Raw Material is likely the most important business cost category.

The current database does not structurally capture enough detail for material price analytics.

Do **not** parse free-text notes as authoritative material quantities or rates.

Future data model should support fields such as:

```text
material_type
quantity_kg
rate_per_kg
invoice_reference
supplier/payee
```

Once available, the same report page can add a contextual Raw Material section when that category is selected.

Do not implement this speculative UI now unless the fields already exist.

---

# 44. Audit Information

`transaction_audit` should not be a permanent main dashboard chart.

Use it only in transaction detail/review UI.

Potential display in `TransactionDetailSheet`:

```text
Created
Corrected
Voided
Changed at
Change source
Previous values
New values
```

Keep it visually secondary.

---

# 45. Suggested Package Usage

Before installing anything:

1. Inspect the existing `package.json`.
2. Reuse already-installed packages.
3. Do not install duplicate alternatives.
4. Use latest compatible stable versions.
5. Preserve the existing package manager and lockfile.

Expected package families:

```text
react
react-dom

tailwindcss
@tailwindcss/vite                 # if Vite/Tailwind setup needs it

recharts

@tanstack/react-query
@tanstack/react-table

lucide-react
sonner

date-fns                          # only if not already available

shadcn/ui generated components
```

Do not blindly run a giant package-install command before checking the project.

---

# 46. shadcn Components to Add If Missing

Conceptual commands only; use the project's package manager:

```bash
shadcn add card
shadcn add button
shadcn add badge
shadcn add select
shadcn add popover
shadcn add calendar
shadcn add command
shadcn add dropdown-menu
shadcn add tooltip
shadcn add skeleton
shadcn add alert
shadcn add sheet
shadcn add progress
shadcn add separator
shadcn add table
shadcn add scroll-area
```

Do not overwrite customized existing shadcn components without reviewing the diff.

---

# 47. UX Details That Matter

## Keep Card Headers Compact

Do not waste 80px of vertical space on chart titles.

Recommended:

```text
title
one small muted context line
chart
```

## Tooltips

Use financial formatting and meaningful labels.

Bad:

```text
value: 2944000
```

Good:

```text
Raw Material
₹29,44,000
8 payments
94.0% of outflow
```

## Hover/Clickable State

If a category or payee is clickable:

- use pointer cursor
- subtle hover background/highlight
- preserve keyboard accessibility

## Table Row

Row hover should be subtle.

Do not color alternate rows heavily.

---

# 48. Desktop Density

This is a business workstation report, so optimize for useful information density.

Avoid giant SaaS-marketing whitespace.

Recommended approximate vertical rhythm:

```text
page gap: 20–24px
card internal gap: 12–16px
KPI row gap: 12–16px
chart-card padding: 16–20px
table row height: ~44–48px
```

Aim for the user to see:

```text
KPI row
trend row
at least part of category/payee row
```

without excessive scrolling on a normal desktop monitor.

---

# 49. Do Not Build These

Explicitly avoid:

```text
pie chart
radar chart
gauge chart
3D charts
animated counters
confetti
full-screen modals for simple filters
separate dashboard page per category
separate dashboard page per payee
custom table engine
custom date-picker engine
custom chart renderer
custom toast system
custom icon SVG collection
```

The report should remain boring in the best sense: fast, trustworthy, and easy to scan.

---

# 50. Quality / Acceptance Criteria

The task is complete only when all of the following are true.

## Layout

- [ ] One dedicated `/reports` page exists.
- [ ] 4 KPI cards render cleanly.
- [ ] Trend section is 8/12 desktop width.
- [ ] Outflow Type is 4/12 desktop width.
- [ ] Category section is 7/12 desktop width.
- [ ] Top Payees is 5/12 desktop width.
- [ ] Transactions table spans full width.
- [ ] Mobile layout stacks correctly.

## Data

- [ ] All headline metrics use `status='posted'` unless intentionally stated.
- [ ] Total Outflow and Business Operating Spend are separate.
- [ ] Investment is not counted as operating expense.
- [ ] Construction/Home Expense are not counted as operating expense.
- [ ] Machines are separated as Business Capital.
- [ ] Advance is separated from recognized operating spend.
- [ ] Amounts are sourced from integer paise.
- [ ] All widgets use the same filters.

## UX

- [ ] Default date filter is This Month.
- [ ] Payee selector is searchable.
- [ ] Clicking category cross-filters the report.
- [ ] Clicking payee cross-filters the report.
- [ ] Active filters are visible as removable chips.
- [ ] Clear-all action exists.
- [ ] Filters persist in URL where routing supports it.
- [ ] Loading skeletons exist.
- [ ] Empty states exist.
- [ ] Errors have retry UI.

## Charts

- [ ] Recharts is used rather than custom SVG/canvas.
- [ ] Sparse trend data uses bars instead of a misleading line.
- [ ] Rich trend data uses a line.
- [ ] Categories use horizontal bars.
- [ ] No pie chart is used on the main page.
- [ ] Tooltips show INR-formatted values.
- [ ] Charts are responsive.

## Table

- [ ] TanStack Table owns table behavior.
- [ ] Default sort is newest transaction first.
- [ ] Amount is right-aligned.
- [ ] Pagination exists.
- [ ] Row click opens transaction details.
- [ ] Audit/technical fields are not cluttering default columns.

## Code Quality

- [ ] Report logic is split into focused components.
- [ ] Financial formatting is centralized.
- [ ] Report-group mapping is centralized.
- [ ] Backend performs aggregations.
- [ ] Frontend does not load full history to calculate every KPI.
- [ ] Existing app conventions are preserved.
- [ ] No unnecessary design-system/library duplication was introduced.

---

# 51. Final Visual Reference

Target this structure:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Reports                                                       Updated 1:25 │
│ Payment & Cash Outflow                                         [ Refresh ] │
│                                                                             │
│ [ This Month ▾ ] [ All spending ▾ ] [ Category ▾ ] [ Payee ▾ ]            │
│                                                                             │
│ Active: [ Raw Material × ] [ ABC Metals × ]                  [ Clear all ] │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────┐ ┌───────────────────┐ ┌──────────────────┐ ┌────────────┐
│ TOTAL OUTFLOW     │ │ BUSINESS SPEND    │ │ RAW MATERIAL     │ │ PAYMENTS   │
│ ₹31.32L           │ │ ₹XX.XXL           │ │ ₹29.44L          │ │ 15         │
│ 15 payments       │ │ Operating only    │ │ 94.0% of outflow │ │ ₹XXk avg   │
└───────────────────┘ └───────────────────┘ └──────────────────┘ └────────────┘

┌────────────────────────────────────────────┬────────────────────────────────┐
│ CASH OUTFLOW OVER TIME                     │ OUTFLOW TYPE                   │
│ Daily · This month                         │                                │
│                                            │ Business Operating   ₹XX       │
│                  ╭───╮                     │ █████████████████████████       │
│           ╭──────╯   ╰────╮                │ Investment           ₹XX       │
│      ╭────╯               ╰──              │ ██                             │
│ ─────╯                                      │ Personal / House     ₹XX       │
│                                            │ █                              │
└────────────────────────────────────────────┴────────────────────────────────┘

┌───────────────────────────────────┬─────────────────────────────────────────┐
│ SPEND BY CATEGORY                 │ TOP PAYEES                              │
│                                   │                                         │
│ Raw Material ███████████ ₹29.44L │ 1 ABC Metals                  ₹8.40L    │
│ Investment   ██            ₹80k  │   █████████████████████                │
│ Construction █             ₹45k  │ 2 XYZ Brass                   ₹5.25L    │
│ Wages        ▌             ₹25k  │   ██████████████                       │
│ Transport    ▏              ₹8k  │ 3 Supplier C                  ₹3.70L    │
└───────────────────────────────────┴─────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TRANSACTIONS                                                   15 results  │
│                                                                             │
│ Date      Payee            Category        Note           Method    Amount  │
│ 10 Aug    ABC Metals       Raw Material    Brass scrap    Cash    ₹2,50,000│
│ 09 Aug    XYZ Brass        Raw Material    Copper         Cash    ₹1,84,000│
│ 09 Aug    Ramesh           Wages           Casting        Cash      ₹25,000│
│ ...                                                                         │
│                                                        ‹ 1 2 3 ›            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 52. Implementation Priority

Build in this order:

## Phase 1 — Data/API

1. Central report-group mapping.
2. Report filters.
3. Overview aggregation query/API.
4. Paginated transaction query/API.
5. Type definitions.

## Phase 2 — Core UI

1. Page shell.
2. Filter bar.
3. KPI cards.
4. Trend chart.
5. Outflow Type.
6. Category chart.
7. Top Payees.
8. Transaction table.

## Phase 3 — Interaction

1. URL filter persistence.
2. Category cross-filter.
3. Payee cross-filter.
4. Filter chips.
5. Review filter.
6. Transaction detail Sheet.

## Phase 4 — Polish

1. Loading skeletons.
2. Empty states.
3. Error/retry.
4. Responsive layout.
5. Tooltip formatting.
6. accessibility.
7. visual consistency.
8. final reconciliation of all displayed totals.

---

# 53. Final Instruction to the Coding AI

Before changing code:

1. Inspect the existing React project structure.
2. Inspect `package.json` and lockfile.
3. Reuse the existing router, API style, design tokens, shadcn components, and utilities.
4. Inspect the actual database/API implementation before writing report queries.
5. Do not replace working architecture unnecessarily.
6. Do not fabricate transaction fields that do not exist.
7. Do not infer raw-material quantities/rates from free-text notes.
8. Keep all report calculations consistent and traceable.
9. Prefer external components/libraries described above over custom-building common UI primitives.
10. Make the finished report page feel like one coherent financial dashboard, not a demo gallery of components.

**Primary stack recommendation:**

```text
React + TypeScript
existing router
Tailwind CSS
shadcn/ui
Recharts
TanStack Query
TanStack Table
Lucide React
Sonner
date-fns / shadcn Calendar
```

Do not mix in another full UI framework unless the existing project is already built on it.
