# Portal Architecture

This is the staff and operations client for Open Giftcard. Backend hashes and
candidate labels recorded before the public-history squash are historical design
evidence, not public release identifiers.

## System boundary

The portal and backend are separate repositories. The portal consumes the
backend only through the pinned OpenAPI contract. It does not reproduce
authorization, tenant, financial, ownership, or organization-membership rules.

```text
Browser
  | same-origin cookie + antiforgery
  v
ASP.NET Core BFF / static host
  | bearer access token + optional X-Organization-Id
  v
Authoritative Open Giftcard API

BFF -> portal-owned PostgreSQL session store
```

## Browser application

`GiftCardPortal.Web` is a React/TypeScript single-page application. TanStack
Query owns server-state lifecycles. React Aria supplies accessible control
behavior. Tailwind CSS and semantic project tokens supply styling.

The application bootstraps through `/bff/session`, then presents exactly one of
these states:

1. unauthenticated login;
2. verified platform context plus the permission-shaped platform customer,
   reviewed funding, read-only customer-team, customer-scoped audit
   investigation, and cross-tenant POS payment-reporting workspaces;
3. authenticated identity plus backend-returned organization chooser;
4. verified organization shell with permission-shaped Finance, direct
   subsidiary, explicitly run reconciliation, and gift-card inventory,
   issuance, detail, lifecycle, single-recipient distribution, and atomic bulk
   batch, team, role, and scoped-assignment workspaces, plus
   organization-scoped audit investigation;
5. accessible loading, empty, forbidden, expired, or recoverable error state.

The browser stores no credentials or tokens in localStorage or sessionStorage.

## BFF and session model

The BFF exposes only portal-shaped `/bff/*` endpoints. Login exchanges
credentials with the backend, stores the resulting token pair server-side, and
returns an opaque random session cookie. Only a SHA-256 hash of that cookie is
stored. Token values are encrypted with ASP.NET Core Data Protection.

For backend login rate limiting, the BFF sets `X-Forwarded-For` from
`HttpContext.Connection.RemoteIpAddress`, normalizing IPv4-mapped IPv6. It
creates the outbound header itself and never copies or appends browser input.
The backend accepts one forwarded hop only when the immediate BFF address is in
its explicit known-proxy allowlist; otherwise the direct connection remains
authoritative.

Unsafe BFF routes require:

- a matching same-origin `Origin`;
- an antiforgery request token;
- the HttpOnly portal session cookie where authentication is required.

Production cookies are host-only, Secure, HttpOnly, and SameSite=Lax. The local
Development profile uses an explicitly named insecure cookie for native HTTP.

## Backend calls

NSwag generates `IBackendApiClient` at build time from the committed contract.
The BFF:

- forwards only its observed client address for login rate-limit partitioning;
- preserves backend-returned platform permissions for navigation only;
- calls the permission-gated platform customer directory without
  `X-Organization-Id`;
- calls the platform POS payment list and receipt report without
  `X-Organization-Id`, forwards only bounded business-facing filters, and keeps
  filter state plus opaque cursors out of browser URLs and storage;
- maps payment rows, backend-authored per-currency matching totals, and ordered
  immutable refund lines while omitting tenant, card, POS, refund, and Ledger
  identifiers; a payment provision ID survives only as a non-rendered receipt
  selector returned by the report;
- never recalculates payment, refund, net, reversal, or matching totals and
  offers no payment/refund mutation, owner enrichment, or pasted UUID filter;
- opens platform customer detail only from a selected directory result and
  calls it without `X-Organization-Id`;
- reads platform customer corporate-credit balances and immutable allocation
  history without `X-Organization-Id`, preserving backend currency separation,
  order, and opaque cursors;
- accepts reviewed allocation and full-reversal intents only through
  same-origin CSRF-protected BFF routes, derives namespaced idempotency keys
  from hidden in-memory operation UUIDs, and leaves all financial validation
  and authorization to the backend;
- omits organization, ledger, actor, and idempotency identifiers from funding
  responses while retaining a non-rendered allocation selector for reversal;
- calls organization discovery without `X-Organization-Id`;
- accepts only an organization returned by that discovery call;
- verifies selection through `/api/v1/me` with `X-Organization-Id`;
- persists both the verified selected organization and its backend-returned
  economic tenant root in the server-side session;
- resolves direct-subsidiary paths and `X-Organization-Id` from the verified
  selected organization, never from browser input or the economic tenant root;
- sends only trimmed name and code for subsidiary creation and leaves
  hierarchy, uniqueness, authorization, and tenant enforcement to the backend;
- derives organization team, role, and assignment paths plus
  `X-Organization-Id` only from the verified server-side selection;
- opens the platform customer roster only for a backend-directory selection,
  sends no organization context header, and offers no platform-side mutation
  or impersonation;
- maps authorized memberships to email, status, and times while omitting user
  and organization IDs, retaining membership and role IDs only as non-rendered
  selectors;
- accepts only an existing active staff email for membership creation, blocks
  self-membership disable at the BFF as a lockout safeguard, and leaves
  identity lookup, membership authorization, and tenant rules to the backend;
- builds additive grant choices from the current backend-returned effective
  permissions, omits permissions already held by the selected role, and leaves
  catalogue and grant-authority validation to the backend;
- permits only `Organization` and `Subtree` assignment intents, anchors them
  server-side to the verified organization, and never accepts browser-provided
  anchor or selected-organization IDs;
