# Portal Decisions

This document records accepted portal decisions. Backend domain and authorization
rules remain authoritative in the sibling `open-giftcard` repository.

Backend hashes and candidate labels recorded before the public-history squash
are historical design evidence, not public Open Giftcard releases. Current
publishing rules live in `PUBLISHING.md`.

## ADR-P001: Portal architecture and secure browser session

- Status: Accepted
- Date: 2026-07-28
- Scope: PORTAL-001

### Context

ADR-037 in the backend repository requires a separate frontend repository, an
OpenAPI client contract, a same-origin backend-for-frontend (BFF), server-side
access and refresh tokens, an HttpOnly/Secure browser session, CSRF protection,
and no broad backend CORS.

### Decision

- Use ASP.NET Core 10 for the BFF and static production host.
- Use React 19, TypeScript, and Vite for a client-rendered application shell.
- Pin TypeScript 6 for the current `typescript-eslint` compatibility range;
  upgrade TypeScript only when the lint toolchain supports the newer major.
- The browser talks only to same-origin `/bff/*` routes. It never receives or
  stores backend access or refresh tokens.
- Generate the backend client from a committed OpenAPI snapshot taken from
  backend branch `feat/impl-017-frontend-client-enablement` at commit
  `741bed278241eb65198bdb68d490f3eb92537ed8`.
- Persist opaque portal sessions in a portal-owned PostgreSQL database. Encrypt
  backend token material with ASP.NET Core Data Protection.
- Store the selected organization context in the server-side session. Verify a
  selection through `GET /api/v1/me` with `X-Organization-Id`; do not accept
  pasted organization identifiers.
- Serialize token refresh per session and retry an unauthorized backend request
  at most once.
- Protect unsafe BFF routes with antiforgery validation and same-origin checks.
- Use a host-only, HttpOnly, SameSite=Lax session cookie. Require Secure outside
  the native HTTP development profile.
- Do not reproduce backend authorization, tenant, ownership, or financial rules
  in the portal.

### Consequences

- The BFF is security-sensitive and receives integration coverage for cookie,
  CSRF, refresh, logout, and organization-context behavior.
- A PostgreSQL service is required for native development and tests that exercise
  persisted sessions.
- Backend contract drift is detected before generated client changes are
  accepted.

## ADR-P002: Component and styling system

- Status: Accepted
- Date: 2026-07-28

### Decision

- Use React Aria primitives for accessible interaction behavior.
- Use Tailwind CSS with project-owned semantic design tokens and components.
- Keep domain-facing UI components in the portal; keep authorization decisions
  in the backend.
- Ship a neutral, project-owned brand mark and palette. The portal carries no
  third-party wordmark, logo, or trade dress.

  Superseded 2026-08-18. This ADR originally specified a wordmark and colors
  sampled from a third party's public website, kept as a provisional review
  asset and explicitly not a declaration of trademark or redistribution rights.
  Both were removed before open-source publication: the sampled logo was
  replaced with an SVG placeholder, and the sampled palette was replaced with an
  indigo ramp chosen to match the previous relative luminance of every token, so
  every documented contrast ratio carries over unchanged.

### Brand tokens

- Brand indigo: `#A69EFF`
- Action indigo: `#4736FF`
- Deep indigo: `#1300E3`
- Primary text: `#0F1719`
- Subtle surface: `#F2F6F7`
- Border: `#D3DCDF`
- White: `#FFFFFF`

Brand indigo measures 2.34:1 on white and is a surface and mark colour only,
never text. Action indigo measures 6.48:1 on white and carries links, focus
indicators, and primary actions. Replacing these is a token edit in
`src/styles.css`; nothing else hard-codes a brand colour.

## ADR-P003: Language and browser targets

- Status: Accepted
- Date: 2026-07-28

### Decision

- English is the default and initial interface language.
- Structure copy so Turkish localization can be added without changing feature
  behavior; PORTAL-001 does not ship a language switcher.
- Firefox is the primary interactive development and end-to-end target.
- Chromium is the secondary end-to-end target and the automated accessibility
  target.
- Meet WCAG 2.2 AA for the PORTAL-001 journey and support keyboard-only use,
  browser zoom, reduced motion, and responsive layouts.

## ADR-P004: Test strategy

- Status: Accepted
- Date: 2026-07-28

### Decision

