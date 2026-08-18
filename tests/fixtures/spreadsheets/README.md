# Sample recipient spreadsheets

For exercising the bulk upload in the portal. Every workbook is read back
through the application's own parser in the frontend test suite, so they are
known to work rather than assumed to.

| File | Contents |
| --- | --- |
| `recipients-sample.xlsx` | Six valid rows, 3,500.50 TRY in total |
| `recipients-with-errors.xlsx` | Two valid rows and four deliberately broken ones |
| `recipients-dated-100.xlsx` | 100 valid rows, 33,000 TRY total, with populated valid-from and expiry dates |
| `recipients-dated-500.xlsx` | 500 valid rows, 165,000 TRY total, with populated dates; large enough to exercise 200/200/100 result paging |

The two dated workbooks use real Excel date cells. `Valid From` rotates from
2026-08-01 through 2026-08-10, while `Expiry Date` rotates from 2027-08-01
through 2027-08-10. Amounts rotate through 200, 250, 300, 400, and 500 TRY, so
no test row is below 200 TRY. Every employee reference and `example.com`
recipient is unique.

The larger files require enough visible corporate credit before submission:
33,000 TRY for the 100-row file and 165,000 TRY for the 500-row file. The portal
will block the review if the selected organization has less available credit.

`recipients-with-errors.xlsx` is the more interesting demonstration: it shows
the upload naming each bad row by its worksheet line, which is the number Excel
shows in its own gutter.

| Row | Fault |
| --- | --- |
| 4 | Recipient is not an email address or an E.164 phone number |
| 5 | Amount is zero |
| 6 | Expiry is the word "next year" |
| 7 | Item reference repeats `EMP-1001` from row 2 |

## Every address is at `example.com`

That domain is reserved by RFC 2606 and cannot belong to a real person, so a
mistake here cannot mail a stranger.

**It is not a substitute for checking whether mail is switched on.** If SMTP is
enabled, distributing these rows makes the backend attempt six real sends to a
domain that refuses mail, which produces six bounces against the sending
account. Reading and previewing a file sends nothing at all; only pressing the
button that issues the batch does.

To see the whole journey without sending anything, turn mail off for the
session:

```
dotnet user-secrets set "Notifications:Smtp:Enabled" "false" --project src/GiftCardPlatform.Api
```

in the backend repository, then restart it. The capturing sender takes over and
the activation links stay retrievable through the Development delivery lookup.
Set it back to `true` when you want real mail again.
