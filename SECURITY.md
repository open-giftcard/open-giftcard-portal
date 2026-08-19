# Security Policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository: **Security →
Report a vulnerability**. Please do not open a public issue for anything you
believe is exploitable.

There is no bounty and no formal response-time commitment.

## Supported versions

There is no released version yet. `main` is the only branch that receives fixes.

## Where the boundary is

This repository is a client. It decides nothing about authorization, tenancy,
ownership, or money: the platform backend is the only authority for all of them,
and a finding in any of those belongs in the `open-giftcard` repository.

What this repository is responsible for is the browser boundary.

**Tokens never reach the browser.** The BFF holds the backend access and refresh
tokens server-side in its own PostgreSQL database, encrypted with ASP.NET Data
Protection. The browser receives one opaque session cookie whose value is 32
random bytes; only its SHA-256 is stored.

**Cookies.** The session and antiforgery cookies are `HttpOnly`, `Secure`, and
`__Host-` prefixed outside Development. Startup fails in any non-Development
environment if the cookie name is not `__Host-` prefixed or insecure cookies are
allowed, so a misconfigured deployment does not start rather than starting
weakly.

**CSRF.** Every mutating `/bff` request must carry a single `Origin` header
matching the request's own scheme and authority, and must pass ASP.NET
antiforgery validation. A missing `Origin` is refused with 403 deliberately
rather than being treated as same-origin.

**Content Security Policy.** `default-src 'self'` with `script-src 'self'`,
`object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`, plus
`nosniff`, `Referrer-Policy: no-referrer`, and `no-store` on `/bff`.

**The browser is never trusted with identifiers.** The UI does not ask a user to
paste an organization, member, role, card, batch, or audit identifier, and the
backend revalidates every field regardless.

## Known gaps

- **Session refresh coordination is per process.** The in-memory lock that
  serialises token refresh is not shared across replicas, and its entries are
  never evicted, so its memory grows with the number of distinct sessions seen.
  Correctness across replicas rests on the database check rather than the lock.
- **The committed SPA bundle can drift from source.** `GiftCardPortal.Bff/wwwroot`
  contains a built bundle checked into the repository. It is rebuilt when the
  source changes, but nothing enforces that.
- **No staging certification and no penetration test.**

## Scope

In scope: the BFF, its session handling, the CSRF and CSP configuration, and
anything in this repository that could expose a backend token to a browser.

Out of scope: authorization, tenant isolation, and financial correctness, which
are enforced by the backend and should be reported there.
