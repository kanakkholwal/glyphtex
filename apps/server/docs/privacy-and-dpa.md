# Data processing summary

For an organization's privacy or procurement review. This describes what the product does; it is not
legal advice, and a signed DPA is available on request for the hosted service.

## Roles

- Hosted service: the organization is the controller of its projects and member data, GlyphTeX is the
  processor.
- Self-hosted: the organization runs everything. GlyphTeX receives no data and has no access.

## What is processed

| Data | Why | Where |
| --- | --- | --- |
| Name, email, avatar | Account, sharing, audit trail | Postgres |
| Project text files | Cloud copy, sharing | Postgres |
| Images, fonts, other binaries | Cloud copy, sharing | R2 or S3-compatible storage |
| Organization settings, roles, audit log | Administration and compliance | Postgres |
| Session records, IP address, user agent | Sign-in security, rate limiting | Postgres |

Compiled PDFs and LaTeX run only in the user's browser and are not stored by the server.

## Subprocessors (hosted service)

| Provider | Purpose |
| --- | --- |
| Cloudflare | Compute (Workers), object storage (R2), queue, email sending |
| Managed Postgres provider (via Hyperdrive) | Primary database |
| Google Analytics | Website usage events, only if the visitor opts in; never in the editor's documents |

Sign-in providers (Google, GitHub, GitLab, ORCID, an organization's own SSO) are used only when the
user or organization chooses them. A self-hosted deployment has no subprocessors beyond what its operator picks.

## Data subject rights

- Export: every project downloads as a zip from Settings, Account.
- Erasure: deleting an account removes the user, their projects and their files; there are no soft deletes.
- Access and rectification: profile data is editable by the user; organization admins see members and the audit log.

## Retention and security

- Audit log retention is set by `AUDIT_RETENTION_DAYS` (default 365).
- Backups follow the operator's schedule; see `operations.md`.
- Controls (encryption in transit, access control, two-factor, SSO, SCIM) are in `security.md`.
