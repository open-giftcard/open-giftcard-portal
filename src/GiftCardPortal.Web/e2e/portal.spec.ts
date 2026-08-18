import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const platformEmail = process.env.PORTAL_E2E_PLATFORM_EMAIL;
const platformPassword = process.env.PORTAL_E2E_PLATFORM_PASSWORD;
const organizationEmail = process.env.PORTAL_E2E_ORGANIZATION_EMAIL;
const organizationPassword = process.env.PORTAL_E2E_ORGANIZATION_PASSWORD;

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/**
 * The single browser key the portal writes, and the only one these tests
 * tolerate. Its value is the reader's language, theme and clock: no session,
 * no organization, nothing about a recipient.
 */
const preferenceStorageKey = "giftcard.portal.preferences";

test.beforeEach(async ({ page }) => {
  test.skip(
    !platformEmail ||
      !platformPassword ||
      !organizationEmail ||
      !organizationPassword,
    "Platform and organization PORTAL_E2E credentials are required.",
  );

  // The portal opens in Turkish for a first-time visitor. These tests assert
  // English copy, so they make the same choice a reader would make through the
  // settings dialog, before the first paint.
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [
      preferenceStorageKey,
      JSON.stringify({ language: "en", theme: "light", clock: "24h" }),
    ] as const,
  );
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
}

async function expectNoBrowserTokenStorage(page: Page) {
  const browserStorage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  // Interface preferences are allowed by name; anything else in local storage
  // is a regression, because a session belongs in the host-only cookie.
  expect(browserStorage.local).toEqual([preferenceStorageKey]);
  expect(browserStorage.session).toEqual([]);
}

function formatTry(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "code",
  }).format(amount);
}

function completedDeliveryProjects(projectName: string) {
  return projectName === "firefox" ? 0 : projectName === "chromium" ? 1 : 2;
}

// The runner seeds one claimed card of this value before any browser starts, so
// that reconciliation has real sharing data to count. It is issued from the same
// corporate credit these balances are asserted against, and is seeded once
// rather than per project, so it is a constant in every expectation below.
const seededSharingCardTry = 100;

function expectedCorporateCreditTry(projectName: string) {
  return (
    1200 - seededSharingCardTry - completedDeliveryProjects(projectName) * 22
  );
}

