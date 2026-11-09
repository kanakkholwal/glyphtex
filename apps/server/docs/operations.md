# Operating the Teams server

## Health and monitoring

- `GET /healthz` returns 200 while the process is up. Use it as a liveness probe.
- `GET /readyz` checks Postgres and the cache (it does not probe object storage). Use it as a readiness probe and alert
  when it fails for more than 2 minutes.
- Every response carries `x-request-id`. Logs are JSON, one line each, with the same id. Search by it.
- Alert on: readiness failing, a rising 5xx rate, queue depth growing, and a failing nightly backup.
- Job worker: run `dev:jobs` (Node) or the Queues consumer (Workers). If it stops, email and file
  cleanup stop. Jobs retry and move to a dead-letter queue after repeated failures.
- Status page: any uptime monitor can poll `/readyz`. Publish its page to your users.

## Backups

What to back up:

- **Postgres**: the source of truth for accounts, projects, text files and the audit log.
- **Object storage**: binary files. Turn on versioning and cross-region replication on S3 or R2.
- **Secrets**: `BETTER_AUTH_SECRET` and `SCIM_CREDENTIAL_SECRET`. Losing the first signs everyone out.
  Changing the second invalidates SCIM tokens.

Postgres, nightly:

```bash
pg_dump --format=custom --file glyphtex-$(date +%F).dump "$DATABASE_URL"
```

- Keep 14 daily and 12 monthly copies in a different account or region.
- Managed Postgres (Neon, Supabase, RDS) offers point-in-time recovery. Turn it on.

## Restore

1. Create an empty Postgres database and restore: `pg_restore --clean --if-exists --dbname "$DATABASE_URL" glyphtex-DATE.dump`
2. Restore or point at the object store holding the matching files.
3. Set the same `BETTER_AUTH_SECRET`, then run `pnpm migrate` so the schema matches the build.
4. Start the API and the job worker, then check `/readyz`.
5. Sign in, open a project with an image, and confirm the audit log loads.

Test a restore into a scratch database every quarter. An untested backup is a hope, not a backup.

## Upgrades

- Back up first, then run `pnpm migrate` before starting the new build. Migrations only move forward.
- On Workers, deploy after the migration. Old and new code both work with the migrated schema within
  one release.

## Rotating credentials

- SCIM: Settings, Security, rotate the token, then paste the new one into your identity provider.
- `BETTER_AUTH_SECRET`: rotating it signs every user out. Do it in a quiet window.
- Single sign-on client secrets: remove and re-add the provider with the new secret.

## Capacity

- The API is stateless. Run more instances behind your balancer when CPU is high.
- Postgres connections: on Workers use Hyperdrive. On Node keep the pool small per instance.
