import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalBulkGiftCardBatch } from "../../types";
import { BulkGiftCardBatch } from "./BulkGiftCardBatch";
import type * as SpreadsheetModule from "./spreadsheet";
import { readWorkbookGrid } from "./spreadsheet";

vi.mock("./spreadsheet", async (importOriginal) => {
  const actual = await importOriginal<typeof SpreadsheetModule>();
  return { ...actual, readWorkbookGrid: vi.fn(actual.readWorkbookGrid) };
});

const result: PortalBulkGiftCardBatch = {
  id: "018f5dc3-a865-7c11-a2a0-8326b3b96f80",
  batchReference: "BENEFITS-2026-08",
  status: "Completed",
  totalItems: 2,
  succeededItems: 1,
  failedItems: 1,
  createdAtUtc: "2026-08-03T09:00:00Z",
  completedAtUtc: "2026-08-03T09:00:01Z",
  retryOfBatchId: null,
  limit: 200,
  nextCursor: "next-page",
  items: [
    {
      position: 1,
      itemReference: "BENEFIT-001",
      status: "Succeeded",
      giftCardPublicReference: "GC-BATCH000000000000001",
      contactType: "Email",
      maskedRecipientContact: "a***@example.com",
      amount: 100,
      currency: "TRY",
      giftCardState: "AwaitingClaim",
      invitationState: "Pending",
      distributedAtUtc: "2026-08-03T09:00:00Z",
      failureCode: null,
      failureMessage: null,
      settledAtUtc: "2026-08-03T09:00:00Z",
    },
    {
      position: 2,
      itemReference: "BENEFIT-002",
      status: "Failed",
      giftCardPublicReference: null,
      contactType: "Phone",
      maskedRecipientContact: "+90***4567",
      amount: 75,
      currency: "TRY",
      giftCardState: null,
      invitationState: null,
      distributedAtUtc: null,
      failureCode: "insufficient_corporate_credit",
      failureMessage: "Corporate credit is no longer sufficient for this row.",
      settledAtUtc: "2026-08-03T09:00:01Z",
    },
  ],
};

function renderBuilder(
  overrides: Partial<React.ComponentProps<typeof BulkGiftCardBatch>> = {},
) {
  const props: React.ComponentProps<typeof BulkGiftCardBatch> = {
    organizationName: "Portal E2E",
    canCreate: true,
    canView: true,
    isCreating: false,
    isRefreshing: false,
    isLoadingMore: false,
    isRetrying: false,
    onCreate: vi.fn(),
    onRefresh: vi.fn(),
    onLoadMore: vi.fn(),
    onRetryFailed: vi.fn(),
    onStartNew: vi.fn(),
    ...overrides,
  };
  render(<BulkGiftCardBatch {...props} />);
  const open = screen.queryByRole("button", {
    name: props.result ? "Open batch progress" : "Batch upload",
  });
  if (open) {
    fireEvent.click(open);
  }
  return props;
}

