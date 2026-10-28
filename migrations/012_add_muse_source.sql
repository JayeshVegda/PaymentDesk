-- Migration 012: allow 'muse' as a change source (Muse AI direct-access writes)
-- Rebuilds transactions and transaction_audit to widen the source CHECK
-- constraints, preserving every column, row, index and audit trigger.

CREATE TABLE transactions_rebuild (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_date TEXT NOT NULL CHECK (transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  transaction_time TEXT NOT NULL CHECK (transaction_time GLOB '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]'),
  payee_id INTEGER NOT NULL REFERENCES payees(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE RESTRICT,
  note TEXT,
  source TEXT NOT NULL CHECK (source IN ('web', 'telegram', 'import', 'job', 'system', 'muse')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'voided')),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  silent INTEGER NOT NULL DEFAULT 0 CHECK (silent IN (0, 1)),
  CHECK (needs_review = 1 OR (category_id IS NOT NULL AND payment_method_id IS NOT NULL))
) STRICT;

INSERT INTO transactions_rebuild
  (id, transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id,
   note, source, status, needs_review, created_at, updated_at, version, silent)
SELECT id, transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id,
       note, source, status, needs_review, created_at, updated_at, version, silent
FROM transactions;

CREATE TABLE transaction_audit_rebuild (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions_rebuild(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'corrected', 'voided', 'restored')),
  previous_data TEXT CHECK (previous_data IS NULL OR json_valid(previous_data)),
  new_data TEXT NOT NULL CHECK (json_valid(new_data)),
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  change_source TEXT NOT NULL CHECK (change_source IN ('web', 'telegram', 'import', 'job', 'system', 'muse'))
) STRICT;

INSERT INTO transaction_audit_rebuild
  (id, transaction_id, action, previous_data, new_data, changed_at, change_source)
SELECT id, transaction_id, action, previous_data, new_data, changed_at, change_source
FROM transaction_audit;

DROP TABLE transaction_audit;
DROP TABLE transactions;
ALTER TABLE transactions_rebuild RENAME TO transactions;
ALTER TABLE transaction_audit_rebuild RENAME TO transaction_audit;

CREATE INDEX idx_transactions_date_time ON transactions(transaction_date DESC, transaction_time DESC, id DESC);
CREATE INDEX idx_transactions_payee_date ON transactions(payee_id, transaction_date DESC);
CREATE INDEX idx_transactions_category_date ON transactions(category_id, transaction_date DESC);
CREATE INDEX idx_transactions_method_date ON transactions(payment_method_id, transaction_date DESC);
CREATE INDEX idx_transactions_review ON transactions(needs_review, transaction_date DESC) WHERE needs_review = 1 AND status = 'posted';
CREATE INDEX idx_transactions_status_date ON transactions(status, transaction_date DESC);
CREATE INDEX idx_transactions_amount ON transactions(amount_paise DESC);
CREATE INDEX idx_transactions_silent ON transactions(silent) WHERE silent = 1;
CREATE INDEX idx_transaction_audit_transaction ON transaction_audit(transaction_id, changed_at DESC);

CREATE TRIGGER prevent_transaction_audit_update
BEFORE UPDATE ON transaction_audit
BEGIN
  SELECT RAISE(ABORT, 'transaction audit is append-only');
END;
