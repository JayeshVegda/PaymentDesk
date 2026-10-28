-- Migration 011: permit 'restored' audit rows so a void can be undone
DROP TRIGGER IF EXISTS prevent_transaction_audit_update;

CREATE TABLE transaction_audit_rebuild (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'corrected', 'voided', 'restored')),
  previous_data TEXT CHECK (previous_data IS NULL OR json_valid(previous_data)),
  new_data TEXT NOT NULL CHECK (json_valid(new_data)),
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  change_source TEXT NOT NULL CHECK (change_source IN ('web', 'telegram', 'import', 'job', 'system'))
) STRICT;

INSERT INTO transaction_audit_rebuild (id, transaction_id, action, previous_data, new_data, changed_at, change_source)
SELECT id, transaction_id, action, previous_data, new_data, changed_at, change_source FROM transaction_audit;

DROP TABLE transaction_audit;
ALTER TABLE transaction_audit_rebuild RENAME TO transaction_audit;

CREATE INDEX idx_transaction_audit_transaction ON transaction_audit(transaction_id, changed_at DESC);

CREATE TRIGGER prevent_transaction_audit_update
BEFORE UPDATE ON transaction_audit
BEGIN
  SELECT RAISE(ABORT, 'transaction audit is append-only');
END;
