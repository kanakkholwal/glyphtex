# apps/server: AGENTS.md

Refines the root `AGENTS.md` for the Teams server. Licence: **AGPL-3.0-or-later**.

## Shape

```
src/
  entry/          composition roots: workers.ts (Cloudflare), node.ts + node-jobs.ts (Node/Bun)
  app.ts          Hono app; middleware order, route mounting
  controllers/    HTTP only: validate (zod), call a service, shape the response
  services/       business rules; take Deps, never touch Hono
  repositories/   all SQL (Drizzle); no business rules
  rbac/           grant table + authorizeProject; the only place access is decided
  adapters/       Cache, Queue, Blobs, Mailer, RateLimiter interfaces and implementations
  jobs/           job schema, handlers, Redis/RabbitMQ consumers
  db/             schema.ts (Better Auth tables + ours), client, migrate
drizzle/          generated SQL migrations (commit them; never hand-edit)
```

## Rules

- **Postgres only.** Change `src/db/schema.ts`, then `pnpm db:generate`, and commit the migration.
- **Serverless-safe adapters only.** No in-memory, in-process or local-disk state; every
  adapter talks to an external service. A new backend implements the interface in
  `adapters/types.ts` and passes the contract tests.
- **No module-level singletons holding connections.** Entries build `Deps` and inject them via
  Hono context. On Workers the DB connection is per request and closed by `dispose`.
- **Every route under `/api/projects/:projectId` uses `requireProject(permission)`.**
  `test/routes.test.ts` fails otherwise. Unknown projects are 404, not 403.
- **Grants live in `rbac/permissions.ts` only.** The client gets `capabilities[]`; it never
  re-derives rules.
- **Hard deletes only.** No `deleted_at`. Rows cascade from `user`/`project`; blob keys go to the
  `blobs.delete` job, which skips any key still referenced, so a purge can't destroy live data.
- **Writes need preconditions:** `If-None-Match: *` to create, `If-Match: "<version>"` to
  update/delete/rename. Never add a blind-overwrite path.
- **External calls go through `createPolicy`** (circuit breaker + retry with jittered backoff +
  timeout). Don't retry 4xx. An open breaker becomes a plain-language 503.
- **Errors:** throw `errors.*` (`lib/errors.ts`) for anything user-facing; everything else is
  logged with the request id and returned as a generic 500 (problem+json).
- **Jobs are at-least-once.** Handlers must be idempotent; payloads are re-validated with zod.
- **Tokens (invites, share links) are stored hashed**; the raw token is returned exactly once.

## Verify

`pnpm check` · `pnpm test` · Biome from the repo root. With the compose stack up (see
README), `GLYPHTEX_IT=1 pnpm test` runs the end-to-end and queue contract suites.
`pnpm wrangler deploy --dry-run` must still bundle for Workers.
