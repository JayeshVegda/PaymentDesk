# Payee deployment implementation plan

1. Add explicit public host and HTTPS-origin configuration with a regression test.
2. Replace the draft image with a reproducible Node 24 multi-stage build.
3. Mount existing data and a backup directory at the runtime paths expected by the database package.
4. Add the `payee.zayu.dev` Caddy reverse proxy and security headers.
5. Run tests, build the image, back up the existing database, and start the service.
6. Validate Caddy, reload it, then verify health, HTTPS, SPA delivery, and persistence.
