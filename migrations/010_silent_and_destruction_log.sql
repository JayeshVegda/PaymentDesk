-- Migration 010: silent flag (skip Telegram forwarding) + destruction log for force deletions
ALTER TABLE transactions ADD COLUMN silent INTEGER NOT NULL DEFAULT 0 CHECK (silent IN (0, 1));
CREATE INDEX idx_transactions_silent ON transactions(silent) WHERE silent = 1;

CREATE TABLE destruction_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('payee')),
  entity_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  transaction_count INTEGER NOT NULL CHECK (transaction_count >= 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
  confirm_phrase TEXT NOT NULL,
  backup_file TEXT,
  destroyed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
