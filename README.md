# Open Giftcard Portal

Open Giftcard's company, finance, HR, and platform operations portal.

PORTAL-001 provides the secure application shell, real platform login,
current-user discovery, and verified organization selection. PORTAL-002 adds
the first platform operator workflow: a searchable, status-filtered, paginated root
customer directory. PORTAL-003 adds a company Finance overview with
backend-rebuilt per-currency totals and cursor-paged recent activity.
PORTAL-004 adds explicitly run, read-only company reconciliation with
backend-reported consistency, checked counts, and findings. PORTAL-005 adds
read-only platform customer detail plus direct-subsidiary discovery and
permission-gated creation from the verified organization context. PORTAL-006
adds reviewed platform funding allocation and full compensating
reversal over ledger-derived balances and immutable history. PORTAL-007 adds
selected-organization gift-card inventory and reviewed issuance with validity
and capability choices. PORTAL-008 adds inventory-selected card detail,
immutable lifecycle history, and reviewed suspend, reactivate, cancel, and
due-expiration controls. PORTAL-009 adds reviewed single-recipient delivery
and synchronous all-or-nothing 1–100 item gift-card batches with transient
recipient contacts and backend-masked results. PORTAL-010 adds backend-filtered,
cursor-paged financial activity search by category, exact operation, currency,
literal business/card reference, and UTC date range. PORTAL-011 adds shared,
read-only organization audit investigation for authorized company staff and
platform operators, with exact operation/outcome/correlation filters and
deliberately disclosed technical evidence. PORTAL-012 adds organization team
and role administration with existing-account email selection, reviewed
disable/create/additive-grant/scoped-assignment actions, and read-only platform
customer-team visibility. PORTAL-016 adds platform-only POS payment reporting
with business-facing filters, backend-authored currency totals, and
receipt/refund detail. The browser never receives backend access or refresh
tokens and never asks a user to paste an organization, member, role,
assignment, card, batch, or audit UUID.

This is an open reference implementation, not a hosted card program or a claim
of production certification. Start with the
[architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md),
[deployment contract](docs/DEPLOYMENT.md),
[production-readiness matrix](docs/PRODUCTION_READINESS.md), and
[public publishing workflow](docs/PUBLISHING.md).

## Architecture

- React 19, TypeScript, Vite, React Aria, and Tailwind CSS provide the browser
  application.
- ASP.NET Core 10 provides a same-origin BFF and production static host.
- A portal-owned PostgreSQL database stores opaque browser sessions and
  Data Protection-encrypted backend token material.
- NSwag generates the backend client from `contracts/backend.openapi.json`.
- The authoritative backend is the public `open-giftcard` repository, consumed
  through the explicitly pinned snapshot documented in `contracts/README.md`.

The backend remains the only authority for authorization, tenancy, ownership,
and financial rules.

## Native Windows development

Docker is not required. Install:

- .NET SDK 10
- Node.js 24 or newer
- pnpm 11
- PostgreSQL 18, including `psql`

From the repository root:

```powershell
dotnet restore GiftCardPortal.slnx

Set-Location src\GiftCardPortal.Web
pnpm install --frozen-lockfile
pnpm exec playwright install firefox chromium
Set-Location ..\..
```

Create a dedicated local PostgreSQL database with separate non-superuser owner
and runtime logins; do not reuse the backend database or either backend role:

```sql
CREATE ROLE giftcard_portal_migrator
    LOGIN PASSWORD '<local migration password>'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE giftcard_portal_app
    LOGIN PASSWORD '<local password>'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE giftcard_portal OWNER giftcard_portal_migrator;
GRANT CONNECT ON DATABASE giftcard_portal TO giftcard_portal_app;
```

Start the pinned sibling backend at `http://localhost:5143`. In one PowerShell
window, start the BFF:

```powershell
$env:ConnectionStrings__Portal =
  "Host=localhost;Port=5432;Database=giftcard_portal;Username=giftcard_portal_app;Password=<local password>"
$env:ConnectionStrings__PortalMigrations =
  "Host=localhost;Port=5432;Database=giftcard_portal;Username=giftcard_portal_migrator;Password=<local migration password>"
dotnet run --project src\GiftCardPortal.Bff -- --migrate
$env:ConnectionStrings__PortalMigrations = $null
$env:Backend__BaseUrl = "http://localhost:5143"
dotnet run --project src\GiftCardPortal.Bff
```

In another window:

```powershell
Set-Location src\GiftCardPortal.Web
pnpm run dev
```

Open `http://127.0.0.1:5173`. Normal BFF startup never creates or alters its
session table. Run the explicit migration command before each application
upgrade; it is checksum-protected and safe to repeat.
Production must provide durable, protected Data Protection keys and a Secure
`__Host-` session cookie; the Development profile deliberately permits local
HTTP.

Outside Development the BFF also requires an HTTPS backend URL and an explicit
durable `DataProtection:KeysPath`. `/health` reports process liveness and
`/health/ready` verifies the portal-owned PostgreSQL session store.

The BFF sets one `X-Forwarded-For` value on backend login calls from the client
address it observed; it never relays a browser-supplied value. Configure the
BFF's immediate address under the backend's
`Networking:ForwardedHeaders:KnownProxies` allowlist. If the portal itself sits
behind another reverse proxy, configure that ingress as trusted at the portal
host so `Connection.RemoteIpAddress` represents the real client before it is
forwarded.

## Verification

Run the normal gates:

```powershell
dotnet test GiftCardPortal.slnx --configuration Debug

Set-Location src\GiftCardPortal.Web
pnpm peers check
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

For the disposable real-backend test, first install the backend-matched EF CLI:

```powershell
dotnet tool install dotnet-ef --tool-path .local\tools --version 10.0.10
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Run-PortalE2E.ps1
```

The E2E script verifies the sibling branch and commit, builds it into isolated
portal artifacts, creates only guarded `giftcard_portal_e2e_*` databases and roles,
applies all backend migrations, confirms semantic OpenAPI equality, bootstraps
separate platform and company staff journeys through public endpoints,
seeds disposable corporate-credit history, direct subsidiaries, and existing
staff accounts, runs
Firefox/Chromium/mobile directory, reviewed funding mutation, organization
structure, Finance, reconciliation, and reviewed gift-card issuance journeys,
reviewed lifecycle transitions with exact backend value return, reviewed
single-recipient distribution, atomic bulk issue-and-deliver batches, masked
recipient-result checks, six-filter financial activity search, and cleanup.
The same journeys verify organization and platform audit investigation,
technical-evidence disclosure, exact correlation filtering, URL-free state,
the explicit boundary that this is not a global sign-in log, plus read-only
platform team visibility and reviewed organization member/role administration.
The local backend's login-rate allowance is raised only inside this
multi-browser test process.
`-LeaveRunning` keeps that disposable preview active at
`http://127.0.0.1:5183` for manual review. Stop a retained preview and remove
its guarded database objects with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Stop-PortalPreview.ps1
```

## Production build

```powershell
dotnet publish src\GiftCardPortal.Bff --configuration Release
```

The publish target builds the frontend and places it under the BFF's
`wwwroot`. Deploy the BFF and SPA as one origin. Do not enable broad CORS on the
backend.
