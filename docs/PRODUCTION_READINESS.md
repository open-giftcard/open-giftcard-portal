# Production Readiness

Open Giftcard Portal is an open reference implementation. Its application-level
controls are substantial, but this repository does not claim that a public
deployment has been certified for production.

Last reviewed: 2026-08-24.

| Area | Status | Boundary |
| --- | --- | --- |
| Same-origin BFF and backend-token isolation | Implemented and tested | Browser receives only opaque cookies. |
| Same-origin plus antiforgery mutation protection | Implemented and tested | Missing or mismatched `Origin` fails closed. |
| CSP, framing/referrer protection, `/bff` `no-store` | Implemented and tested | SPA scripts and styles are same-origin only. |
| Secure cookies, HTTPS backend, durable key validation | Implemented fail-closed outside Development | Operator provides trusted TLS and protected storage. |
| PostgreSQL sessions and cross-replica refresh serialization | Implemented | All replicas must share the database and key ring. |
| Committed production-bundle equality | Enforced in CI | Frontend changes must regenerate the committed bundle. |
| Pinned public backend contract and generated client | Implemented and tested | Snapshot changes require an explicit public commit review. |
| English/Turkish, keyboard, mobile, zoom, and automated accessibility | Implemented | Human assistive-technology and visual review remains. |
| Managed session-schema migrations | Implemented and tested | A separate bounded `--migrate` process owns DDL; normal BFF startup uses table DML only. Existing deployments must transfer ownership before adopting the split. |
| Backups, HA, restore, monitoring, secrets, incident response | Deployment responsibility | Hosting evidence is outside this repository. |
| Penetration test and public staging certification | Not completed | Required before a production claim. |
| Coordinated public release | In progress | The four repositories share a verified compatibility contract. Canonical tags and the final exact-commit evidence manifest do not exist yet. |

## Unsupported boundaries

- Backend tokens or business selectors in browser storage.
- Browser-side authorization, tenant, balance, reconciliation, or payment rules.
- Broad browser CORS access to the backend.
- Offline mutations or cached authoritative financial state.
- User-pasted internal organization, card, membership, role, or POS identifiers.

## Release gate

A production-ready claim requires the complete staging checklist in
[DEPLOYMENT.md](DEPLOYMENT.md), explicit ownership of every deployment row
above, a reviewed public four-repository commit manifest, and synchronized
backend, portal, cardholder, and POS tags. Passing CI alone is source evidence,
not deployment certification.
