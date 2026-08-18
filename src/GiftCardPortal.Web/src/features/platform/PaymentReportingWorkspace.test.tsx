import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PortalPaymentReportPage,
  PortalPaymentReceipt,
} from "../../types";
import { PaymentReportingWorkspace } from "./PaymentReportingWorkspace";

const payment = {
  id: "018f5dc3-a865-7c11-a2a0-8326b3b96fc0",
  giftCardPublicReference: "DEMO-PAY-0042",
  posClientCode: "POS-NORTH",
  posClientDisplayName: "North Retail POS",
  posTerminalCode: "TERM-07",
  storeReference: "STORE-101",
  posTransactionReference: "RECEIPT-9001",
  provisionedAmount: 50,
  confirmedAmount: 50,
  refundedAmount: 12,
  netAmount: 38,
  currency: "TRY",
  state: "Confirmed",
  isFullyReversed: false,
  refundCount: 1,
  createdAtUtc: "2026-08-05T11:00:00Z",
  settledAtUtc: "2026-08-05T11:01:00Z",
};

const report: PortalPaymentReportPage = {
  items: [payment],
  limit: 20,
  nextCursor: "opaque",
  totalMatchingPayments: 1,
  matchingTotals: [
    {
      currency: "TRY",
      paymentCount: 1,
      confirmedPaymentCount: 1,
      refundCount: 1,
      fullyReversedPaymentCount: 0,
      provisionedAmount: 50,
      confirmedAmount: 50,
      refundedAmount: 12,
      netAmount: 38,
    },
  ],
};

function renderWorkspace(
  overrides: Partial<
    React.ComponentProps<typeof PaymentReportingWorkspace>
  > = {},
) {
  const props: React.ComponentProps<typeof PaymentReportingWorkspace> = {
    report,
    appliedFilters: {
      storeReference: "",
      state: "",
      currency: "",
      reference: "",
      occurredFrom: "",
      occurredThrough: "",
    },
    hasPermission: true,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    isReceiptLoading: false,
    onApplyFilters: vi.fn(),
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
    onOpenReceipt: vi.fn(),
    onCloseReceipt: vi.fn(),
    onRetryReceipt: vi.fn(),
    ...overrides,
  };
  render(<PaymentReportingWorkspace {...props} />);
  return props;
}

describe("PaymentReportingWorkspace", () => {
  it("shows backend totals and searches business fields without identifiers", async () => {
    const interaction = userEvent.setup();
    const props = renderWorkspace();

    expect(screen.getByText("1 matching payments")).toBeVisible();
    expect(screen.getAllByText(/TRY.*38\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText("DEMO-PAY-0042")).toBeVisible();
    expect(screen.queryByText(payment.id)).not.toBeInTheDocument();

    await interaction.type(
      screen.getByRole("textbox", { name: "Store reference" }),
      " store-101 ",
    );
    await interaction.selectOptions(
      screen.getByRole("combobox", { name: "Payment state" }),
      "Confirmed",
    );
    await interaction.type(
      screen.getByRole("textbox", { name: "Currency" }),
      "try",
    );
    await interaction.click(
      screen.getByRole("button", { name: "Search payments" }),
    );

    expect(props.onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        storeReference: "store-101",
        state: "Confirmed",
        currency: "TRY",
      }),
    );
    await interaction.click(
      screen.getByRole("button", { name: "View receipt" }),
    );
    expect(props.onOpenReceipt).toHaveBeenCalledWith(payment.id);
  });

  it("renders immutable refund detail without technical identifiers", () => {
    const receipt: PortalPaymentReceipt = {
      payment,
      refunds: [
        {
          posTerminalCode: "TERM-07",
          storeReference: "STORE-101",
          posTransactionReference: "RECEIPT-9001-R1",
          reason: "Customer return",
          amount: 12,
          refundedAtUtc: "2026-08-05T11:15:00Z",
        },
      ],
    };
    renderWorkspace({ selectedPaymentId: payment.id, receipt });

    expect(
      screen.getByRole("heading", { name: "Payment receipt" }),
    ).toBeVisible();
    expect(screen.getByText("Customer return")).toBeVisible();
    expect(screen.queryByText(payment.id)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "View receipt" }),
    ).toHaveLength(1);
  });

  it("does not render report controls without permission", () => {
    renderWorkspace({ hasPermission: false, report: undefined });

    expect(
      screen.getByRole("heading", {
        name: "POS payment reporting is unavailable",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });
});
