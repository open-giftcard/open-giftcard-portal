# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

There is no released version and nothing has been deployed anywhere, so there
are no version headings yet. Everything below has landed on `main` since the
first public commit. The tags that predate the open-source cleanup are not
usable and are not listed.

## Unreleased

### Added

- A security policy with a private reporting channel, and a contributor guide.
- CI fails when `contracts/README.md` declares a SHA-256 that is not the hash of
  the document beside it. The in-repo contract assertions validate the committed
  file, so a stale capture passed them.
- Community health files: code of conduct, issue and pull request templates,
  and code owners.

### Changed

- English is the default language and is listed first, being the source language
  of every screen. Adding a language is now a file, a line, and a widened union
  rather than an edit to `translate()`.
- The default currency is USD and lives once in `src/config.ts` instead of being
  repeated in ten files. The backend has no default currency and no allow-list,
  so this is a default rather than a claim.
- The committed SPA bundle was rebuilt, without which the BFF would have kept
  serving the previous language and currency.
