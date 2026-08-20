# Public Publishing Workflow

The canonical public repository is:

`https://github.com/open-giftcard/open-giftcard-portal`

The public repository began from a reviewed squashed commit. Older development
working copies may retain the full pre-public history, so their `main` and
public `main` have unrelated histories. Private-era tags are historical markers,
not public Open Giftcard releases.

## Full-history working copies

- `origin` should name the canonical public repository.
- Preserve the former development remote as `legacy` when it is still needed.
- Do not make the full-history `main` track public `origin/main`.
- Never force-push, merge unrelated histories, or push `--tags` to `origin`.

A normal public clone needs only its usual `origin` remote.

## Publishing a change

Use a clean clone of the public repository. Transfer the reviewed patch, run
all gates there, and open a normal pull request against public `main`.

Before publishing:

1. Review for private names, hosts, credentials, generated artifacts, and
   historical release claims.
2. Verify the public backend pin and OpenAPI SHA-256.
3. Build the frontend and verify the committed production bundle.
4. Run Release .NET tests plus frontend peer, format, lint, type, unit, build,
   browser, and accessibility gates appropriate to the change.
5. Keep the changelog under `Unreleased` until a coordinated public release
   actually exists.

Create no standalone portal tag. A release uses one semantic version across the
public portal, backend, and cardholder repositories and records the reviewed
commit triplet. Deployment certification remains a separate gate.
