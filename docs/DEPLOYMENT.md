# Open Giftcard Portal Deployment Contract

This repository is a reference implementation. This document describes the
configuration a deployer must supply; it is not evidence that a public staging
or production environment has passed these checks.

## Topology

```text
browser --HTTPS--> ingress --HTTP/HTTPS--> portal BFF/static host
                                          \--> HTTPS Open Giftcard API
portal BFF --> portal-owned PostgreSQL
portal BFF --> persistent Data Protection key volume
```

The browser calls only the portal origin. Backend access and refresh tokens stay
encrypted in the server-side session database. Interface language, theme, and
clock preferences are the only values stored in browser local storage.

## Required configuration

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:8080
AllowedHosts=portal.<your-domain>

Backend__BaseUrl=https://api.<your-domain>
Backend__TimeoutSeconds=15
ConnectionStrings__Portal=Host=<host>;Port=5432;Database=<portal-db>;Username=<portal-role>;Password=<secret>;SSL Mode=Require
# Set only in the migration job, never in the long-running BFF process.
ConnectionStrings__PortalMigrations=Host=<host>;Port=5432;Database=<portal-db>;Username=<portal-migration-owner>;Password=<secret>;SSL Mode=Require
DataProtection__KeysPath=<absolute-persistent-key-volume>

PortalSession__CookieName=__Host-giftcard_portal
PortalSession__AllowInsecureCookie=false

# Only when TLS terminates at a reverse proxy
Networking__ForwardedHeaders__KnownProxies__0=<literal-immediate-proxy-ip>
```

Outside Development, startup fails for HTTP backend transport, insecure or
non-`__Host-` session cookies, a missing durable key path, or malformed proxy
addresses. Development's HTTP cookie and local key path are not production
settings.

## Database and scaling

Use a dedicated portal database with separate migration-owner and runtime
roles. Never reuse the backend or cardholder database, their roles, or a
PostgreSQL superuser. The migration owner must own the database and its session
tables. The BFF runtime role receives only schema usage and table DML.

Before starting the candidate, run the published application once as a bounded
migration job:

```powershell
$env:ConnectionStrings__Portal = '<runtime connection>'
$env:ConnectionStrings__PortalMigrations = '<migration owner connection>'
dotnet GiftCardPortal.Bff.dll --migrate
```

Do not provide `ConnectionStrings__PortalMigrations` to the long-running BFF.
Normal startup performs no DDL and readiness returns 503 when the managed schema
is absent. The migrator serializes with a PostgreSQL advisory lock, records a
checksum-protected migration ledger, revokes public schema creation, and grants
the named runtime login only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on
`portal_sessions`.

Every replica must share the database and Data Protection key ring. Refresh
rotation is serialized locally and with a PostgreSQL advisory lock, so separate
replicas cannot spend the same rotating refresh token concurrently. Back up and
test restoration of both database and key storage; rollback must preserve them.

## TLS, proxy, and backend trust

The ingress must overwrite browser-supplied forwarding headers. The portal
accepts one forwarded hop only from literal configured proxy addresses; with no
entry it ignores forwarding headers. Configure the portal BFF's immediate
address separately in the backend's known-proxy list so login rate limits see
the observed browser address.

No broad CORS policy is required: the SPA talks to same-origin `/bff/*` routes
and the BFF calls the bearer-only backend server-to-server.

## Build integrity

`dotnet publish` performs a clean frontend build and publishes that output.
Development runs may serve the committed `GiftCardPortal.Bff/wwwroot` bundle;
CI therefore rebuilds the SPA and verifies every committed path and SHA-256.
Regenerate and commit the bundle whenever frontend source changes.

## Health and observability

- `GET /health` is process liveness.
- `GET /health/ready` verifies the portal session table and returns 503 without
  connection details when unavailable.
- Monitor backend readiness independently.

Production JSON logs go to standard output. Collection, retention, alerts,
metrics, secret filtering, and incident ownership belong to the operator.

## Staging promotion checklist

1. Record the exact public portal, backend, cardholder, and POS commits and
   verify the pinned contract and committed-bundle hashes against the
   coordinated release manifest.
2. Verify TLS, HSTS, secure `__Host-` cookies, same-origin/antiforgery rejection,
   CSP, `/bff` `no-store`, and both health endpoints.
3. Exercise login, context selection, finance, funding, cards, distribution,
   lifecycle, bulk batches, team/roles, audit, reporting, and sign-out against
   the deployed backend.
4. Confirm browser storage contains only the allowlisted preference key.
5. Restart and load-balance across replicas, forcing a token refresh to prove
   database/key sharing and cross-replica serialization.
6. Test database backup/restore and rollback without replacing database or keys.
7. Run keyboard, reduced-motion, mobile, 200% zoom, Firefox, Chromium, axe, and
   human assistive-technology/visual review.
8. Confirm backend notification delivery, monitoring, secrets rotation, and
   incident response are operational.

Passing source CI is not deployment certification. Release rules live in
[PUBLISHING.md](PUBLISHING.md), and incomplete gates remain visible in
[PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).
