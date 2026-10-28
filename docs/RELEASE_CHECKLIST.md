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

The current release has passed TypeScript checks, 34 unit/integration tests, a production build, a loopback smoke test, and 1920×1080 route inspection. ESLint still reports legacy explicit-`any` and unused-import findings in older React pages; these do not affect the build or runtime and should be addressed as a separate refactor.
