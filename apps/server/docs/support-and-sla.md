# Support and service levels (template)

A starting point for an operator who offers GlyphTeX Teams to others, whether hosted or as paid
support for a self-hosted install. Replace every value in brackets with what you can actually keep.
Do not publish numbers you cannot meet.

## Availability

- Monthly uptime target for the hosted service: [99.5%], measured on `/readyz` from [two] locations (it covers Postgres and the cache only).
- Planned maintenance: announced [3] days ahead, outside [business hours].
- Service credit if the target is missed: [10% of the month's fee per 0.5% below target, capped at 50%].

## Support

| Severity | Meaning | First response | Update cadence |
|---|---|---|---|
| 1 | Service down, or data at risk | [1 hour] | [every 2 hours] |
| 2 | A major feature is broken, with no workaround | [4 hours] | [daily] |
| 3 | A minor problem or a question | [2 working days] | [as needed] |

- Hours: [09:00 to 18:00 in your time zone, Monday to Friday]. Severity 1 outside those hours: [best effort].
- Channel: [support email or portal].

## Data and exit

- Backups: nightly, kept [14 days], restore tested every quarter (see `operations.md`).
- Exit: every user can export their projects as a zip, and an organization owner can export the audit log
  as CSV at any time. On termination we delete customer data within [30] days on request.
- Vulnerabilities: reported through `SECURITY.md`.

## Not included

- Real-time co-editing, until it ships.
- A SOC 2 or ISO 27001 report.