describe("BulkGiftCardBatch", () => {
  it("shows the spreadsheet rules before choosing a file", () => {
    renderBuilder();

    expect(screen.getByText("Before you upload")).toBeVisible();
    expect(
      screen.getByText(/first row must contain column headings/),
    ).toBeVisible();
    expect(screen.getByText(/2,000 recipient rows/)).toBeVisible();
    expect(screen.getByLabelText("Bulk upload progress")).toHaveTextContent(
      /Upload.*Mapping.*Repair and review.*Import/,
    );
  });

  it("discards an unfinished draft when the upload dialog closes", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(
      screen.getByRole("button", { name: "Enter batch rows manually" }),
    );
    await user.type(screen.getByLabelText("Batch reference"), "MISTAKE");
    await user.click(
      screen.getByRole("button", { name: "Close batch upload" }),
    );
    await user.click(screen.getByRole("button", { name: "Batch upload" }));

    expect(screen.getByText("Before you upload")).toBeVisible();
    expect(screen.queryByDisplayValue("MISTAKE")).not.toBeInTheDocument();
  });

  it("lets the uploader return to an earlier completed step", async () => {
    vi.mocked(readWorkbookGrid).mockResolvedValueOnce([
      ["Email", "Amount", "Expiry date"],
      ["ada@example.com", "200", "2027-08-12"],
    ]);
    const user = userEvent.setup();
    renderBuilder();

    fireEvent.change(screen.getByLabelText("Spreadsheet of recipients"), {
      target: { files: [new File([], "recipients.xlsx")] },
    });
    expect(
      await screen.findByRole("button", { name: "Validate rows" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Go to Upload" }));

    expect(screen.getByText("Before you upload")).toBeVisible();
    expect(screen.getByLabelText("Spreadsheet of recipients")).toHaveValue("");
  });

  it("lets the uploader correct automatic header mapping", async () => {
    vi.mocked(readWorkbookGrid).mockResolvedValueOnce([
      ["Who", "Value", "End"],
      ["ada@example.com", "200", "2027-08-12"],
    ]);
    const user = userEvent.setup();
    renderBuilder();

    fireEvent.change(screen.getByLabelText("Spreadsheet of recipients"), {
      target: { files: [new File([], "custom.xlsx")] },
    });

    await user.selectOptions(
      await screen.findByLabelText("Column for Recipient"),
      "0",
    );
    await user.selectOptions(
      screen.getByLabelText("Column for Expiry date"),
      "2",
    );
    await user.click(screen.getByRole("button", { name: "Validate rows" }));

    expect(await screen.findByLabelText("Recipient email")).toHaveValue(
      "ada@example.com",
    );
    expect(screen.getByLabelText("Amount")).toHaveValue("200");
    expect(screen.getByLabelText("Expiry date")).toHaveValue("2027-08-12");
    expect(
      screen.getByRole("checkbox", {
        name: "Only show rows with problems",
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("checkbox", {
        name: "Only show rows with problems",
      }),
    );
    expect(screen.getByText("No rows with problems.")).toBeVisible();
  });

  it("reviews every row as one asynchronous intent and reuses its hidden identity", async () => {
    const user = userEvent.setup();
    const props = renderBuilder();

    await user.click(
      screen.getByRole("button", { name: "Enter batch rows manually" }),
    );

    await user.type(screen.getByLabelText("Batch reference"), "BENEFITS-2026");
    await user.type(screen.getByLabelText("Item reference"), "BENEFIT-001");
    await user.type(screen.getByLabelText("Amount"), "100");
    fireEvent.change(screen.getByLabelText("Expiry date"), {
      target: { value: "2027-08-03" },
    });
    await user.type(
      screen.getByLabelText("Recipient email"),
      "alpha@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );

    const review = screen.getByRole("region", {
      name: "Review bulk gift card batch",
    });
    expect(review).toHaveTextContent("queues the single row below");
    expect(review).toHaveTextContent("alpha@example.com");
    await user.click(
      screen.getByRole("button", { name: "Queue entire batch" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Queue entire batch" }),
    );

    const create = vi.mocked(props.onCreate);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0]);
    expect(create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        batchReference: "BENEFITS-2026",
        items: [
          expect.objectContaining({
            itemReference: "BENEFIT-001",
            amount: "100",
            currency: "TRY",
            contactType: "email",
            recipientContact: "alpha@example.com",
          }),
        ],
      }),
    );
    expect(
      screen.queryByText(create.mock.calls[0][0].operationId),
    ).not.toBeInTheDocument();
  });

  it("marks the rows that repeat an item reference and clears them on removal", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(
      screen.getByRole("button", { name: "Enter batch rows manually" }),
    );

    await user.type(screen.getByLabelText("Batch reference"), "BENEFITS-2026");
    await user.type(screen.getByLabelText("Item reference"), "DUPLICATE");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const rows = screen.getAllByRole("group", { name: /Item \d/ });
    expect(rows).toHaveLength(2);
    await user.type(
      within(rows[1]).getByLabelText("Item reference"),
      "DUPLICATE",
    );
    for (const row of rows) {
      await user.type(within(row).getByLabelText("Amount"), "10");
      fireEvent.change(within(row).getByLabelText("Expiry date"), {
        target: { value: "2027-08-03" },
      });
      await user.type(
        within(row).getByLabelText("Recipient email"),
        "alpha@example.com",
      );
    }

    // Both rows are marked, not just the second: neither is more wrong than
    // the other and the reader chooses which one to rename.
    for (const row of rows) {
      expect(row).toHaveTextContent("Another row already uses this item");
    }
    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Repair every highlighted spreadsheet row",
    );

    await user.click(screen.getByRole("button", { name: "Remove row 2" }));
    // A failed review narrows the sheet to its problems, so repairing the last
    // one empties it. The way back is offered rather than assumed.
    await user.click(screen.getByRole("button", { name: "Show all rows" }));
    const remaining = screen.getAllByRole("group", { name: /Item \d/ });
    expect(remaining).toHaveLength(1);
    // Removing the clash repairs the row that was left behind.
    expect(remaining[0]).not.toHaveTextContent("Another row already uses");
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 row is ready to import.",
    );
  });

  it("imports XLSX rows locally, compares available credit, and drops names from the intent", async () => {
    vi.mocked(readWorkbookGrid).mockResolvedValueOnce([
      ["Name", "Email", "Amount", "Currency", "Expiry date", "Employee ID"],
      [
        "Ada Lovelace",
        "ada@example.com",
        "100",
        "TRY",
        "2027-08-03T12:00",
        "EMP-1",
      ],
    ]);
    const user = userEvent.setup();
    const props = renderBuilder({
      availableCorporateCredit: [{ currency: "TRY", amount: 200 }],
    });

    fireEvent.change(screen.getByLabelText("Spreadsheet of recipients"), {
      target: { files: [new File([], "benefits.xlsx")] },
    });
    await user.click(
      await screen.findByRole("button", { name: "Validate rows" }),
    );
    expect(
      await screen.findByText(/TRY 100.00 to issue, of TRY 200.00 available/),
    ).toBeVisible();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByLabelText("Expiry date")).toHaveValue("2027-08-03");
    expect(
      screen.getByLabelText("Expiry time (optional; defaults to 23:59)"),
    ).toHaveValue("12:00");

    await user.type(screen.getByLabelText("Batch reference"), "XLSX-2026");
    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Queue entire batch" }),
    );

    const submitted = vi.mocked(props.onCreate).mock.calls[0][0];
    expect(submitted.items[0]).toEqual(
      expect.objectContaining({
        itemReference: "EMP-1",
        recipientContact: "ada@example.com",
        amount: "100",
      }),
    );
    expect(JSON.stringify(submitted)).not.toContain("Ada Lovelace");
  });

  it("shows imported date-only cells and supplies default boundary times", async () => {
    vi.mocked(readWorkbookGrid).mockResolvedValueOnce([
      ["Email", "Amount", "Valid From", "Expiry date", "Employee ID"],
      ["ada@example.com", "200", "2026-08-12", "2027-08-12", "EMP-1"],
    ]);
    const user = userEvent.setup();
    const props = renderBuilder();

    fireEvent.change(screen.getByLabelText("Spreadsheet of recipients"), {
      target: { files: [new File([], "dated.xlsx")] },
    });
    await user.click(
      await screen.findByRole("button", { name: "Validate rows" }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Valid from date (optional)")).toHaveValue(
        "2026-08-12",
      );
    });
    expect(screen.getByLabelText("Expiry date")).toHaveValue("2027-08-12");
    expect(
      screen.getByLabelText("Valid from time (optional; defaults to 00:00)"),
    ).toHaveValue("");
    expect(
      screen.getByLabelText("Expiry time (optional; defaults to 23:59)"),
    ).toHaveValue("");

    await user.type(screen.getByLabelText("Batch reference"), "DATED-2026");
    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Queue entire batch" }),
    );

    const item = vi.mocked(props.onCreate).mock.calls[0][0].items[0];
    const validFrom = new Date(item.validFromUtc!);
    const expiresAt = new Date(item.expiresAtUtc);
    expect(validFrom.getHours()).toBe(0);
    expect(validFrom.getMinutes()).toBe(0);
    expect(expiresAt.getHours()).toBe(23);
    expect(expiresAt.getMinutes()).toBe(59);
  });

  it("refuses an XLSX import above the asynchronous 2,000-row limit", async () => {
    const rows = Array.from({ length: 2001 }, (_, index) => [
      `Person ${index}`,
      `person${index}@example.com`,
      "1",
      "TRY",
      "2027-08-03T12:00",
      `EMP-${index}`,
    ]);
    vi.mocked(readWorkbookGrid).mockResolvedValueOnce([
      ["Name", "Email", "Amount", "Currency", "Expiry date", "Employee ID"],
      ...rows,
    ]);
    renderBuilder();

    fireEvent.change(screen.getByLabelText("Spreadsheet of recipients"), {
      target: { files: [new File([], "too-many.xlsx")] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "2,001 rows and this batch takes at most 2,000",
    );
  });

  it("stops spreadsheet review when its total exceeds visible corporate credit", async () => {
    vi.mocked(readWorkbookGrid).mockResolvedValueOnce([
      ["Email", "Amount", "Currency", "Expiry date", "Employee ID"],
      ["ada@example.com", "100", "TRY", "2027-08-03T12:00", "EMP-1"],
    ]);
    const user = userEvent.setup();
    renderBuilder({
      availableCorporateCredit: [{ currency: "TRY", amount: 50 }],
    });
    fireEvent.change(screen.getByLabelText("Spreadsheet of recipients"), {
      target: { files: [new File([], "over-credit.xlsx")] },
    });
    await user.click(
      await screen.findByRole("button", { name: "Validate rows" }),
    );
    await screen.findByText(
      /TRY 100.00 to issue, over the TRY 50.00 available/,
    );
    await user.type(screen.getByLabelText("Batch reference"), "OVER-CREDIT");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "150");
    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "TRY 150.00 requested but 50.00 available",
    );
    expect(
      screen.queryByRole("region", { name: "Review bulk gift card batch" }),
    ).not.toBeInTheDocument();
  });

  it("checks a hand-typed batch against corporate credit too", async () => {
    const user = userEvent.setup();
    renderBuilder({
      availableCorporateCredit: [{ currency: "TRY", amount: 50 }],
    });

    await user.click(
      screen.getByRole("button", { name: "Enter batch rows manually" }),
    );
    await user.type(screen.getByLabelText("Batch reference"), "TYPED-OVER");
    await user.type(screen.getByLabelText("Item reference"), "BENEFIT-001");
    await user.type(screen.getByLabelText("Amount"), "500");
    fireEvent.change(screen.getByLabelText("Expiry date"), {
      target: { value: "2027-08-03" },
    });
    await user.type(
      screen.getByLabelText("Recipient email"),
      "alpha@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "TRY 500.00 requested but 50.00 available",
    );
    expect(
      screen.queryByRole("region", { name: "Review bulk gift card batch" }),
    ).not.toBeInTheDocument();
  });

  it("ignores a row nobody filled in instead of refusing the batch", async () => {
    const user = userEvent.setup();
    const props = renderBuilder();

    await user.click(
      screen.getByRole("button", { name: "Enter batch rows manually" }),
    );
    await user.type(screen.getByLabelText("Batch reference"), "SPARE-ROW");
    await user.type(screen.getByLabelText("Item reference"), "BENEFIT-001");
    await user.type(screen.getByLabelText("Amount"), "100");
    fireEvent.change(screen.getByLabelText("Expiry date"), {
      target: { value: "2027-08-03" },
    });
    await user.type(
      screen.getByLabelText("Recipient email"),
      "alpha@example.com",
    );

    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 row is ready to import.",
    );

    await user.click(
      screen.getByRole("button", { name: "Review entire batch" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Queue entire batch" }),
    );

    expect(vi.mocked(props.onCreate).mock.calls[0][0].items).toHaveLength(1);
  });

  it("renders ordered mixed outcomes and exposes paging and failed-only retry", async () => {
    const user = userEvent.setup();
    const props = renderBuilder({ result });

    expect(screen.getByText(/1 succeeded · 1 failed/)).toBeVisible();
    expect(screen.queryByText(result.id)).not.toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("BENEFIT-001");
    expect(items[0]).toHaveTextContent("a***@example.com");
    expect(items[1]).toHaveTextContent("BENEFIT-002");
    expect(items[1]).toHaveTextContent("+90***4567");
    expect(items[1]).toHaveTextContent("insufficient_corporate_credit");
    expect(items[1]).toHaveTextContent("Not issued");
    await user.click(
      screen.getByRole("button", { name: "Refresh batch result" }),
    );
    expect(props.onRefresh).toHaveBeenCalledOnce();
    await user.click(
      screen.getByRole("button", { name: "Load more outcomes" }),
    );
    expect(props.onLoadMore).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Retry failed rows" }));
    expect(props.onRetryFailed).toHaveBeenCalledOnce();
  });

  it("separates create permission from current-result viewing", () => {
    renderBuilder({ canCreate: false, canView: true });

    expect(
      screen.getByText(/requires both gift-card issue and distribution/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Review entire batch" }),
    ).not.toBeInTheDocument();
  });
});
