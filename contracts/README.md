# Backend OpenAPI Contract

`backend.openapi.json` was captured from the authoritative public backend:

- Repository: https://github.com/open-giftcard/open-giftcard
- Branch: `milestone/deployment-certified-rc`
- Commit: `a8a506ae7de8871ce24462e1e838eded3fba67bc`
- Endpoint: `/swagger/v1/swagger.json`
- SHA-256:
  `DE48FE7764D9C58DD4CEA3E9DC6A3B4698A29527CD0CBE386E9C4360AB32B663`

That public commit was rebuilt and its served OpenAPI document was verified to
have exactly the SHA-256 recorded above. Later backend changes do not silently
move this pin: updating the snapshot requires an explicit review and a new
public commit reference.

The document includes the `partners` surface used by the e-pin claim route. Its
API title is generic and no operation summary names a retailer.

Update the snapshot only after reviewing backend contract changes at an
explicitly accepted backend commit. Never capture from a moving backend branch
without an explicit commit pin.

The BFF client is generated from this committed document at build time. The
portal binds the staff surface only. It does not bind recipient sharing claim
operations, and it never handles claim tokens, PINs, or the credential-bearing
cardholder claim `session` property.

Run `scripts/Test-BackendContract.ps1` against a running pinned backend to check
for drift.
