# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

`v0.9.0` is the first release of this project. It makes no stability or
deployment promise; see `VERSIONING.md` for exactly what the number means and
what it deliberately does not. Local tags predating the open-source cleanup are
not usable, were never published, and are not listed.

## v0.9.0 - 2026-08-31

### Added

- A `Dockerfile`, so the portal can be brought up alongside the API with
  `docker compose -f docker-compose.yml -f docker-compose.full.yml up` from the
  backend repository. It mirrors the backend image and reuses the committed SPA
  bundle, which CI already checks against its TypeScript source. Not yet built:
  the machine this was written on has no Docker.

- Open Giftcard product identity throughout the portal and its public
  contributor documentation.
- Cross-replica PostgreSQL refresh coordination and bounded local refresh-lock
  lifecycle.
- A CI gate that verifies the committed production SPA bundle is byte-identical
  to a clean frontend build.
- Deployment, production-readiness, and public publishing guidance.
- A security policy with a private reporting channel, and a contributor guide.
- CI fails when `contracts/README.md` declares a SHA-256 that is not the hash of
  the document beside it. The in-repo contract assertions validate the committed
  file, so a stale capture passed them.
- Community health files: code of conduct, issue and pull request templates,
  and code owners.

### Changed

- `RELEASE_COMPATIBILITY.json` no longer names tags that do not exist. It
  declared release `v0.5.0-rc.1` and gave all four components that tag, and no
  repository has ever had a public tag. Schema version 2 adds a `development`
  channel for that state, and on a released channel now requires the tag it
  names to resolve locally. `scripts/Test-ReleaseContract.ps1` enforces both,
  and additionally rejects a byte order mark or CRLF line endings, so the file
  can be byte-identical in all four repositories. It had been CRLF in the
  backend and LF in the other three.

- The backend contract pin now names the exact public commit verified to
  generate the committed snapshot.
- English is the default language and is listed first, being the source language
  of every screen. Adding a language is now a file, a line, and a widened union
  rather than an edit to `translate()`.
- The default currency is USD and lives once in `src/config.ts` instead of being
  repeated in ten files. The backend has no default currency and no allow-list,
  so this is a default rather than a claim.
- The committed SPA bundle was rebuilt, without which the BFF would have kept
  serving the previous language and currency.
