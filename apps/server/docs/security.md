# Teams server security overview

What the server stores, who can reach it, and the controls around it. Written for a security
reviewer at an organization evaluating a self-hosted deployment.

## Data flow

- LaTeX compiles in the user's browser (WebAssembly). The server never runs user code, so there is no
  compile sandbox to escape.
- The server stores project files, accounts, organization settings and an audit log in Postgres.
  Binary files (images, fonts) go to S3-compatible storage or R2.
- Nothing is sent to third parties by the server. Outbound calls are limited to your mail provider,
  your identity providers and DNS lookups for domain verification.
- Local-first: documents live in the browser first. The server is a replica that users opt into.

## Authentication

- Email and password (minimum 10 characters), magic links, and Google, GitHub or GitLab OAuth.
- Single sign-on per organization over OpenID Connect (SAML is available through the API).
  A provider can only be registered by an organization owner or admin and only signs in users after
  its email domain is proven with a DNS TXT record.
- Two-factor (TOTP with backup codes). An organization can require it; members signing in through the
  organization's own SSO meet the requirement at their identity provider.
- Sessions are HTTP-only cookies. Auth endpoints are rate limited per client address.

## Authorization

- Deny by default. Project routes use a project guard and organization routes use an organization
  guard. A test fails if any route lacks one.
- A resource a caller cannot see is reported as missing (404), so ids cannot be probed.
- Roles: owner, editor, commenter, viewer on projects; owner, admin, member in organizations.
  Organization policy controls default member access, share links, outside invites, AI and the
  two-factor requirement.
- Writes carry version preconditions, so a stale client cannot overwrite newer work.

## Provisioning

- SCIM 2.0 adds and removes organization members from your directory.
- Bearer credentials are stored only as keyed digests, expire, can be rotated and are shown once.
- Directory sync never removes an organization owner.

## Data protection

- Encrypt in transit with TLS at your proxy or on Cloudflare.
- Encryption at rest comes from your database and object store (managed Postgres, R2 or S3 server-side
  encryption). The server does not add application-level encryption of file contents.
- Invite and share tokens are stored hashed. Passwords are hashed by the auth library.
- Secrets live in environment variables or Worker secrets, never in the repository.

## Audit, retention and deletion

- Membership, invitation, policy, template, single sign-on and SCIM events are written to an
  append-only audit log, exportable as CSV. Retention is set by `AUDIT_RETENTION_DAYS` (default 365).
- Deletes are hard deletes. Removing a project, account or organization removes its rows, and a
  background job purges the files after a short delay, skipping any file still referenced.
- Users can export every project they own as a zip at any time.

## Known limits

- No SOC 2 or ISO 27001 report. Self-hosters control the environment themselves.
- SAML is implemented by the underlying library and has not been tested here against a live identity
  provider. Use OpenID Connect if you can.
- Real-time collaboration is not available yet. Two editors on one file get a conflict, not a merge.
