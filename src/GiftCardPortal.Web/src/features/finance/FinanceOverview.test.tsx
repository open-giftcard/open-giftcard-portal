import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PortalFinancialHistoryFilters,
  PortalFinancialHistoryItem,
  PortalFinancialSummary,
} from "../../types";
import { FinanceOverview } from "./FinanceOverview";

const summary: PortalFinancialSummary = {
  asOfUtc: "2026-07-29T12:30:00Z",
  currencies: [
    {
      currency: "TRY",
      granted: 1000,
      reversed: 50,
      issued: 250,
      distributed: 200,
      remainingCorporateCredit: 700,
      remainingGiftCardValue: 200,
      cancelledReturned: 25,
      expiredReturned: 25,
    },
  ],
};

const history: PortalFinancialHistoryItem[] = [
  {
    eventKey: "opaque-event-key",
    category: "CorporateCredit",
    operation: "Allocated",
    giftCardPublicReference: null,
    businessReference: "FUND-2026-001",
    amount: 1000,
    currency: "TRY",
    financialDirection: "Credit",
    state: "Committed",
    occurredAtUtc: "2026-07-29T12:00:00Z",
  },
];

const emptyFilters: PortalFinancialHistoryFilters = {
  category: "",
  operation: "",
  currency: "",
  reference: "",
  occurredFrom: "",
  occurredThrough: "",
};

function renderOverview(
  overrides: Partial<React.ComponentProps<typeof FinanceOverview>> = {},
) {
  const props: React.ComponentProps<typeof FinanceOverview> = {
    summary,
    history,
    appliedHistoryFilters: emptyFilters,
    hasFinancePermission: true,
    hasMoreHistory: true,
    isSummaryLoading: false,
    isHistoryLoading: false,
    isLoadingMore: false,
    onRetrySummary: vi.fn(),
    onRetryHistory: vi.fn(),
    onLoadMore: vi.fn(),
    onApplyHistoryFilters: vi.fn(),
    ...overrides,
  };
  render(<FinanceOverview {...props} />);
  return props;
}

describe("FinanceOverview", () => {
  it("renders backend totals and safe recent activity without technical IDs", () => {
    renderOverview();

    expect(
      screen.getByRole("heading", { name: "Balances by currency" }),
    ).toBeVisible();
    expect(screen.getByText("TRY 700.00")).toBeVisible();
    expect(screen.getAllByText("TRY 200.00")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Allocated" })).toBeVisible();
    expect(screen.getByText("Reference FUND-2026-001")).toBeVisible();
    expect(screen.queryByText("opaque-event-key")).not.toBeInTheDocument();
  });

  it("loads the next opaque history page only when requested", async () => {
    const interaction = userEvent.setup();
    const props = renderOverview();

    await interaction.click(
      screen.getByRole("button", { name: "Load more activity" }),
    );

    expect(props.onLoadMore).toHaveBeenCalledOnce();
  });

  it("keeps available totals when recent activity fails", async () => {
    const interaction = userEvent.setup();
    const props = renderOverview({
      history: [],
      historyError: "The activity service is temporarily unavailable.",
    });

    expect(screen.getByText("TRY 700.00")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Financial activity could not be loaded",
      }),
    ).toBeVisible();
    await interaction.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetryHistory).toHaveBeenCalledOnce();
  });

  it("keeps loaded activity when the next page fails", async () => {
    const interaction = userEvent.setup();
    const props = renderOverview({
      loadMoreError:
        "More activity could not be loaded. Your current results are unchanged.",
    });

    expect(screen.getByRole("heading", { name: "Allocated" })).toBeVisible();
    expect(
      screen.getByText(
        "More activity could not be loaded. Your current results are unchanged.",
      ),
    ).toBeVisible();
    await interaction.click(
      screen.getByRole("button", { name: "Try loading more again" }),
    );
    expect(props.onLoadMore).toHaveBeenCalledOnce();
  });

  it("explains missing composite finance permission without showing data", () => {
    renderOverview({ hasFinancePermission: false });

    expect(
      screen.getByRole("heading", {
        name: "Finance overview access is unavailable",
      }),
    ).toBeVisible();
    expect(screen.queryByText("TRY 700.00")).not.toBeInTheDocument();
  });

  it("submits normalized business filters without exposing technical selectors", async () => {
    const interaction = userEvent.setup();
    const props = renderOverview();

    await interaction.selectOptions(
      screen.getByLabelText("Category"),
      "GiftCard",
    );
    await interaction.type(
      screen.getByLabelText("Exact operation"),
      "  Issued  ",
    );
    await interaction.type(screen.getByLabelText("Currency"), "try");
    await interaction.type(
      screen.getByLabelText("Business or card reference"),
      "  GC-PORTAL  ",
    );
    await interaction.type(
      screen.getByLabelText("From date (UTC)"),
      "2026-07-01",
    );
    await interaction.type(
      screen.getByLabelText("Through date (UTC)"),
      "2026-07-29",
    );
    await interaction.click(
      screen.getByRole("button", { name: "Search activity" }),
    );

    expect(props.onApplyHistoryFilters).toHaveBeenCalledWith({
      category: "GiftCard",
      operation: "Issued",
      currency: "TRY",
      reference: "GC-PORTAL",
      occurredFrom: "2026-07-01",
      occurredThrough: "2026-07-29",
    });
  });

  it("summarizes active filters and distinguishes an authoritative empty result", () => {
    renderOverview({
      history: [],
      appliedHistoryFilters: {
        ...emptyFilters,
        category: "Lifecycle",
        currency: "TRY",
      },
    });

    expect(screen.getByText("2 active filters")).toBeVisible();
    expect(screen.getByText("Category: Lifecycle")).toBeVisible();
    expect(screen.getByText("Currency: TRY")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "No activity matches these filters",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/authoritative backend returned no rows/i),
    ).toBeVisible();
  });

  it("clears all applied filters deliberately", async () => {
    const interaction = userEvent.setup();
    const props = renderOverview({
      appliedHistoryFilters: {
        ...emptyFilters,
        reference: "FUND-42",
      },
    });

    await interaction.click(
      screen.getByRole("button", { name: "Clear filters" }),
    );

    expect(props.onApplyHistoryFilters).toHaveBeenCalledWith(emptyFilters);
  });

  it("clears an unsubmitted draft without requiring manual field erasure", async () => {
    const interaction = userEvent.setup();
    const props = renderOverview();

    await interaction.type(
      screen.getByLabelText("Business or card reference"),
      "UNSUBMITTED",
    );
    await interaction.click(
      screen.getByRole("button", { name: "Clear filters" }),
    );

    expect(screen.getByLabelText("Business or card reference")).toHaveValue("");
    expect(props.onApplyHistoryFilters).toHaveBeenCalledWith(emptyFilters);
  });
});
