---
title: "Self-host the GlyphTeX server"
description: "Run the optional GlyphTeX server for accounts, saved projects and sharing: one click on Cloudflare, or Docker with Postgres, Valkey and any S3-compatible store. Configuration, sign-in providers and the web app link."
category: "Self-hosting"
order: 30
updated: "2026-11-04"
faq:
  - q: "Do I need a server to use GlyphTeX?"
    a: "No. The editor and the compiler run in the browser and keep documents there. The server only adds accounts, saving projects online and sharing them."
  - q: "Which database does the GlyphTeX server use?"
    a: "Postgres, from any provider: Neon, Supabase, PlanetScale Postgres, a managed instance or your own container. On Cloudflare it connects through Hyperdrive."
  - q: "Does the server compile LaTeX?"
    a: "No. Every collaborator compiles on their own device with the in-browser engine, so the server never runs TeX and needs no TeX Live image or sandbox."
---

:::takeaways
- The server is optional: it adds accounts, saved projects and sharing. Compiling stays in each browser.
- Cloudflare: one Worker with Hyperdrive, KV, R2 and Queues, deployable with one button.
- Docker: Postgres, Valkey (Redis) and an S3-compatible store; RabbitMQ is an option for jobs.
- Point the web app at it with `PUBLIC_GLYPHTEX_SERVER_URL`; nothing else changes.
:::

## What you run

| Concern | Cloudflare | Docker (Node or Bun) |
| --- | --- | --- |
| Database | Postgres through Hyperdrive | Postgres via `DATABASE_URL` |
| Cache | KV | Redis or Valkey |
| Background jobs | Cloudflare Queues | Redis/Valkey or RabbitMQ |
| Project files | R2 (or any S3) | Any S3-compatible store |
| Email | Resend | Resend or SMTP |

The server is [`apps/server`](https://github.com/kanakkholwal/glyphtex/tree/main/apps/server) in the repository, licensed AGPL-3.0.

## Deploy on Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kanakkholwal/glyphtex/tree/main/apps/server)

The button creates the KV namespace, R2 bucket, queues and a Hyperdrive config (it asks for your Postgres connection string), then asks for the secrets: `BETTER_AUTH_SECRET` and `RESEND_API_KEY`. After it finishes:

1. Set `PUBLIC_URL` (the Worker's URL) and `APP_URL` (your web app) in the Worker's variables.
2. Apply the database schema once from your machine: `DATABASE_URL=postgres://… pnpm --filter @glyphtex/server migrate`.

To deploy by hand instead, fill the ids in `apps/server/wrangler.jsonc`, run `wrangler secret put` for each secret and `pnpm --filter @glyphtex/server deploy`.

## Run with Docker

```bash
git clone https://github.com/kanakkholwal/glyphtex
cd glyphtex/apps/server
export BETTER_AUTH_SECRET=$(openssl rand -base64 48)
docker compose up -d
```

That starts Postgres, Valkey, an S3 store (RustFS), Mailpit for development email, the API on port 8787 and a job worker. Migrations run before the API starts. For RabbitMQ: `QUEUE_DRIVER=rabbitmq docker compose --profile rabbitmq up -d`.

In production, point `DATABASE_URL`, `REDIS_URL` and the `S3_*` variables at your own services, and switch email to Resend or a real SMTP server. Every option is listed in `apps/server/.env.example`.

## Connect the web app

Set `PUBLIC_GLYPHTEX_SERVER_URL` to the server's URL in the web app (a `vars` entry in `apps/web/wrangler.jsonc` on Cloudflare). Sign-in, the Share button, cloud projects and Settings, Account appear; without it they stay hidden.

If the API and the web app live on different subdomains of one site (`api.example.com` and `example.com`), set `COOKIE_DOMAIN=example.com` on the server so the session cookie reaches both.

## Sign-in providers

Email and password and magic links work out of the box. Google, GitHub and GitLab turn on when their client id and secret are set (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and so on). For a self-hosted GitLab, also set `GITLAB_ISSUER`. The callback URL to register with each provider is `PUBLIC_URL/api/auth/callback/<provider>`.

## Operating notes

- **Behind a proxy:** set `CLIENT_IP_HEADER` to the header your proxy writes with the real client address (`cf-connecting-ip` on Cloudflare). Rate limits trust only that header.
- **Health:** `/healthz` answers when the process is up; `/readyz` checks Postgres and the cache.
- **Deletion is real:** deleting a project or an account removes its rows and files. Backups are the only place deleted data remains, so keep their retention short and say so in your privacy policy.