- Vitest and Testing Library cover frontend components and state behavior.
- xUnit covers BFF units and HTTP integration behavior.
- A contract check protects the committed backend OpenAPI snapshot and generated
  client.
- Playwright covers the native end-to-end journey against the real pinned
  backend in Firefox and Chromium.
- axe-core runs against the Chromium journey as an automated accessibility
  safety net; manual keyboard, zoom, contrast, and responsive checks remain
  acceptance requirements.

## ADR-P005: Platform customer directory before finance workflows

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-002

### Context

PORTAL-001 established organization-member access, but a user whose verified
`/me` context is `Platform` has no complete Platform operator workspace. The pinned
backend already exposes a purpose-built, permission-gated root-customer
directory for independent frontends. Company finance reporting is also ready,
but it can reuse the existing organization shell in a later slice.

### Decision

- Complete the platform authority path before adding company finance workflows.
- Make PORTAL-002 a read-only platform customer directory using
  `GET /api/v1/organizations`.
- Preserve `platformPermissions` from `/me` for navigation and feedback only;
  the backend continues to enforce `platform.organizations.view`.
- Support backend-defined literal name/code search, exact status filtering, and
  bounded offset pagination.
- Keep platform discovery separate from organization membership selection and
  never send `X-Organization-Id`.
- Defer customer creation, customer detail, impersonation, finance reporting,
  and organization administration.

### Consequences

- platform operators receive a coherent first workflow and platform users no longer
  fall into the organization-member empty state.
- PORTAL-003 can focus on a company Finance overview without also changing the
  platform-context foundation.
- Platform directory tests must prove query forwarding, missing-header behavior,
  backend permission enforcement, and session preservation on forbidden
  responses.

## ADR-P006: Finance overview before reconciliation

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-003, followed by PORTAL-004

### Context

The secure organization shell is complete and the pinned backend exposes three
root-scoped, read-only financial report contracts. Summary and history form one
daily Finance overview, while reconciliation has distinct operational meaning
and findings that need dedicated explanation. Combining all three into one
large change would weaken independent review and acceptance.

### Decision

- Make PORTAL-003 a company Finance overview using the backend financial
  summary and stable cursor-paged history.
- Resolve the report organization exclusively from the selected server-side
  portal session and send that same tenant root in the backend path and
  `X-Organization-Id`.
- Use the composite organization finance permissions to shape navigation and
  feedback only; backend authorization remains authoritative.
- Display backend-rebuilt per-currency amounts without aggregating currencies
  or calculating an authoritative balance in the portal.
- Keep backend history cursors opaque and expose only bounded “Load more”
  pagination in this slice.
- Make PORTAL-004 a separate read-only reconciliation slice after PORTAL-003 is
  verified, committed, and pushed.
- Defer exports, server-side history filters, automated remediation, financial
  mutations, and recipient-facing reporting.

### Consequences

- Finance users receive useful totals and recent activity before operational
  reconciliation concepts are introduced.
- Summary and activity may fail independently; the UI must preserve useful
  partial data and retry the failed region.
- Reconciliation can receive focused accessibility, explanation, and
  real-backend coverage without expanding PORTAL-003.

## ADR-P007: Explicit read-only reconciliation and technical detail

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-004

### Context

The pinned backend exposes a deterministic, read-only reconciliation report
that compares Phase 2 financial records with immutable Ledger postings. Running
that report has distinct operational meaning, and its findings can contain raw
entity identifiers useful for investigation but unsuitable for the portal's
normal business workflow.

### Decision

- Add reconciliation as a separate organization workspace beside Overview.
- Require an explicit "Run reconciliation" action; do not imply that an
  unrequested or cached result is current.
- Resolve the organization solely from the selected server-side session and
  use the same tenant root for the backend path and `X-Organization-Id`.
- Render the backend's consistency result, counts, time, severities, messages,
  and returned amount comparisons without recomputing or reclassifying them.
- Keep raw entity identifiers collapsed inside a deliberate "Technical
  reference" disclosure. Users never paste or manually handle identifiers.
- Offer retry and "Run again" actions, but no repair, remediation, or financial
  mutation.
- Preserve the last successful result if a later run fails, while clearly
  announcing the failure.

### Consequences

- The initial state explains what will be checked and lets the user choose when
  to run the report.
- Operational findings remain traceable for support without making UUIDs part
  of the primary user experience.
