import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalFinancialReconciliation } from "../../types";
import { ReconciliationPanel } from "./ReconciliationPanel";

const inconsistentResult: PortalFinancialReconciliation = {
  checkedAtUtc: "2026-07-29T12:45:00Z",
  isConsistent: false,
  transactionsChecked: 12,
  giftCardsChecked: 3,
  sharesChecked: 5,
  activeReservationsChecked: 2,
  findings: [
    {
      code: "LEDGER_AMOUNT_MISMATCH",
      severity: "Error",
      entityType: "CorporateCreditAllocation",
      technicalReference: "018f5da0-115b-7a69-84a0-991b1cd18d91",
      currency: "TRY",
      expectedAmount: 1000,
      actualAmount: 950,
      message: "The allocation amount differs from Ledger.",
    },
    {
      code: "ORPHAN_TRANSACTION",
      severity: "Warning",
      entityType: "GiftCardTransaction",
      technicalReference: null,
      currency: null,
      expectedAmount: null,
      actualAmount: null,
      message: "A transaction has no matching domain record.",
    },
    {
      code: "sharing.claimed_without_transfer",
      severity: "Error",
      entityType: "GiftCardShare",
      technicalReference: "018f5da0-2c41-7b7e-9d3f-6a2f0d7c4e15",
      currency: "TRY",
      expectedAmount: 20,
      actualAmount: 0,
      message: "A claimed share has no matching Ledger transfer.",
    },
  ],
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ReconciliationPanel>> = {},
) {
  const props: React.ComponentProps<typeof ReconciliationPanel> = {
    result: undefined,
    hasFinancePermission: true,
    isRunning: false,
    onRun: vi.fn(),
    ...overrides,
  };
  render(<ReconciliationPanel {...props} />);
  return props;
}

describe("ReconciliationPanel", () => {
  it("waits for an explicit run", async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    expect(
      screen.getByRole("heading", {
        name: "Ready to verify financial records",
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Run reconciliation" }),
    );

    expect(props.onRun).toHaveBeenCalledOnce();
  });

  it("shows a consistent backend result with checked counts", () => {
    renderPanel({
      result: {
        ...inconsistentResult,
        isConsistent: true,
        findings: [],
      },
    });

    expect(
      screen.getByRole("heading", { name: "No inconsistencies found" }),
    ).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
  });

  it("reports the sharing scope the backend checked", () => {
    // A clean result and a sharing check that never ran look identical without
    // these counts, which is the whole point of showing them after Phase 3.
    renderPanel({
      result: {
        ...inconsistentResult,
        isConsistent: true,
        findings: [],
      },
    });

    expect(screen.getByText("Shares checked")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
    expect(screen.getByText("Active reservations checked")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });

  it("renders a sharing finding with a readable code and entity", () => {
    renderPanel({ result: inconsistentResult });

    expect(screen.getByText("Sharing Claimed Without Transfer")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Gift Card Share" }),
    ).toBeVisible();
    expect(
      screen.getByText("A claimed share has no matching Ledger transfer."),
    ).toBeVisible();
  });

  it("renders findings without exposing technical references by default", async () => {
    const user = userEvent.setup();
    renderPanel({ result: inconsistentResult });

    expect(screen.getAllByText("Error")).toHaveLength(2);
    expect(screen.getByText("Warning")).toBeVisible();
    expect(screen.getByText("TRY 1,000.00")).toBeVisible();
    expect(screen.getByText("TRY 950.00")).toBeVisible();

    const disclosures = screen.getAllByText("Technical reference");
    for (const disclosure of disclosures) {
      expect(disclosure.closest("details")).not.toHaveAttribute("open");
    }

    await user.click(disclosures[0]);
    expect(
      screen.getByText("018f5da0-115b-7a69-84a0-991b1cd18d91"),
    ).toBeVisible();
  });

  it("preserves a successful result when a later run fails", () => {
    renderPanel({
      result: inconsistentResult,
      errorMessage: "Reconciliation is temporarily unavailable.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The previous successful result remains below.",
    );
    expect(screen.getByText("Transactions checked")).toBeVisible();
  });

  it("explains missing composite finance permission", () => {
    renderPanel({ hasFinancePermission: false });

    expect(
      screen.getByRole("heading", {
        name: "Reconciliation access is unavailable",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Run reconciliation" }),
    ).not.toBeInTheDocument();
  });
});
