# Backup and Restore

## Backup

Run `pnpm db:backup` or `scripts\backup.ps1`. Use `--tier=daily`, `weekly`, or `monthly`. The command uses SQLite's online backup API, writes a temporary file, runs full `PRAGMA integrity_check`, atomically renames only a verified copy, and then applies retention: 14 daily, 8 weekly, and 12 monthly backups.

Do not copy `ledger.sqlite3` in File Explorer while the app is running; WAL changes may not be captured consistently. Keep at least one additional encrypted copy on separate storage in Phase 7.

## Restore

1. Stop the Payment Ledger Task Scheduler task and verify port 4782 is closed.
2. Copy the current `data` and `backups` directories to a dated recovery folder.
3. Select a verified backup and copy it to a temporary filename in the data directory.
4. Open the temporary copy with SQLite and run `PRAGMA integrity_check`; require `ok`.
5. Rename the current database to `ledger.pre-restore-<timestamp>.sqlite3`.
6. Rename the verified temporary copy to `ledger.sqlite3`.
7. Remove stale `ledger.sqlite3-wal` and `ledger.sqlite3-shm` only while the application is stopped and after preserving the recovery folder.
8. Start the app, call `/api/health`, check recent transactions, and retain the pre-restore copy until business verification is complete.

Never overwrite the only database copy and never restore an unverified backup.