- Backend authorization and financial truth remain authoritative; the portal
  is a presentation and session-boundary client only.

## ADR-P008: Eight-slice operational portal roadmap

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-005 through PORTAL-012

### Decision

Complete the remaining broad operational portal in eight sequential slices:

1. Organization Details and Subsidiaries
2. Funding Operations
3. Gift Card Inventory and Issuance
4. Gift Card Detail and Lifecycle Controls
5. Distribution and Bulk Batches
6. Searchable Transactions and Reporting
7. Audit Investigation
8. Team, Roles, and Permissions

Each slice remains independently reviewable and publishable. A later slice may
be narrowed or split only when a newly discovered backend limitation or an
important security, tenancy, financial, deployment, or major UX decision makes
that necessary.

### Consequences

- Work proceeds without repeatedly reopening the overall product order.
- Every branch must preserve all previously completed slices and pass the full
  regression and real-backend journey.
- Production hosting, approved brand assets, and additional localization remain
  cross-cutting release decisions rather than hidden assumptions in a product
  slice.

## ADR-P009: Context-specific organization discovery

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-005

### Context

The backend exposes platform-only root-customer detail and organization-scoped
direct-subsidiary operations. Root-customer creation is technically available,
but a newly created customer is not usable until an initial administrator is
assigned through a separate platform workflow.

### Decision

- Let platform operators open a customer detail selected from the existing
  backend-returned directory. The BFF forwards no organization context and the
  backend enforces `platform.organizations.view`.
- Let organization members list direct subsidiaries and, when permitted,
  create one using name and code only.
- Resolve the subsidiary parent path and `X-Organization-Id` from the same
  BFF-held selected organization. The browser cannot choose either value.
- Preserve backend order and bounded offset paging; do not synthesize a
  recursive organization tree.
- Use effective permissions for navigation and feedback only.
- Defer root-customer creation until the administration slice can pair it with
  coherent initial-administrator onboarding.

### Consequences

- PORTAL-005 gives both existing authority contexts a useful organization
  workflow without introducing impersonation or incomplete onboarding.
- Platform detail can use a selected resource ID because platform operators
  intentionally work across root customers; organization members remain bound
  to their verified server-side context.
- Backend validation, hierarchy, uniqueness, permission-scope, RLS, and audit
  behavior remain authoritative.

## ADR-P010: Reviewed platform funding operations and hidden idempotency

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-006

### Context

The backend exposes platform-only corporate-credit allocation and compensating
reversal commands, plus platform-or-organization balance and immutable-history
reads. Financial retries require an idempotency key, but a portal user should
never invent, paste, or manage that technical identity.

### Decision

- Put funding operations in the platform customer-detail workflow. The selected
  customer and any reversible allocation must originate in backend-returned
  platform data.
- Send no `X-Organization-Id`; the backend's platform authorization path
  enforces view, allocate, and reverse permissions independently.
- Require an inline review and explicit confirmation before either mutation.
  A reversal always targets the complete returned allocation and explains that
  it appends an immutable compensating operation.
- Generate a fresh browser-memory operation UUID when an intent enters review.
  Send it invisibly to the BFF, which validates it and derives an
  operation-namespaced backend idempotency key. Preserve it for retry and
  replace it whenever the user changes or completes the intent.
- Do not put operation UUIDs or backend idempotency keys in localStorage,
  sessionStorage, URLs, logs, or visible UI.
- Parse entered amount text into `decimal` at the BFF boundary, but leave
  allowed range, scale, currency, eligibility, balance, and conflict decisions
  to the backend.
- Return business-facing amounts, currencies, references, times, and reversal
  state. Omit organization, ledger transaction, actor, and idempotency
  identifiers; retain but do not display the allocation ID needed for a
  returned-row reversal action.

### Consequences

- A safe retry from the reviewed state reaches backend idempotency with the
  same intent key, while changed intent remains an authoritative conflict.
- Reloading abandons an unconfirmed browser draft rather than persisting
  financial intent. Completed or uncertain outcomes are rediscovered through
  authoritative allocation history.
- The portal never calculates balances, performs partial reversal, deletes
  history, or treats client permission shaping as financial authority.

## ADR-P011: Selected-context card issuance with reviewed validity

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-007

### Context

