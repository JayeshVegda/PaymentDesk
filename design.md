# Payment Ledger — Full Redesign Specification

Reference: One Cashbook (clean small-business accounting UI)
Scope: Complete visual + interaction redesign, ground up
Current app: payee.zayu.dev (7 screens audited: Today, Ledger, Payees, Review, Reports, System, Activity)

---

## 1. Design Principles

1. **Numbers are the interface.** This app exists to show money moving. Every screen should make the amount the loudest thing on it.
2. **Color means direction, never decoration.** Green = cash in / resolved / healthy. Red = cash out / needs attention / destructive. Blue = neutral action/navigation. No other color is used for status.
3. **One primary action per screen.** Today → record a payment. Review → resolve an item. Ledger → find a transaction. Never compete two CTAs of equal visual weight.
4. **Built for repetition, not first impressions.** This is opened 20+ times a day by the same person. Optimize for muscle memory: consistent button positions, keyboard shortcuts, minimal clicks to log a payment.
5. **Non-accountant language.** "Outgoing," "Paid," "Owes you" — not "Debit," "Credit," "AR/AP."

---

## 2. Design Tokens

### Color

| Token | Value | Usage |
|---|---|---|
| `bg-page` | `#F6F8FC` | App background |
| `bg-card` | `#FFFFFF` | Cards, tables, modals |
| `bg-selected` | `#E9F1FF` | Selected nav, active filter chip |
| `border-default` | `#DDE3EC` | 1px card/table borders |
| `text-primary` | `#111827` | Headings, body, amounts |
| `text-secondary` | `#667085` | Labels, helper text, timestamps |
| `brand-blue` | `#165DFF` | Primary buttons, links, nav active, focus ring |
| `success-green` | `#00B96B` | Cash in, resolved, healthy status |
| `danger-red` | `#FF2638` | Cash out, overdue, destructive actions |
| `warning-amber` | `#F79009` | Pending review, needs attention (new — see §2a) |

**2a. Why amber is added:** the original 3-color system (blue/green/red) has no way to represent "pending / needs review" without misusing red (which should mean *outgoing money*, not *problem*). Your Review Inbox and "Pending Reviews" card need a distinct, non-alarming color. Amber fills that gap — matches what you already used instinctively in the current "Review required" badge and Pending Reviews card.

### Spacing (8px base grid)
`4, 8, 16, 24, 32, 40, 48, 64`
— Card padding: 24px (compact cards) / 32px (primary cards)
— Section gaps: 32px
— Table row height: 56px (desktop, comfortable for scanning)

### Radius
- Cards: 14px
- Buttons/inputs: 10px
- Badges/chips: 999px (full pill)

### Shadow
- Card: `0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)`
- Modal/drawer: `0 8px 24px rgba(16,24,40,0.12)`
- No shadow on hover-only elements — keep motion minimal per your original brief.

### Typography (Inter Variable, tabular numbers for all money)

| Style | Size / Weight | Usage |
|---|---|---|
| Page title | 26px / 700 | "Today," "Reports," etc. |
| Section heading | 18px / 650 | Card titles: "Outlay Ledger" |
| Body | 15px / 400–500 | Table cells, descriptions |
| Label | 14px / 500 | Field labels, column headers |
| Helper | 12–13px | Timestamps, sub-labels |
| Stat value (small) | 24px / 700 | Card totals (e.g. "₹37,000") |
| Stat value (hero) | 32px / 700 | Today's total outgoing — the single most important number on the page |

---

## 3. App Shell

