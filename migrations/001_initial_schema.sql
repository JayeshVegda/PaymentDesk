CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  parent_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE category_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE payees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('person', 'company')),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  default_category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  default_payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE payee_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payee_id INTEGER NOT NULL REFERENCES payees(id) ON DELETE RESTRICT,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_date TEXT NOT NULL CHECK (transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  transaction_time TEXT NOT NULL CHECK (transaction_time GLOB '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]'),
  payee_id INTEGER NOT NULL REFERENCES payees(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE RESTRICT,
  note TEXT,
  source TEXT NOT NULL CHECK (source IN ('web', 'telegram', 'import', 'job', 'system')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'voided')),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (needs_review = 1 OR (category_id IS NOT NULL AND payment_method_id IS NOT NULL))
) STRICT;

CREATE TABLE transaction_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'corrected', 'voided')),
  previous_data TEXT CHECK (previous_data IS NULL OR json_valid(previous_data)),
  new_data TEXT NOT NULL CHECK (json_valid(new_data)),
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  change_source TEXT NOT NULL CHECK (change_source IN ('web', 'telegram', 'import', 'job', 'system'))
) STRICT;

CREATE TABLE daily_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date TEXT NOT NULL UNIQUE CHECK (business_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  opening_cash_paise INTEGER NOT NULL CHECK (opening_cash_paise >= 0),
  cash_received_paise INTEGER NOT NULL CHECK (cash_received_paise >= 0),
  cash_paid_paise INTEGER NOT NULL CHECK (cash_paid_paise >= 0),
  expected_cash_paise INTEGER NOT NULL CHECK (expected_cash_paise >= 0),
  actual_cash_paise INTEGER NOT NULL CHECK (actual_cash_paise >= 0),
  difference_paise INTEGER NOT NULL,
  closing_note TEXT,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'reopened')),
  closed_at TEXT NOT NULL,
  reopened_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (expected_cash_paise = opening_cash_paise + cash_received_paise - cash_paid_paise),
  CHECK (difference_paise = actual_cash_paise - expected_cash_paise)
) STRICT;

CREATE TABLE daily_closing_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_closing_id INTEGER NOT NULL REFERENCES daily_closings(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('closed', 'reopened', 'reclosed')),
  previous_data TEXT CHECK (previous_data IS NULL OR json_valid(previous_data)),
  new_data TEXT NOT NULL CHECK (json_valid(new_data)),
  reason TEXT,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  change_source TEXT NOT NULL CHECK (change_source IN ('web', 'telegram', 'import', 'job', 'system')),
  CHECK (action != 'reopened' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
) STRICT;

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT, WITHOUT ROWID;

CREATE TABLE background_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  scheduled_at TEXT NOT NULL,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE notification_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_payee_aliases_payee ON payee_aliases(payee_id);
CREATE INDEX idx_category_aliases_category ON category_aliases(category_id);
CREATE INDEX idx_transactions_date_time ON transactions(transaction_date DESC, transaction_time DESC, id DESC);
CREATE INDEX idx_transactions_payee_date ON transactions(payee_id, transaction_date DESC);
CREATE INDEX idx_transactions_category_date ON transactions(category_id, transaction_date DESC);
CREATE INDEX idx_transactions_method_date ON transactions(payment_method_id, transaction_date DESC);
CREATE INDEX idx_transactions_review ON transactions(needs_review, transaction_date DESC) WHERE needs_review = 1 AND status = 'posted';
CREATE INDEX idx_transaction_audit_transaction ON transaction_audit(transaction_id, changed_at DESC);
CREATE INDEX idx_daily_closing_audit_closing ON daily_closing_audit(daily_closing_id, changed_at DESC);
CREATE INDEX idx_background_jobs_ready ON background_jobs(status, scheduled_at) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_notification_outbox_ready ON notification_outbox(status, created_at) WHERE status IN ('pending', 'failed');

CREATE TRIGGER prevent_transaction_delete
BEFORE DELETE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'transactions cannot be deleted; void them');
END;

CREATE TRIGGER prevent_transaction_audit_update
BEFORE UPDATE ON transaction_audit
BEGIN
  SELECT RAISE(ABORT, 'transaction audit is append-only');
END;

CREATE TRIGGER prevent_transaction_audit_delete
BEFORE DELETE ON transaction_audit
BEGIN
  SELECT RAISE(ABORT, 'transaction audit is append-only');
END;

CREATE TRIGGER prevent_daily_closing_delete
BEFORE DELETE ON daily_closings
BEGIN
  SELECT RAISE(ABORT, 'daily closings cannot be deleted');
END;

CREATE TRIGGER prevent_daily_closing_audit_update
BEFORE UPDATE ON daily_closing_audit
BEGIN
  SELECT RAISE(ABORT, 'daily closing audit is append-only');
END;

CREATE TRIGGER prevent_daily_closing_audit_delete
BEFORE DELETE ON daily_closing_audit
BEGIN
  SELECT RAISE(ABORT, 'daily closing audit is append-only');
END;