The backend exposes organization-scoped inventory and ledger-funded issuance.
Issuance can draw from the backend-resolved tenant-root credit account for a
permitted descendant, requires an expiration timestamp, and supports optional
valid-from, transferable, and divisible choices. The backend response also
contains internal tenancy, ledger, lineage, actor, and idempotency identifiers
that the portal does not need.

### Decision

- Put inventory and issuance in a dedicated Cards workspace under the verified
  organization shell. Both the backend route and `X-Organization-Id` come only
  from the BFF session's selected organization.
- Shape visibility independently with `organization.gift_cards.view` and
  `organization.gift_cards.issue`; always rely on backend authorization.
- Show the non-credential public reference, business reference,
  amount/currency, lifecycle and ownership labels, validity window, issued
  time, and transferable/divisible capabilities. Preserve backend order and
  opaque cursors.
- Require an inline review and explicit confirmation that names the selected
  organization and every issuance choice. Keep valid-from optional so the
  backend can use its posting time; require an explicit expiration input
  because the backend contract requires it.
- Convert browser-local date/time inputs to ISO UTC values before sending them
  to the BFF. The BFF verifies parseability only; chronological validity and
  every financial/business rule remain backend-owned.
- Generate a fresh browser-memory operation UUID when an issuance intent enters
  review. Send it invisibly to the BFF, which derives a namespaced backend
  idempotency key. Preserve it for retry and replace it after edits or success.
- Omit funding, issuing, owner, ledger, lineage, distribution, actor,
  membership, and idempotency identifiers from BFF responses. Retain but never
  render the card ID needed for the next detail slice.

### Consequences

- Users issue only into their verified current organization and never manage
  tenant or technical identifiers.
- A safe retry reaches backend idempotency with the same reviewed intent, while
  changed intent receives a new operation identity.
- The portal does not estimate available credit or pre-decide descendant
  funding, validity, currency, amount, ownership, ledger, or audit outcomes.
- Card detail, lifecycle controls, distribution, and bulk issuance remain
  explicitly deferred to their later slices.

## ADR-P012: Inventory-selected lifecycle detail and reviewed controls

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-008

### Context

The backend exposes organization lifecycle history and suspend, reactivate,
cancel, and expire commands for a card issued by the exact selected
organization. History returns the current card plus immutable events, but also
contains internal tenant, actor, correlation, Ledger, invitation, lineage, and
idempotency identifiers. Cancellation and expiration are terminal financial
operations; the backend alone determines eligibility and exact value return.

### Decision

- Open lifecycle detail only from a card returned by selected-organization
  inventory. Keep its card ID as an internal selector and never render it, put
  it in an editable field, or treat it as authorization.
- Derive the organization path and `X-Organization-Id` from the verified
  server-side session. The backend validates the selected card against the
  exact issuing organization and tenant root.
- Shape detail visibility with `organization.gift_cards.view` and action
  visibility with `organization.gift_cards.lifecycle.manage`; backend
  permission and transition enforcement remain authoritative.
- Present immutable history in backend order using action, previous/new state,
  reason, returned amount/currency when present, and occurred time. Omit event,
  actor, membership, correlation, Ledger, organization, invitation, lineage,
  and idempotency identifiers.
- Require a normalized reason, inline review, and explicit confirmation for all
  four administrative actions. Give cancellation and expiration a stronger
  terminal warning and never estimate their financial result.
- Use current lifecycle/ownership state and the browser's due-time comparison
  only to reduce obviously inapplicable controls. Clearly retain the backend
  server clock and transition rules as final authority.
- Generate a fresh hidden in-memory operation UUID for each reviewed intent.
  The BFF derives an action-namespaced idempotency key, preserves it for an
  unchanged retry, and never returns or displays it.
- Refresh current detail and inventory after every successful action. Also
  refresh Finance summary/history and discard reconciliation after terminal
  actions because only the backend can report resulting financial truth.

### Consequences

- Users manage only cards discovered in their current verified context and
  never paste technical identifiers.
- Stale UI state can receive a safe backend conflict and recover by refreshing
  detail; the portal does not copy transition rules as an authority.
- Lifecycle history is useful for operations while actor-level investigation
  and raw audit references remain deferred to PORTAL-011.
- A real-backend journey can suspend, reactivate, and cancel a disposable
  issued card, proving immutable history and exact returned value without
  leaving cross-browser financial residue.

## ADR-P013: Transient recipient delivery and current-session batch results

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-009

