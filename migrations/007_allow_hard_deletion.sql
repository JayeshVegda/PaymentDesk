-- Migration 007: Allow hard deletion of transactions, transaction audits, and force payee cleanup
DROP TRIGGER IF EXISTS prevent_transaction_delete;
DROP TRIGGER IF EXISTS prevent_transaction_audit_delete;