**Top nav, not sidebar** (keeping your current pattern — it's correct for a 7-section app; a sidebar would be overkill).

Redesign the nav bar itself:
- i want like bit transparent but compact and standard with radius
- Height:  white background,  bottom border (`border-default`)
- Logo + workspace name, left-aligned,
- Nav items: , `text-secondary` default, `text-primary` + `bg-selected` pill (radius, not just bold text) when active — right now "active" is just a black pill, which reads as *disabled*, not *selected*. Swap black → `bg-selected` + `brand-blue` text.
- Badge counts (like "Review 1") — should be `warning-amber` background, not red. Red implies something urgent/destructive; a pending review is neither.

---

## 4. Screen-by-Screen Redesign

### 4.1 Today (Dashboard) — the daily entry point

**Current problems:** the quick-entry bar is good bones but visually flat; the three summary cards are all equal weight even though "Total Outgoing" matters 5x more than "Pending Reviews"; the ledger table at the bottom has no color coding for cash method.

**Redesign:**

```

│  ┌───────────────────────────────────────────────────┐   │
│  │ ₹  Payee, amount, date, method, purpose...   ENTER │   │  ← quick entry, blue focus ring, 46px height
│  └───────────────────────────────────────────────────┘   │
│  Payee: —   Amount: —   Method: —   Category: —          │
│  FREQUENT  [ABC Tools] [Mahesh Transport] [Ramesh Kumar]  │  ← pill chips, bg-selected on hover
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌───────────┐  ┌───────────┐   │
│  │ TOTAL OUTGOING TODAY │  │ BY METHOD │  │ REVIEW    │   │
│  │      ₹37,000         │  │  bar      │  │   1  ⚠    │   │  ← hero card 1.6x width of the other two
│  │      hero, 32px/700   │  │           │  │  amber    │   │
│  └─────────────────────┘  └───────────┘  └───────────┘   │
├─────────────────────────────────────────────────────────┤
│  OUTLAY LEDGER — TODAY                         3 entries  │
│  Amount   Time   Payee        Category    Method          │
│  ₹3,000   1:57PM amitkumar   [Review req]● amber  ...      │
│  ₹2,000   1:56PM Suresh Yadav Wages       ● blue BANK      │
│  ₹32,000  1:56PM ABC Tools    Tools       ● gray CASH      │
└─────────────────────────────────────────────────────────┘
```

Key changes:
- **"Total Outgoing" becomes the hero card** — 1.6x the width of the other two, 32px number, subtle red-tinted top border (2px) since it's an outgoing total.
- **Method badges get real color**: Cash = neutral gray pill, Bank/UPI/Digital = blue pill (not orange as currently shown) — orange is currently used ambiguously for both "cash" and "review required," which conflicts. Reserve amber strictly for review/attention states.
- **Rows are fully clickable** (entire `<tr>`, not just an icon) — opens a side drawer with full transaction detail instead of navigating away.
- **Frequent/Recent payee chips**: convert from flat pills to `bg-selected` on hover, `brand-blue` text always — this is a navigation aid, so it should feel like the nav bar, not a data tag.
- Primary CTA moves to **"+ Record Payment"** (blue, filled) — replaces "Detailed Form" as the visually dominant button; "Batch Entry" becomes a secondary (outline) button.

---

### 4.2 Ledger — the search/audit screen

**Current problems:** tabs (Today/Review Queue/With Voided/etc.) are plain text with no clear active state beyond color; the table has 7 columns of roughly equal visual weight, burying Amount (the thing you scan for) in the middle-right.

**Redesign:**
- Tabs become a **segmented control** (single pill-shaped container, active segment = white bg + shadow, like iOS/Linear tab styling) rather than loose underlined text — this is the standard pattern in One Cashbook / Zoho for view-switching.
- **Amount column moves to a fixed right-aligned position with 700 weight and tabular numbers** — right now it's the same weight as "Time." Make it the visual anchor of every row.
- **Category badge**: empty categories (shown as "—") should render as an outlined amber "Uncategorised" pill, not a plain dash — a dash reads as "no data," but this is actually an actionable gap (matches your Review Inbox flagging logic).
- **Source tag ("WEB"/"IMPORT")**: keep, but shrink to a muted 11px monospace badge — it's metadata, not primary content, and currently competes visually with real columns.
- Row hover: `bg-page` tint + subtle left border in blue (4px) — signals clickability without needing an explicit chevron/arrow column.
- Search + date filter: combine into one filter bar with 44px height inputs, consistent with form-control sizing from your original spec (42–46px).

---

### 4.3 Payees — Master Registers

**Current problems:** it's a plain data table with no visual distinction between high-value and low-value relationships; "Fav" stars are the only differentiator; Type ("Company"/"Person") is plain text.

**Redesign:**
- Add **avatar circles** with initials (colored by hash of name, muted palette) to the left of each payee name — this is the single highest-impact change; it turns a wall of text into scannable identity, matching One Cashbook's contact-list pattern.
- **Type** becomes a small outlined pill (Company = blue outline, Person = gray outline) instead of plain text.
- **Total Spent** column: right-align, tabular numbers, 600 weight — currently same weight as "Payments" count, but it's the more important number.
- Sort the table by Total Spent by default (currently unsorted/alphabetical-ish) — surfaces your highest-relationship payees first, which matches "Frequent" chips logic on the Today page.
- Favorite star: keep, but make it a proper toggle button with hover state (currently ambiguous whether it's clickable at a glance).
- Row click → opens payee detail drawer (payment history, running balance) rather than requiring "Edit" click for everything.

---

### 4.4 Review Inbox

**Current problems:** this is functionally the most important workflow screen (16 pending items) but visually the flattest — every row looks identical regardless of amount or age, and "Resolve" buttons are all the same blue regardless of whether the row is even ready to resolve (e.g., first row has no category chosen yet, but its button doesn't look disabled).

**Redesign:**
- **Disable the Resolve button until Category is selected** — visually distinct (`bg-page` gray, not blue) until valid, matching "loading states inside buttons" principle from your original spec, extended to "disabled-until-valid" states.
- **Age-based left border accent**: items pending >7 days get a thin amber left border strip; this uses your existing data (dates already shown) to add urgency signal without new fields.
- **Bulk resolve**: add a "select all with same category-source" quick action at the top — since many rows repeat the same payee/category pattern (Ramesh Kumar → Wages → Cash, five times), a bulk-apply saves real time. This is the single biggest workflow win available on this screen.
- **"Remember mapping" checkbox**: promote this — right now it's a tiny checkbox easy to miss. If checked once for a payee, future imports from that payee should pre-fill category/method automatically and skip the review queue entirely. Surface a small "3 mappings remembered" indicator at the top so the value is visible.
- Card padding: increase row padding slightly (current rows feel cramped for how much decision-making happens per row) — 20px vertical, up from what looks like ~14px.

---

### 4.5 Reports

**Current problems:** genuinely close to right already — good use of chart + table pairing. Main issues are visual weight (everything is the same 24px stat regardless of importance) and dense card stacking at the bottom (Largest Payments / Repeated Amounts / Unusually High) with no clear hierarchy.

**Redesign:**
- **"Total Outgoing" gets the hero treatment** (same 32px pattern as Today page) — right now it's the same size as "Average payment" and "Paid in Cash," which dilutes it.
- Donut chart (Category Breakdown): apply the token palette consistently — blue/dark-blue/light-blue currently used should map predictably (e.g., darkest = largest category) so the eye reads magnitude without checking the legend every time.
- **"Unusually High" / "Repeated Amounts" cards**: these are anomaly-detection features — genuinely valuable — but currently look identical to a plain data card. Give them an amber icon/header treatment so they read as "insights," not just another list, distinguishing them from routine reporting.
- Payment Methods & Top Payees cards: convert bars to actual proportional width bars (currently just text + number) — a quick visual bar next to "Cheque ₹49,010" lets you compare method usage at a glance, consistent with the "Category Performance" bars already present above them (good — just needs to extend downward).

---

### 4.6 System Dashboard

**Current problems:** minor — this screen is already close to your target aesthetic (calm, spacious, operational). Only real gap: the green "Database Healthy" banner uses a light green background correctly, but the pattern isn't reused anywhere else (e.g., a red/amber equivalent for "Backup overdue" or "Database issue" doesn't exist yet).

**Redesign:**
- Define the **status banner component** properly as a reusable pattern: `success-green` bg-tint for healthy, `warning-amber` tint for "backup overdue," `danger-red` tint for "database error" — build all three now even though only one is currently triggered, so the system scales without redesign later.
- "Back up now" button: keep primary blue, but add a small loading state (spinner + "Backing up...") per your original spec's "loading states inside buttons" rule — not currently indicated in the screenshot.

---

### 4.7 Activity Log

**Current problems:** this is a long, undifferentiated list — every entry looks the same ("[Name] · Created," timestamp, amount) regardless of size or type of action.

**Redesign:**
- Replace the generic "C" avatar circle with an **action-type icon** (plus-circle for Created, pencil for Edited, trash for Voided) in place of a static letter — the letter currently carries no information (it's always "C").
- **Group by day** with sticky date headers ("Today," "Yesterday," "31 July 2026") instead of one continuous flat list — at 700+ transactions, this is necessary for scanning, not optional.
- Add a lightweight filter: "Created / Edited / Voided" segmented control at top, since this log will only grow and voided/edited entries (rare, important) currently get lost in a sea of routine "Created" entries.
- Right-aligned amount, tabular numbers, consistent with every other screen's ledger rows.

---

## 5. Component Library (build these once, reuse everywhere)

| Component | Where used | Key spec |
|---|---|---|
| **Hero Stat Card** | Today, Reports | 32px/700 number, optional colored top border (red=outgoing, green=incoming) |
| **Segmented Tabs** | Ledger, Activity | Pill container, active = white + shadow |
| **Money Cell** | Every table | Right-aligned, tabular-nums, 600 weight |
| **Status Pill** | Review, Ledger, Payees | Amber (pending) / Green (resolved) / Blue (neutral) / Gray (info) — no other colors |
| **Payee Avatar** | Payees, Today, Ledger, Review | Initials, hashed muted color, 32px |
| **Clickable Row** | All tables | Full-row hover state, opens drawer not new page |
| **Empty State** | All list views | Icon + one-line message + one clear action button |
| **Toast + Undo** | All save actions | Sonner, bottom-right, 4s auto-dismiss unless hovered |

---

## 6. Interaction Standards (apply globally)

- Escape closes any open drawer/modal, focus returns to the triggering element
- Focus stays trapped inside open overlays (tab cycles within, doesn't leak to background)
- Form values persist after a failed validation — never clear a partially-filled form on error
- Every save action → Sonner toast with specific detail ("₹800 paid to Ramesh Kumar") + Undo, 4s window
- Every async button (Resolve, Back up now, Export) shows an inline spinner + disables itself during the request — never a silent freeze
- New keyboard shortcuts (extending your original spec's Escape-only coverage):
  - `N` → open Record Payment
  - `/` → focus search/quick-entry bar
  - `Enter` on quick-entry → save and immediately refocus for the next entry (critical for repeated daily entry)
  - `G` then `T/L/P/R` → go to Today/Ledger/Payees/Review (optional power-user layer)

---

## 7. Build Priority

1. **Design tokens + component library** (§2, §5) — everything else depends on this being right first
2. **Today page** — highest-traffic screen, biggest current gap between "functional" and "good"
3. **Review Inbox** — highest-value workflow win (bulk resolve + remembered mappings)
4. **Ledger + Payees** — table/row patterns, reused component set
5. **Reports** — mostly polish, lowest risk
6. **System + Activity** — smallest gap from current state, do last

---

*This spec extends the One Cashbook color/type system you defined earlier, applied concretely to all 7 screens of the live app. Ready to hand to a developer screen-by-screen, or I can mock up any individual screen as a visual next.*