### Context

The backend can distribute one organization-inventory card to an email or phone
recipient and can atomically issue and distribute 1–100 new cards. Distribution
changes ownership without moving value. Bulk creation is synchronous,
all-or-nothing, financially effective, and returns a durable result containing
masked contacts plus internal tenant, invitation, actor, and idempotency
identifiers. The backend provides direct batch lookup but no batch-list
operation.

### Decision

- Reach single distribution only from backend-returned selected-organization
  inventory. Reach batch refresh only from the selector returned by batch
  creation. Never render or request a card or batch UUID.
- Derive every organization route and `X-Organization-Id` header from the
  verified server-side selected organization.
- Shape single delivery with `organization.gift_cards.distribute`, batch
  creation with both `organization.gift_cards.issue` and
  `organization.gift_cards.distribute`, and batch refresh with
  `organization.gift_cards.view`; the backend remains authoritative.
- Treat the entered recipient contact as transient sensitive business input.
  Show it during edit and explicit review only. After success, clear it and
  expose only the backend-masked contact; never put it in browser/session
  storage, URLs, logs, or durable portal responses.
- Do not expose or proxy claim secrets, claim URLs, passwords, invitation IDs,
  tenant IDs, actor or membership IDs, Ledger IDs, or backend idempotency keys.
  Recipient activation belongs to the separate cardholder application.
- Require inline review for both operations. Explain that a single distribution
  changes ownership only, while a batch issues and delivers all rows in one
  synchronous all-or-nothing transaction.
- Use an accessible structured row builder for 1–100 batch items. File/CSV
  import is deferred so this slice does not silently introduce file retention,
  parsing, mapping, or partial-import policy.
- Generate one hidden in-memory operation UUID per reviewed intent. The BFF
  derives separate single-distribution and batch idempotency keys and preserves
  one key for an unchanged retry.
- Preserve backend batch order and render only backend-returned completion,
  public card references, item/business references, masked contacts, delivery
  and card states, times, and per-currency totals.
- Keep the just-created batch selector in browser memory only and permit a
  current-session refresh. Do not persist business selectors in the portal
  session or ask users to paste UUIDs merely to compensate for the missing
  backend batch-list endpoint.

### Consequences

- Recipient PII is available long enough to verify the intended send but does
  not become a second portal-owned recipient directory.
- Single delivery does not trigger a Finance refresh; bulk success does because
  issuance moves authoritative value before ownership changes.
- A page reload abandons the direct batch-result selector. Durable batch
  discovery requires a future backend list/search contract or a separately
  accepted storage design; the portal will not invent one.
- The manual row builder supports the complete backend intent and atomic
  semantics, while high-volume CSV ergonomics remain an explicit later UX
  decision.

## ADR-P014: Financial transaction search authority

- Status: Accepted
- Date: 2026-07-29
- Scope: PORTAL-010

### Context

PORTAL-010 is intended to provide searchable transactions and reporting. The
pinned backend's organization financial-history route currently accepts only a
bounded page size and opaque cursor. It does not provide server-side business
reference, category, operation, currency, or date-range filtering, transaction
detail, or export. Filtering browser-loaded pages can improve local navigation
but cannot prove that unloaded history contains no match.

The audit-investigation route supports exact operation, outcome, and
correlation filters, but it has a different permission, privacy, and
investigation purpose and is reserved for PORTAL-011.

### Decision

- Complete a focused backend contract extension before PORTAL-010 portal
  scaffolding.
- Add optional financial-history category, operation, currency, literal
  business/public-reference search, and UTC range filters under the existing
  organization reporting permission and tenant-root boundary.
- Normalize filters server-side and cryptographically or structurally bind the
  complete normalized filter set into opaque cursor validation.
- Preserve bounded, stable newest-first results and return the existing
  business-facing history shape; do not introduce a second transaction store
  or portal-side financial authority.
- Repin the portal only after the backend OpenAPI, implementation, integration
  tests, and branch commit are reviewed and published.
- Keep report export out of the slice until field selection, authorization,
  sensitive-data handling, formula-injection defense, download audit, and
  retention expectations are separately accepted.

### Consequences

- The authoritative backend contract and the portal's pinned commit will
  advance through a separately verified and published backend slice.
- Existing callers remain compatible because every new filter is optional and
  an unfiltered request keeps the current stable cursor-paged behavior. The
  independently developed cardholder application is not modified.
