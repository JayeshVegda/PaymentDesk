# Production release checklist

Before handing a build to the workstation:

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm smoke`
- [ ] `.env` contains no accidental secrets in the source archive
- [ ] A verified backup exists before any migration
- [ ] The server listens only on `127.0.0.1:4782`
- [ ] Today can save a cash payment and the transaction appears in Payment Inbox
- [ ] A correction creates an Activity audit entry
- [ ] CSV export opens successfully
- [ ] System reports database integrity `ok`
- [ ] Telegram is either deliberately disabled or shows configured/active in System

The latest baseline passed TypeScript checks, ESLint (clean), 51 unit/integration tests, a production build, and a smoke test. Update this paragraph after each release run.