- resolves gift-card inventory and issuance paths plus `X-Organization-Id`
  exclusively from the verified selected organization in the server-side
  session;
- forwards inventory cursors opaquely and maps cards to business-facing fields
  while retaining their IDs only as non-rendered selectors;
- accepts reviewed issuance only through a same-origin CSRF-protected route,
  derives a namespaced idempotency key from a hidden in-memory operation UUID,
  and leaves funding, validity, currency, ownership, lifecycle, and audit rules
  to the backend;
- opens card lifecycle detail only from a backend-returned inventory selector,
  resolves all lifecycle paths and tenant headers from the selected
  server-side organization, and never exposes a card UUID as user input;
- accepts reviewed suspend, reactivate, cancel, and expire intents through
  CSRF-protected routes, derives action-namespaced idempotency keys from hidden
  operation UUIDs, and leaves transition, due-time, concurrency, and value
  return decisions to the backend;
- maps immutable lifecycle history to action, state change, reason, occurred
  time, and optional backend-returned amount while omitting actor, tenant,
  Ledger, correlation, lineage, invitation, and idempotency identifiers;
- distributes a single card only from a backend-returned inventory selector,
  derives its organization path and tenant header from the verified session,
  and clears the full recipient contact after reviewed submission;
- creates reviewed 1–100 item issue-and-deliver batches with transient recipient
  contacts, hidden operation identities, and backend-owned atomic, financial,
  delivery, and audit rules;
- retains a just-created batch selector only in browser memory for
  current-session refresh, preserves backend item order, and returns only
  public references, business state, masked contacts, times, and authoritative
  per-currency totals;
- never proxies claim secrets, claim URLs, passwords, invitation IDs, actor or
  membership IDs, tenant IDs, Ledger IDs, or backend idempotency keys;
- omits funding, issuing, owner, ledger, lineage, distribution, actor,
  membership, and idempotency identifiers from card responses;
- resolves financial-report paths and `X-Organization-Id` exclusively from
  that stored tenant root;
- maps backend-rebuilt summary and history into safe portal contracts without
  exposing entity or actor identifiers;
- normalizes a bounded business-facing financial-history filter set at the BFF,
  forwards category, exact operation, uppercase currency, literal reference,
  inclusive UTC start, and exclusive UTC end to the backend, and keeps the
  applied browser filter state in memory rather than URLs or storage;
- forwards financial-history cursors opaquely under the backend-bound normalized
  filter set, preserves backend ordering and inclusion, and never aggregates
  currencies or calculates an authoritative balance;
- resolves organization audit paths and `X-Organization-Id` exclusively from
  the verified server-side organization selection;
- opens platform audit investigation only for a customer selected from the
  backend-returned directory, sends no organization context header, and leaves
  cross-customer authorization to the backend;
- bounds and forwards exact operation, outcome, and correlation filters, treats
  cursors as opaque, and keeps all audit investigation state out of browser
  URLs and storage;
- maps append-only evidence into a privacy-reduced portal shape that omits the
  audit-record, actor-membership, and organization-scope IDs, while requiring
  deliberate disclosure for actor, entity, correlation, and metadata
  references;
- never presents the organization-scoped endpoint as a global sign-in log and
  provides no portal-side audit mutation, repair, export, persistence, actor
  enrichment, or evidence authority;
- invokes reconciliation only after explicit user action, omits the report
  organization ID, and maps backend severity values into display labels;
- keeps reconciliation entity IDs out of the primary workflow and exposes them
  only through deliberately opened technical detail;
- never recalculates consistency or offers portal-side financial repair;
- serializes refresh per portal session in-process and across replicas with a
  PostgreSQL advisory lock;
- retries an unauthorized request at most once;
- preserves the session on forbidden responses;
- clears invalid stored organization context;
- attempts remote revoke on logout and always deletes the local session.

The pinned OpenAPI describes lifecycle action, recipient-contact, audit actor,
and audit outcome values as integers, while the pinned backend runtime
serializes their enum names. Narrow generated-client converters accept only the
known integer or named values and write the contract's integer form. These
adapters contain no transition, recipient-normalization, delivery, permission,
or audit-inclusion rules; unknown values still fail closed. The additive
`PosClient` audit actor is accepted and displayed as `POS client`.

## Persistence and deployment

Portal sessions live in a portal-owned PostgreSQL database and expire with the
backend refresh token. Data Protection keys persist under `.local` only for
native development. Production requires a durable shared key location protected
by the deployment platform.

Outside Development the host fails startup for HTTP backend transport,
insecure/non-`__Host-` session cookies, or a missing durable key path. It
processes one forwarded address/proto hop only when the immediate ingress has a
literal allowlist entry; with no entry the middleware is absent and trusts no
forwarding header. `/health` is liveness and `/health/ready` checks only the
portal session database/table. Exact configuration and promotion checks live in
`docs/DEPLOYMENT.md`.

`dotnet publish` builds the frontend into the BFF's `wwwroot`. The resulting
application is deployed as one origin. The backend remains bearer-only and does
not require broad browser CORS. CI rebuilds the frontend and compares every
committed production-bundle path and SHA-256 so source and served assets cannot
drift silently.

## Accessibility and responsive behavior

English is the initial language. Firefox is primary, Chromium secondary, and
Chromium runs axe. The layout supports keyboard use, reduced motion, 200% zoom,
and mobile through desktop widths. Automated axe is a safety net; semantic HTML,
focus behavior, contrast, zoom, and responsive review remain required.
