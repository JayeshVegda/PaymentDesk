# Quick Entry Grammar

The parser is deterministic, local, and independent of UI and integrations.

## Resolution order

1. Normalize Unicode, case, punctuation, and whitespace.
2. Match the longest known payee name or alias; ties are ambiguous.
3. Detect exactly one valid amount token.
4. Resolve method aliases: `c/cash`, `u/upi`, `b/bank`, `ch/cheque`.
5. Resolve known category aliases.
6. Keep remaining ordered tokens as the note.
7. Apply explicit payee defaults only to missing method/category values.
8. Mark optional uncertainty for review; never guess a payee or amount.

## Amounts

- `800` → ₹800 → `80000` paise
- `2.5k` → ₹2,500 → `250000` paise
- `12.5k` → ₹12,500 → `1250000` paise
- `1l` → ₹1,00,000 → `10000000` paise
- `0.75l` → ₹75,000 → `7500000` paise

Parsing uses integer/BigInt arithmetic. Values requiring fractional paise, non-positive values, unsafe integers, unknown suffixes, multiple amounts, and ambiguous payees are rejected.

Examples such as `ramesh 800`, `800 ramesh c`, and `abc tools 12.5k bank drill bits` produce a preview before save. Longest known payee/alias matching, amount detection, method aliases, category keywords, remembered defaults, remaining-note extraction, review warnings, preview, save, and audited undo are implemented. Ambiguous or missing payees/amounts cannot be saved.
