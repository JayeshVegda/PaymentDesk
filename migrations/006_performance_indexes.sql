-- Performance indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_payees_active_fav_name ON payees(active, favourite DESC, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions(status, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount_paise DESC);
