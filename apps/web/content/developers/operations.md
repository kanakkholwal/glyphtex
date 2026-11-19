---
title: "Operate the GlyphTeX server: health checks, alerts and incidents"
description: "The health endpoints the GlyphTeX server exposes, how to monitor them, what to alert on, and the incident process we follow and recommend for self-hosted deployments."
category: "Self-hosting"
order: 31
updated: "2026-11-19"
faq:
  - q: "Which endpoints should an uptime monitor call?"
    a: "Call /healthz for liveness, /readyz for the database and cache, and /api/public/info for the version, build and enabled features. Only /readyz returns 503 when a dependency is down."
  - q: "How do I know which version is deployed?"
    a: "GET /api/public/info returns the version, commit, deploy time and the features this server has switched on, such as live editing, SSO and SCIM."
---

The server is optional, so a failure never stops anyone writing locally. These are the checks and steps for keeping the shared parts healthy.

## Health endpoints

| Path | Use | Failure |
| --- | --- | --- |
| `/healthz` | Liveness: the process answers. | No response |
| `/readyz` | Readiness: database and cache reachable within 3 seconds. | `503` with per-check detail |
| `/api/public/info` | Version, commit, deploy time and enabled features. | No response |

## What to alert on

- `/readyz` not `200` for two checks in a row.
- `/api/public/info` reporting a version older than the one you last deployed.
- Live editing enabled (`features.live`) but sockets closing with code 4001 or 4003 in volume.
- Backups older than your recovery point objective.

## Run an uptime check

This repository ships `uptime.yml`, a GitHub Actions workflow that probes the public site, the engine manifest and the three server endpoints every 15 minutes. It opens an issue labelled `incident` when a probe fails, comments on it while the failure lasts, and closes it when everything is healthy. Set the `WEB_DEPLOY_URL` and `SERVER_URL` repository variables to point it at your own deployment.

## Incident process

1. **Detect.** The uptime issue, a user report or an alert opens the incident.
2. **Assign.** One person owns it and writes updates in the issue.
3. **Contain.** Roll back the last deploy first if the incident started with one.
4. **Communicate.** Post a short status in the issue and to affected users. Say what is down, what still works (local editing always does) and when the next update comes.
5. **Resolve.** Close the issue when `/readyz` is healthy again.
6. **Review.** Within five working days, add what happened, the cause and the follow-ups to the issue.

Security issues follow [SECURITY.md](https://github.com/kanakkholwal/glyphtex/blob/main/SECURITY.md) instead: report privately, expect an acknowledgement within 3 working days.