- PORTAL-010 portal scaffolding remains paused until the new backend commit is
  published and recorded.

### Reviewed backend result

- The authoritative extension is
  `feat/impl-018-financial-history-search` at
  `a42b18d114216d4c78c3fa1c951282e8479a9342`.
- The exact served OpenAPI snapshot has SHA-256
  `152FE8D9804E890E461DAF4366B8E2269C32EB3A15F15CAECA49D7385CC8443D`.
- Review confirmed that the snapshot changes only the organization
  financial-history description and its six optional search parameters;
  cardholder reporting shapes remain unchanged.

## ADR-P015: Audit investigation scope and disclosure

- Status: Accepted
- Date: 2026-07-30
- Scope: PORTAL-011

### Context

The pinned backend exposes one append-only, permission-protected audit history
route for an exact organization scope. It supports stable opaque paging plus
exact operation, outcome, and correlation filters. The response contains
investigation evidence including actor, entity, correlation, and metadata
references. The backend guarantees tenant RLS, named organization/platform
permissions, parameterized filters, and credential-free audit records.

The contract does not expose actor profile lookup, audit date-range search,
global authentication history, customer discovery under audit permission alone,
or export. Organization-scoped investigation therefore must not be described as
a complete identity-login log or silently supplemented with browser filtering.

### Decision

- Provide one shared read-only investigation workspace with two safe entry
  points:
  - organization staff use only the exact organization held in their verified
    server-side portal session; and
  - a platform operator uses only a customer selected from the
    backend-returned platform directory. The BFF forwards no organization
    context header for this platform call and the backend remains the final
    cross-customer authority.
- Shape availability with `organization.audit.view` and `platform.audit.view`
  independently. Browser permission checks affect navigation and feedback only.
- Support the backend's exact operation, outcome, and correlation filters with
  deliberate apply/clear actions. Keep filters and cursors in memory, reset
  paging whenever filters or target change, and never place investigation state
  in URLs or browser storage.
- Render operation, outcome, occurred time, actor type, and entity type as the
  primary evidence. Put actor user reference, entity reference, correlation
  reference, and backend-curated metadata behind a deliberate technical-details
  disclosure.
- Omit the audit-record ID, actor-membership ID, and redundant organization
  scope ID from portal responses. Do not add actor names or emails without an
  authoritative lookup contract, and do not reinterpret metadata.
- Preserve backend order and outcome values, treat cursors as opaque, and state
  clearly that only backend-returned organization-scoped records are shown.
- Do not add export, portal persistence, raw JSON, Elasticsearch, mutation,
  deletion, or repair in this slice.

### Consequences

- Investigators receive useful correlation and entity evidence without turning
  technical identifiers into navigation or tenancy controls.
- Platform audit investigation requires a customer already discoverable through
  the platform directory; users are never asked to paste an organization UUID.
- Global sign-in events are outside this organization-scoped contract and are
  not implied by the portal.
- The backend remains authoritative for audit inclusion, credential exclusion,
  append-only integrity, tenant isolation, permission, filter semantics, and
  stable order.

## ADR-P016: Team administration and backend enablement

- Status: Accepted
- Date: 2026-07-30
- Scope: PORTAL-012 / backend IMPL-020

### Context

The pinned backend can list/create/disable memberships, list/create roles,
grant permissions, and create scoped assignments. However, membership records
contain only user UUIDs, creation accepts only a user UUID, and assignments
cannot be listed. Using that contract directly would require pasted technical
identifiers and would prevent an authoritative access review after reload.

The user previously approved small backend extensions when they do not
materially affect the independently developed cardholder app. These gaps are
isolated to organization membership and role management.

### Decision

- Complete and publish an additive backend slice before portal scaffolding:
  preserve UUID-based membership creation, add existing-active-user selection
  by email, add nullable staff email to authorized membership responses, and
  add read-only role-assignment listing.
- Keep email lookup behind `organization.memberships.create`; protect email
  disclosure with `organization.memberships.view` or
  `platform.organizations.memberships.view`. Never return passwords, sessions,
  recipient phone identifiers, or normalized credentials.
- Add an organization Team workspace with independently permission-shaped
  roster, add-existing-account, disable, role list/create, additive permission
  grant, and assignment capabilities. Add a read-only platform customer roster.
