# GlyphTeX Teams server

Optional server for GlyphTeX: accounts, saved projects, sharing and role-based access.
LaTeX still compiles in the browser, so the server only stores and syncs files.

## Run it

### Docker (Node)

```bash
cd apps/server
export BETTER_AUTH_SECRET=$(openssl rand -base64 48)
docker compose up -d                 # Postgres, Valkey, RustFS (S3), Mailpit, API, job worker
```

- API: http://localhost:8787
- Mail inbox (dev): http://localhost:8025
- Use RabbitMQ instead of Valkey for jobs: `QUEUE_DRIVER=rabbitmq docker compose --profile rabbitmq up -d`

### Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kanakkholwal/glyphtex/tree/main/apps/server)

The button provisions KV, R2, Queues and Hyperdrive and asks for the secrets in `.dev.vars.example`. To do it by hand:

1. Create Hyperdrive (pointing at any Postgres: Neon, Supabase, PlanetScale, self-hosted), a KV namespace, an R2 bucket, and queues `glyphtex-jobs` + `glyphtex-jobs-dead`.
2. Put their ids in `wrangler.jsonc`.
3. Set secrets: `wrangler secret put BETTER_AUTH_SECRET` and `RESEND_API_KEY` (plus OAuth secrets).
4. `DATABASE_URL=... pnpm migrate`, then `pnpm deploy`.

## Local development

```bash
pnpm --filter @glyphtex/server services     # Postgres, Valkey, S3, Mailpit (ports from .env)
pnpm --filter @glyphtex/server migrate      # once, and after pulling new migrations
pnpm --filter @glyphtex/server dev:node     # API at http://localhost:8787 (add -- --force to free the port from any process)
pnpm --filter @glyphtex/server dev:jobs     # emails and file cleanup
```

Put `POSTGRES_PORT`, `REDIS_PORT`, `S3_PORT` and `MAILPIT_PORT` in `apps/server/.env`: compose reads them, so
the containers and the API agree. Set `PUBLIC_GLYPHTEX_SERVER_URL=http://localhost:8787` in
`apps/web/.env` and run the web app with `pnpm dev:web` (http://localhost:5173). Emails land in Mailpit; set
`REQUIRE_EMAIL_VERIFICATION=false` to sign up without opening the verification email.

Keep both on plain `localhost`: Google rejects `*.localhost` redirect URIs, and the session cookie
needs the web app and API on the same site. OAuth callback: `http://localhost:8787/api/auth/callback/<google|github|gitlab>`.

## Configuration

Every option is in `.env.example`. Infrastructure is chosen by config:

| Concern | Workers | Node / Bun |
|---|---|---|
| Database | Postgres via Hyperdrive or `DATABASE_URL` | Postgres via `DATABASE_URL` |
| Cache | KV | Redis / Valkey |
| Jobs | Cloudflare Queues | Redis / Valkey or RabbitMQ |
| Files (optional) | R2 binding or any S3 | any S3 (Neon, AWS, R2, RustFS, MinIO, B2, Tigris) |
| Mail (optional) | Cloudflare `send_email` or Resend | Resend or SMTP |
| Rate limits | Workers rate limiting | Redis / Valkey |

File storage and mail are off until you configure them, so a first deployment needs neither a bucket nor a mail domain:

- **No `BLOB_DRIVER`** (or `s3` with incomplete `S3_*` settings, which logs a warning): text files sync as usual. Images and other binary files stay in the browser, a zip import skips them and says which, and the app tells the user once.
- **No mail driver**: magic links and password resets are hidden, invitations are shared as links, and email verification is not required (the server logs a note at startup).
- **Cloudflare mail**: set `MAIL_DRIVER=cloudflare` and add `"send_email": [{ "name": "EMAIL" }]` to `wrangler.jsonc`. The sending domain must be on Cloudflare, and sending to anyone (not only verified addresses) needs the Workers Paid plan. It is in beta.
- **Neon Object Storage** (beta, S3-compatible, free plan 5 GB storage and 5 GB egress per project) works with `BLOB_DRIVER=s3`: use the endpoint, bucket and keys from the Neon console. Deletes there are soft deletes, so do not promise instant erasure of files.

Sign-in providers turn on when their client id and secret are set: Google, GitHub and GitLab (`GITLAB_ISSUER` for self-hosted GitLab).

## API (all under `/api`, session cookie required)

| | |
|---|---|
| `GET /me`, `GET /me/export` | current user; zip of every owned project |
| `GET/POST /projects`, `POST /projects/import?name=` | list, create, import a zip (Overleaf/Prism exports) |
| `GET/PATCH/DELETE /projects/:id` | view (with `capabilities`), rename / set main file, delete |
| `GET /projects/:id/files` | file list with versions |
| `GET/PUT/DELETE /projects/:id/files/raw?path=` | content; writes need `If-None-Match: *` or `If-Match: "<version>"` |
| `POST /projects/:id/files/rename` | `{from,to}` with `If-Match` |
| `/projects/:id/members`, `/invites`, `/links` | sharing (owner only, except leaving) |
| `POST /invites/accept`, `POST /links/redeem` | `{token}` |
| `/auth/*` | Better Auth: sign-up/in, magic link, OAuth, verification, password reset, `delete-user` |

### Enterprise identity

Organization owners and admins manage these under Settings, Security.

- **Single sign-on**: OpenID Connect providers per organization, each domain proven with a DNS TXT record. Members sign in from the SSO tab with their work email. Redirect URL: `<PUBLIC_URL>/api/auth/sso/callback/<provider>`.
- **SCIM 2.0**: point your identity provider at `<PUBLIC_URL>/api/auth/scim/v2` with the bearer token from Security. Users are added to and removed from the organization; owners are never removed.
- **Two-factor**: users enrol under Settings, Account. An organization policy can require it; SSO members meet it at their identity provider.

More: `docs/security.md`, `docs/operations.md` (monitoring, backups, restore), `docs/support-and-sla.md`.

Errors are `application/problem+json` with a `code` and a `requestId`.

## Tests

```bash
pnpm test                                  # unit
docker compose -p glyphtex-it up -d postgres redis s3 s3-init mailpit   # with the port overrides below
GLYPHTEX_IT=1 pnpm test                    # + end-to-end and queue contracts
```

The integration suite expects Postgres on 5433, Valkey on 6380, S3 on 9002 and Mailpit on 8026
(`POSTGRES_PORT=5433 REDIS_PORT=6380 S3_PORT=9002 MAILPIT_PORT=8026`). Add `--profile rabbitmq`,
`RABBITMQ_PORT=5673` and `RABBITMQ_URL=amqp://glyphtex:glyphtex@localhost:5673` for RabbitMQ.