async function investigateAuditOperation(page: Page, operation: string) {
  const audit = page.getByRole("region", { name: "Audit investigation" });
  await expect(audit).toBeVisible();
  await expect(
    audit.getByText("This is not a global sign-in log."),
  ).toBeVisible();

  await audit.getByLabel("Exact operation").fill(operation);
  await audit.getByLabel("Outcome").selectOption("Success");
  await audit.getByRole("button", { name: "Search audit records" }).click();

  const records = audit.locator("li.audit-card");
  await expect(records.first()).toBeVisible();
  await expect(audit.getByText(`Operation: ${operation}`)).toBeVisible();
  await expect(audit.getByText("Outcome: Success")).toBeVisible();

  const firstRecord = records.first();
  await firstRecord.getByText("Technical evidence").click();
  const correlationReference = (
    await firstRecord
      .locator("dt", { hasText: "Correlation reference" })
      .locator("..")
      .locator("code")
      .textContent()
  )?.trim();
  expect(correlationReference).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  await audit.getByLabel("Correlation reference").fill(correlationReference!);
  await audit.getByRole("button", { name: "Search audit records" }).click();

  await expect(records).toHaveCount(1);
  await expect(
    audit.getByText(`Correlation: ${correlationReference}`),
  ).toBeVisible();
  await records.first().getByText("Technical evidence").click();
  await expect(
    records
      .first()
      .locator("dt", { hasText: "Correlation reference" })
      .locator("..")
      .locator("code"),
  ).toHaveText(correlationReference!);
  expect(new URL(page.url()).search).toBe("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("completes the platform customer directory journey", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await signIn(page, platformEmail!, platformPassword!);

  await expect(
    page.getByRole("heading", { name: "Customer organizations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portal E2E" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portal Filtered Customer" }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }
  await expectNoBrowserTokenStorage(page);

  const primaryCustomer = page
    .locator("li.customer-card")
    .filter({ hasText: "Portal E2E" });
  await primaryCustomer.getByRole("button", { name: "View customer" }).click();
  await expect(page.getByText("Platform customer record")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portal E2E" }),
  ).toBeVisible();
  await expect(page.getByText("Root customer", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Corporate credit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(organizationEmail!, { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText(formatTry(expectedCorporateCreditTry(testInfo.project.name)))
      .first(),
  ).toBeVisible();

  const projectReference = `PORTAL-UI-FUND-${testInfo.project.name
    .replaceAll(/[^a-z0-9]+/gi, "-")
    .toUpperCase()}`;
  await page.getByRole("textbox", { name: "Amount" }).fill("50.00");
  await page
    .getByRole("textbox", { name: "Business reference" })
    .fill(projectReference);
  await page.getByRole("button", { name: "Review allocation" }).click();
  await expect(
    page.getByRole("region", { name: "Review allocation" }),
  ).toContainText("TRY 50.00");
  await page.getByRole("button", { name: "Confirm allocation" }).click();
  await expect(page.getByRole("status")).toContainText("was allocated");

  const createdAllocation = page
    .locator("ol.funding-history > li")
    .filter({ hasText: projectReference });
  await expect(createdAllocation).toBeVisible();
  await createdAllocation
    .getByRole("button", { name: "Review reversal" })
    .click();
  await page
    .getByRole("textbox", { name: "Reversal reason" })
    .fill("Automated portal verification");
  await page.getByRole("button", { name: "Review full reversal" }).click();
  await page.getByRole("button", { name: "Confirm full reversal" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "was reversed" }),
  ).toBeVisible();
  await investigateAuditOperation(page, "corporate_credit.reversed");
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }
  await page
    .getByRole("button", { name: "← Back to customer directory" })
    .click();

  await page
    .getByRole("textbox", { name: "Company name or code" })
    .fill("PORTAL-FILTER");
  await page.getByRole("combobox", { name: "Status" }).selectOption("Active");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(
    page.getByRole("heading", { name: "Portal Filtered Customer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portal E2E" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("completes the platform POS payment reporting journey", async ({
  page,
}, testInfo) => {
  await signIn(page, platformEmail!, platformPassword!);
  await page.getByRole("button", { name: "POS payments" }).click();

  await expect(
    page.getByRole("heading", { name: "POS payments", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Store reference" })
    .fill("portal-e2e-store");
  await page
    .getByRole("combobox", { name: "Payment state" })
    .selectOption("Confirmed");
  await page.getByRole("textbox", { name: "Currency" }).fill("try");
  await page
    .getByRole("textbox", { name: "Receipt or card reference" })
    .fill("PORTAL-E2E-RECEIPT");
  await page.getByRole("button", { name: "Search payments" }).click();

  await expect(page.getByText("1 matching payments")).toBeVisible();
  await expect(page.getByText("PORTAL-E2E-RECEIPT")).toBeVisible();
  await expect(page.getByText(formatTry(18)).first()).toBeVisible();
  await page.getByRole("button", { name: "View receipt" }).click();
  const receipt = page.getByRole("region", { name: "Payment receipt" });
  await expect(receipt).toBeVisible();
  await expect(
    receipt.getByText("Portal reporting verification"),
  ).toBeVisible();
  await expect(receipt.getByText(formatTry(12)).first()).toBeVisible();

  expect(new URL(page.url()).search).toBe("");
  await expectNoBrowserTokenStorage(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await page.getByRole("button", { name: "Close receipt" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("completes the company finance and reconciliation journey", async ({
  page,
}, testInfo) => {
  const completedPlatformFundingOperations =
    testInfo.project.name === "firefox"
      ? 1
      : testInfo.project.name === "chromium"
        ? 2
        : 3;
  await signIn(page, organizationEmail!, organizationPassword!);

  await expect(
    page.getByRole("heading", { name: "Choose your organization" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("radio").first()).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await expectNoBrowserTokenStorage(page);

  const firstOrganization = page.getByRole("radio").first();
  await page.locator("label.organization-card").first().click();
  await expect(firstOrganization).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Verified organization context")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Balances by currency" }),
  ).toBeVisible();
  await expect(
    page
      .getByText(formatTry(expectedCorporateCreditTry(testInfo.project.name)))
      .first(),
  ).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  const activityCards = page.locator("li.activity-card");
  const timelineEnd = page.getByText(
    "You have reached the end of these backend results.",
  );
  await expect(activityCards.first()).toBeVisible();
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    if (await timelineEnd.isVisible()) {
      break;
    }

    const loadMore = page.getByRole("button", { name: "Load more activity" });
    if ((await loadMore.count()) === 0) {
      break;
    }
    const previousCount = await activityCards.count();
    await loadMore.click();
    await expect
      .poll(() => activityCards.count())
      .toBeGreaterThan(previousCount);
    await expect(loadMore.or(timelineEnd)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Allocated" })).toHaveCount(
    12 + completedPlatformFundingOperations,
  );
  await expect(page.getByText("Reference PORTAL-E2E-FUND-012")).toBeVisible();
  await expect(timelineEnd).toBeVisible();

  const todayUtc = new Date().toISOString().slice(0, 10);
  await page
    .getByRole("combobox", { name: "Category" })
    .selectOption("CorporateCredit");
  await page.getByLabel("Exact operation").fill("Allocated");
  await page.getByRole("textbox", { name: "Currency" }).fill("try");
  await page
    .getByLabel("Business or card reference")
    .fill("portal-e2e-fund-012");
  await page.getByLabel("From date (UTC)").fill(todayUtc);
  await page.getByLabel("Through date (UTC)").fill(todayUtc);
  await page.getByRole("button", { name: "Search activity" }).click();
  await expect(page.getByText("6 active filters")).toBeVisible();
  await expect(page.getByText("Category: Corporate credit")).toBeVisible();
  await expect(page.getByText("Currency: TRY")).toBeVisible();
  await expect(activityCards).toHaveCount(1);
  await expect(page.getByText("Reference PORTAL-E2E-FUND-012")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText(/no search filters are active/i)).toBeVisible();
  await expect(activityCards.first()).toBeVisible();

  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Organization-owned cards" }),
  ).toBeVisible();
  const cardProjectCode = testInfo.project.name
    .replaceAll(/[^a-z0-9]+/gi, "-")
    .toUpperCase();
  const cardBusinessReference = `PORTAL-UI-CARD-${cardProjectCode}`;
  const issuanceSection = page.getByRole("region", {
    name: "Issue a gift card",
  });
  await issuanceSection.getByLabel("Amount").fill("25.00");
  await issuanceSection
    .getByLabel("Expires (required, local time)")
    .fill("2027-07-29T12:00");
  await issuanceSection
    .getByLabel("Business reference")
    .fill(cardBusinessReference);
  const transferable = issuanceSection.getByRole("checkbox", {
    name: "Transferable",
  });
  await transferable.focus();
  await page.keyboard.press("Space");
  await expect(transferable).toBeChecked();
  const divisible = issuanceSection.getByRole("checkbox", {
    name: "Divisible",
  });
  await divisible.focus();
  await page.keyboard.press("Space");
  await expect(divisible).toBeChecked();
  await issuanceSection
    .getByRole("button", { name: "Review issuance" })
    .click();
  const issuanceReview = page.getByRole("region", {
    name: "Review gift card issuance",
  });
  await expect(issuanceReview).toContainText("Portal E2E");
  await expect(issuanceReview).toContainText("TRY 25.00");
  await expect(issuanceReview).toContainText(cardBusinessReference);
  await expect(issuanceReview).toContainText("Transferable · Divisible");
  await page.getByRole("button", { name: "Confirm issuance" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "was issued" }),
  ).toContainText("TRY 25.00");
  await expect(
    page.getByRole("heading", { name: cardBusinessReference }),
  ).toBeVisible();
  await expect(page.getByText(/^GC-[0-9A-F]{20}$/).first()).toBeVisible();
  const issuedCard = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: cardBusinessReference }),
  });
  await issuedCard.getByRole("button", { name: "View lifecycle" }).click();
  await expect(
    page.getByRole("heading", { name: cardBusinessReference }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lifecycle events" }),
  ).toBeVisible();

  const lifecycleReason = `Portal lifecycle review ${cardProjectCode}`;
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await page.getByLabel("Reason").fill(lifecycleReason);
  await page.getByRole("button", { name: "Review action" }).click();
  await expect(
    page.getByRole("region", { name: "Review lifecycle action" }),
  ).toContainText(lifecycleReason);
  await page.getByRole("button", { name: "Confirm suspend" }).click();
  await expect(page.getByRole("status")).toContainText("Suspend completed");
  await expect(page.getByText("Active → Suspended").first()).toBeVisible();

  await page.getByRole("button", { name: "Reactivate", exact: true }).click();
  await page.getByLabel("Reason").fill(lifecycleReason);
  await page.getByRole("button", { name: "Review action" }).click();
  await page.getByRole("button", { name: "Confirm reactivate" }).click();
  await expect(page.getByRole("status")).toContainText("Reactivate completed");
  await expect(page.getByText("Suspended → Active").first()).toBeVisible();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Reason").fill(lifecycleReason);
  await expect(
    page.getByText(/Cancellation and expiration cannot be undone/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review action" }).click();
  await expect(page.getByText(/This action is terminal/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect(page.getByRole("status")).toContainText("Cancel completed");
  await expect(page.getByRole("status")).toContainText("TRY 25.00");
  await expect(page.getByText("Active → Cancelled").first()).toBeVisible();
  await page.getByRole("button", { name: "Back to inventory" }).click();
  await expect(
    page.getByRole("heading", { name: cardBusinessReference }),
  ).toBeVisible();
  await expect(issuedCard.getByText("Cancelled")).toBeVisible();

  const distributionCardReference = `PORTAL-UI-SEND-${cardProjectCode}`;
  await issuanceSection.getByLabel("Amount").fill("10.00");
  await issuanceSection
    .getByLabel("Expires (required, local time)")
    .fill("2027-07-29T12:00");
  await issuanceSection
    .getByLabel("Business reference")
    .fill(distributionCardReference);
  await issuanceSection
    .getByRole("button", { name: "Review issuance" })
    .click();
  await page.getByRole("button", { name: "Confirm issuance" }).click();
  const distributionCard = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: distributionCardReference }),
  });
  await distributionCard
    .getByRole("button", { name: "Send to recipient" })
    .click();
  const recipientContact = `recipient-${testInfo.project.name.replaceAll(
    /[^a-z0-9]+/gi,
    "-",
  )}@example.com`;
  await page.getByLabel("Recipient email").fill(recipientContact);
  await page
    .getByLabel("Business reference")
    .fill(`DELIVERY-${cardProjectCode}`);
  await page.getByRole("button", { name: "Review delivery" }).click();
  const deliveryReview = page.getByRole("region", {
    name: "Review recipient delivery",
  });
  await expect(deliveryReview).toContainText(recipientContact);
  await expect(deliveryReview).toContainText("does not move or recalculate");
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  await expect(page.getByRole("status")).toContainText("awaiting claim");
  await expect(page.getByRole("status")).toContainText("r***@example.com");
  await expect(page.getByText(recipientContact)).toHaveCount(0);
  await page.getByRole("button", { name: "Return to inventory" }).click();

  const batch = page.getByRole("region", { name: "Bulk gift card batch" });
  const batchReference = `PORTAL-UI-BATCH-${cardProjectCode}`;
  await batch.getByLabel("Batch reference").fill(batchReference);
  const firstBatchRow = batch.getByRole("group", { name: "Item 1" });
  await firstBatchRow.getByLabel("Item reference").fill(`${batchReference}-1`);
  await firstBatchRow.getByLabel("Amount").fill("5.00");
  await firstBatchRow
    .getByLabel("Expires (required, local time)")
    .fill("2027-07-29T12:00");
  const batchEmail = `batch-${testInfo.project.name.replaceAll(
    /[^a-z0-9]+/gi,
    "-",
  )}@example.com`;
  await firstBatchRow.getByLabel("Recipient email").fill(batchEmail);
  await batch.getByRole("button", { name: "Add item" }).click();
  const secondBatchRow = batch.getByRole("group", { name: "Item 2" });
  await secondBatchRow.getByLabel("Item reference").fill(`${batchReference}-2`);
  await secondBatchRow.getByLabel("Amount").fill("7.00");
  await secondBatchRow
    .getByLabel("Expires (required, local time)")
    .fill("2027-07-29T12:00");
  await secondBatchRow
    .getByRole("combobox", { name: "Delivery channel" })
    .selectOption("phone");
  await secondBatchRow
    .getByLabel("Recipient phone (E.164)")
    .fill("+905551234567");
  await batch.getByRole("button", { name: "Review entire batch" }).click();
  const batchReview = page.getByRole("region", {
    name: "Review bulk gift card batch",
  });
  await expect(batchReview).toContainText(batchEmail);
  await expect(batchReview).toContainText("+905551234567");
  await expect(batchReview).toContainText("rolls back the entire batch");
  await batch.getByRole("button", { name: "Confirm entire batch" }).click();
  await expect(
    batch.getByRole("heading", { name: batchReference, exact: true }),
  ).toBeVisible();
  await expect(batch.getByText("TRY 12.00")).toBeVisible();
  await expect(batch).toContainText("b***@example.com");
  await expect(batch).toContainText("+90***4567");
  await expect(page.getByText(batchEmail)).toHaveCount(0);
  await batch.getByRole("button", { name: "Refresh batch result" }).click();
  await expect(batch.getByText(/Completed · 2 items/)).toBeVisible();
  await expectNoBrowserTokenStorage(page);
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await page.getByRole("button", { name: "Organization", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Direct subsidiaries" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portal Branch 001" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Portal Branch 021" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("heading", { name: "Portal Branch 021" }),
  ).toBeVisible();

  const projectCode = testInfo.project.name
    .replaceAll(/[^a-z0-9]+/gi, "-")
    .toUpperCase();
  const createdName = `Demo ${testInfo.project.name} Branch`;
  await page
    .getByRole("textbox", { name: "Subsidiary name" })
    .fill(createdName);
  await page
    .getByRole("textbox", { name: "Subsidiary code" })
    .fill(`PORTAL-UI-${projectCode}`);
  await page.getByRole("button", { name: "Create subsidiary" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "direct subsidiary" }),
  ).toContainText(createdName);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: createdName })).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Your membership")).toBeVisible();
  const teamEmail = `portal.team.${testInfo.project.name}@example.test`;
  await page.getByRole("textbox", { name: "Account email" }).fill(teamEmail);
  await page.getByRole("button", { name: "Review member" }).click();
  await expect(
    page.getByText(new RegExp(`Add the existing account ${teamEmail}`)),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm access change" }).click();
  await expect(page.getByRole("status")).toContainText("was added to the team");
  await expect(page.getByRole("heading", { name: teamEmail })).toBeVisible();
  const currentMember = page
    .locator("li.team-card")
    .filter({ has: page.getByRole("heading", { name: organizationEmail! }) });
  await expect(
    currentMember.getByRole("button", { name: "Disable member" }),
  ).toHaveCount(0);
  const addedMember = page
    .locator("li.team-card")
    .filter({ has: page.getByRole("heading", { name: teamEmail }) });
  await expect(
    addedMember.getByRole("button", { name: "Disable member" }),
  ).toBeVisible();

  const roleName = `Portal ${testInfo.project.name} operator`;
  await page.getByRole("textbox", { name: "New role name" }).fill(roleName);
  await page.getByRole("button", { name: "Review new role" }).click();
  await page.getByRole("button", { name: "Confirm access change" }).click();
  await expect(page.getByRole("status")).toContainText(
    `${roleName} was created`,
  );
  await expect(page.getByRole("heading", { name: roleName })).toBeVisible();

  await page.getByRole("combobox", { name: "Role to extend" }).selectOption({
    label: roleName,
  });
  await page.getByRole("checkbox", { name: "gift cards · view" }).check();
  await page.getByRole("button", { name: "Review permission grant" }).click();
  await page.getByRole("button", { name: "Confirm access change" }).click();
  await expect(page.getByRole("status")).toContainText(
    `Permissions were added to ${roleName}`,
  );

  await page.getByRole("combobox", { name: "Team member" }).selectOption({
    label: teamEmail,
  });
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption({
    label: roleName,
  });
  await page.getByRole("combobox", { name: "Scope" }).selectOption("Subtree");
  await page.getByRole("button", { name: "Review role assignment" }).click();
  await expect(
    page.getByText(/organization and its subsidiaries/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm access change" }).click();
  await expect(page.getByRole("status")).toContainText("The role was assigned");
  await expectNoBrowserTokenStorage(page);
  expect(new URL(page.url()).search).toBe("");
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  const reconciliationWorkspace = page.getByRole("button", {
    name: "Reconciliation",
  });
  await reconciliationWorkspace.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Ready to verify financial records" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run reconciliation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run reconciliation" }).click();
  await expect(
    page.getByRole("heading", { name: "No inconsistencies found" }),
  ).toBeVisible();
  await expect(page.getByText("Transactions checked")).toBeVisible();
  await expect(page.getByText("Gift cards checked")).toBeVisible();

  // Phase 3 put sharing inside the backend's reconciliation scope. The runner
  // seeds one claimed card and one pending share, so these counts must be
  // non-zero: a hardcoded or dropped value would read as a clean check that
  // never actually looked at sharing.
  const sharesChecked = page
    .getByText("Shares checked", { exact: true })
    .locator("xpath=following-sibling::dd[1]");
  const reservationsChecked = page
    .getByText("Active reservations checked", { exact: true })
    .locator("xpath=following-sibling::dd[1]");
  await expect(sharesChecked).toBeVisible();
  await expect(reservationsChecked).toBeVisible();
  expect(Number(await sharesChecked.innerText())).toBeGreaterThan(0);
  expect(Number(await reservationsChecked.innerText())).toBeGreaterThan(0);
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await page.getByRole("button", { name: "Audit" }).click();
  await investigateAuditOperation(page, "organization.subsidiary.created");
  await expectNoBrowserTokenStorage(page);
  if (testInfo.project.name === "chromium") {
    await expectNoAccessibilityViolations(page);
  }

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(
    page.getByRole("heading", { name: "Balances by currency" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Change organization" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your organization" }),
  ).toBeVisible();

  const keyboardOrganization = page.getByRole("radio").first();
  await keyboardOrganization.focus();
  await page.keyboard.press("Space");
  await expect(keyboardOrganization).toBeChecked();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Verified organization context")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Search financial activity" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