- Derive every organization path and header from verified server-side context
  for company staff. Platform roster targets come only from the
  backend-returned customer directory and send no organization context header.
- Keep membership, role, and assignment IDs non-rendered. Use member email and
  role name for controls; require review before disable, grant, or assignment.
- Offer only `Organization` and `Subtree` assignment scopes, anchored to the
  selected organization. Defer `SelectedOrganizations` until a complete,
  backend-validated descendant selector exists; never ask users to paste UUIDs.
- Build grant choices only from the current backend-returned effective
  permissions and omit permissions already held by the role. The backend still
  validates catalogue membership and the caller's authority.
- Do not offer self-membership disable in the current session. This is a UX
  lockout safeguard, not a replacement for backend authorization.

### Consequences

- PORTAL-012 can be useful and reload-safe without copying a permission
  catalogue, exposing technical selectors, or inventing identity data.
- Membership addition covers an existing active staff account only. Global user
  creation, invitation delivery, password setup/reset, and account discovery
  remain separate platform/identity concerns.
- Permission grants and role assignments remain additive because the backend
  has no revoke contract. Role deletion and assignment removal are not implied.
- The cardholder application and all cardholder endpoints remain unchanged.

## ADR-P017: Converged backend pin and observed-address login forwarding

- Status: Accepted
- Date: 2026-07-31
- Scope: PORTAL-013 / backend IMPL-021

### Context

Backend IMPL-019 and IMPL-020 were independently published sibling commits.
IMPL-021 converges the cardholder claim-session/proxy contract and portal team
contract into one revision on backend `main`. Login is also rate-limited per
source address; without forwarding, every portal user behind the BFF would
share the BFF server's partition.

### Decision

- Repin the portal to exact backend `main` commit
  `4b204c4034d9140b0fc2813fca135d77cce89780` and capture its served OpenAPI.
- Accept the optional cardholder claim-session property as an unused additive
  contract; never bind it into a portal browser response.
- Set one outbound `X-Forwarded-For` value for login from
  `HttpContext.Connection.RemoteIpAddress`, normalizing IPv4-mapped IPv6.
- Never copy, append, or relay a browser-supplied forwarding header.
- Require the backend to trust the immediate BFF address explicitly and only
  one hop. If the portal has its own ingress, configure that trust separately
  so the application-observed connection address is meaningful.

### Consequences

- Portal and cardholder clients now share one authoritative backend revision.
- Login quotas partition by observed browser address when deployment trust is
  configured correctly, while an untrusted topology fails safe to the direct
  peer address.
- No new browser credential, portal authority, business behavior, database
  object, or backend endpoint is introduced.

## ADR-P018: Fail-closed deployment boundary

- Status: Accepted
- Date: 2026-08-01
- Scope: RELEASE-001

### Context

The completed portal is secure in its intended topology, but its baseline
configuration still permits an operator to start a non-Development host with
an HTTP backend URL or an implicit local Data Protection path. It also needs an
explicit, testable ingress trust boundary before forwarding an observed client
address to the backend.

### Decision

- Require an HTTPS backend URL, secure `__Host-` cookies, and an explicitly
  configured durable Data Protection key path outside Development.
- Process `X-Forwarded-For` and `X-Forwarded-Proto` only from literal trusted
  proxy addresses, with a one-hop limit. An empty allowlist trusts nothing.
- Keep liveness process-only and make readiness verify only the portal-owned
  PostgreSQL session database. Monitor backend readiness separately.
- The private development repositories used a synchronized `v0.2.0-rc.1`
  marker. It is historical evidence only and is not a public Open Giftcard
  release. Public release governance is defined by `PUBLISHING.md`.

### Consequences

- A production-shaped host fails at startup instead of silently weakening
  transport, cookie, key persistence, or client-address assumptions.
- Hosting-specific addresses, paths, DNS names, certificates, and secrets stay
  external configuration and are not guessed or committed.
- No backend token enters browser-readable storage and no business rule moves
  into the portal.

## ADR-P019: Platform payment reporting without technical identifier entry

- Status: Accepted
- Date: 2026-08-05
- Scope: PORTAL-016 / backend IMPL-030

### Context

The backend now provides a platform-only PostgreSQL report over authoritative
payment provisions and immutable refunds. Its full API filter set includes POS
client, terminal, and funding-organization UUIDs, but the portal has no
authorized discovery contract for turning those identifiers into user choices.
Asking an operator to paste them would violate the established portal UX and
could imply authority the browser does not have.

