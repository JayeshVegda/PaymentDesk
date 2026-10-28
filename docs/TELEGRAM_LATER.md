# Telegram Later

Telegram is not installed or contacted in the current foundation.

Phase 8 adds a grammY adapter inside the existing Node process using long polling. It will require exact allowlisted private user and chat IDs before parsing any message. Messages pass through the same deterministic parser and `TransactionService`; source is `telegram`. Confirmation buttons must show the resolved payee, INR amount, method, category, date/time, and review state before saving uncertain optional fields.

Supported actions will include quick entry, today report, and undo by audited void. Outgoing events use the existing `notification_outbox`; a bounded retry worker claims pending rows, applies backoff, and records errors without blocking financial transactions. Tokens and allowlists remain environment secrets. No core schema or business-rule rewrite is required.
