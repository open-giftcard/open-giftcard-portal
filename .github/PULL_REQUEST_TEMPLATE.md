## What this changes

Describe the behaviour before and after. If this fixes something, say what made
it wrong rather than only what the fix does.

## How it was verified

State what you ran and what it said. If you did not run something, say that
instead of leaving it implied.

- [ ] `pnpm run typecheck`, `lint`, `format:check`, and the frontend tests
- [ ] `dotnet test GiftCardPortal.slnx -c Release` for the BFF and contract tests
- [ ] Opened the affected screens in a browser
- [ ] Not applicable, because:

## If it touches the SPA

- [ ] The committed bundle in `src/GiftCardPortal.Bff/wwwroot` was rebuilt.
      Without this the BFF keeps serving the previous UI and the change looks
      like it did nothing.

## If it touches the backend contract

- [ ] `bash scripts/verify-contract-pin.sh` passes. A recaptured snapshot needs
      its recorded hash updated in the same commit.

## Anything a reviewer should look at first

Point at the part you are least sure about.