### Decision

- Add a top-level, read-only `POS payments` platform workspace gated in
  navigation by `platform.payments.view`; backend permission and RLS checks
  remain authoritative and no organization context header is sent.
- Offer store reference, exact payment state, currency, literal receipt/card
  reference, and inclusive-through UTC date filters. Keep applied filters and
  opaque cursors in memory rather than URLs or browser storage.
- Present the backend's all-matching count and currency-separated totals
  verbatim. Do not aggregate currencies or derive payment, refund, reversal, or
  net values in the portal.
- Open receipt/refund detail only from a backend-returned result and retain its
  provision ID only as an internal selector. Omit all technical UUIDs, owner
  identity, credentials, POS secrets, idempotency keys, and Ledger links from
  portal responses and visible UI.
- Defer POS client, terminal, and funding-customer filters until a backend
  discovery contract can provide authorized named choices.

### Consequences

- Platform operations can investigate checkout and refund activity without a
  new projection, export, mutation, or customer impersonation path.
- The initial workspace cannot narrow by a particular client, terminal, or
  customer. That is an honest capability gap rather than a UUID-entry escape
  hatch.
- PostgreSQL and the backend remain the only financial, state, reversal,
  authorization, tenant, filter, ordering, and total authority.

## ADR-P020: Browser-held interface preferences and a source-keyed dictionary

- Status: Accepted
- Date: 2026-08-12
- Scope: PORTAL-018

### Context

The portal rendered one language, one palette and one clock. Its audience is a
Turkish retailer's corporate staff reading English, on machines that are often
set to dark, next to finance systems that report in a 24-hour clock. None of
those three choices belongs to the backend: they describe a reader at a
particular screen, not an account or an organization.

ADR-P001 keeps sessions in a host-only cookie and forbids browser storage for
anything the backend authorizes. A preference is not authorization, but the
existing E2E check asserted that browser storage was empty, so the boundary had
to be restated rather than quietly relaxed.

### Decision

- Keep language, appearance and clock format in `localStorage` under the single
  key `giftcard.portal.preferences`, and nothing else. The E2E storage check now
  asserts that key by name so any other entry is still a failure.
- Default a first-time reader to Turkish, the device appearance, and a 24-hour
  clock. Resolve "device" to a concrete palette in the provider, so the
  stylesheet only ever sees `data-theme="light"` or `data-theme="dark"`.
- Paint the stored theme from `public/theme-boot.js` before the first frame.
  The BFF serves `script-src 'self'`, so it is a served file rather than inline
  script.
- Key the Turkish dictionary on the English source sentence. An untranslated
  phrase then renders in correct English rather than as an identifier, and
  `turkish.test.ts` reads the screens to fail on a phrase the dictionary is
  missing, an entry no screen renders, a placeholder lost in translation, and a
  `t(variable)` call the first three checks would be blind to.
- Choose the time zone from the row, not from the reader. A timestamp the
  backend both records and filters in UTC — audit evidence, POS payment
  creation, financial activity, funded-card issue and expiry, organization and
  membership creation — is rendered in UTC and its column says "(UTC)".
  Everything else follows the reader's own zone. Language and clock format
  still apply to both. Rendering a UTC-filtered row in local time would put it
  outside the range that selected it, and would give two investigators reading
  one audit record two different answers.
- Give every colour in the stylesheet a semantic token and express the dark
  palette as one block of token values. Filled surfaces invert rather than
  darken, so a primary button stays the loudest thing on a dark page and stays
  above 4.5:1.
- Format dates and times through one `useFormatters` hook rather than
  module-level `Intl` instances, so language and clock reach every screen.

### Consequences

- A reader can change language, appearance and clock without an account
  setting, a backend call, or an administrator.
- The English source text is now a translation key. Editing a sentence orphans
  its Turkish, and the dictionary test says so rather than letting the screen
  fall back silently.
- Native date and time inputs still follow the browser's own locale, which the
  page cannot override. The portal's own dates follow the preference.
- Two zone rules coexist on purpose, so a screen author has to decide which one
  a column belongs to. `useFormatters` makes that decision visible by naming
  the UTC ones `utcDate`, `utcDateTime` and `utcTimestamp`.
