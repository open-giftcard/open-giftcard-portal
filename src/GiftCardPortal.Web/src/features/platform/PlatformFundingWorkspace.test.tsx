import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalCorporateCreditAllocation } from "../../types";
import { PlatformFundingWorkspace } from "./PlatformFundingWorkspace";

const allocation: PortalCorporateCreditAllocation = {
  id: "018f5dc3-a865-7c11-a2a0-8326b3b96f62",
  amount: 250,
  currency: "TRY",
  businessReference: "CONTRACT-42",
  allocatedAtUtc: "2026-07-29T10:00:00Z",
  reversal: null,
};

function renderFunding(
  overrides: Partial<
    React.ComponentProps<typeof PlatformFundingWorkspace>
  > = {},
) {
  const props: React.ComponentProps<typeof PlatformFundingWorkspace> = {
    customerName: "North Retail",
    balances: [{ currency: "TRY", amount: 1250 }],
    allocations: [allocation],
    hasViewPermission: true,
    hasAllocatePermission: true,
    hasReversePermission: true,
    hasMoreHistory: false,
    isLoadingBalances: false,
    isLoadingHistory: false,
    isLoadingMore: false,
    isAllocating: false,
    isReversing: false,
    onRetryBalances: vi.fn(),
    onRetryHistory: vi.fn(),
    onLoadMore: vi.fn(),
    onAllocate: vi.fn(),
    onReverse: vi.fn(),
    ...overrides,
  };
  render(<PlatformFundingWorkspace {...props} />);
  return props;
}

describe("PlatformFundingWorkspace", () => {
  it("renders backend balances and history without technical identifiers", () => {
    renderFunding();

    expect(screen.getByText("TRY 1,250.00")).toBeVisible();
    expect(screen.getByText("CONTRACT-42")).toBeVisible();
    expect(screen.queryByText(allocation.id)).not.toBeInTheDocument();
  });

  it("reviews allocation intent and reuses its hidden identity for retry", async () => {
    const user = userEvent.setup();
    const props = renderFunding();
    const allocate = vi.mocked(props.onAllocate);

    await user.type(screen.getByRole("textbox", { name: "Amount" }), "500.25");
    await user.clear(screen.getByRole("textbox", { name: "Currency" }));
    await user.type(screen.getByRole("textbox", { name: "Currency" }), "try");
    await user.type(
      screen.getByRole("textbox", { name: "Business reference" }),
      " ORDER-99 ",
    );
    await user.click(screen.getByRole("button", { name: "Review allocation" }));

    expect(
      screen.getByRole("region", { name: "Review allocation" }),
    ).toHaveTextContent("TRY 500.25");
    await user.click(
      screen.getByRole("button", { name: "Confirm allocation" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm allocation" }),
    );

    expect(allocate).toHaveBeenCalledTimes(2);
    expect(allocate).toHaveBeenNthCalledWith(1, allocate.mock.calls[1][0]);
    expect(
      screen.queryByText(allocate.mock.calls[0][0].operationId),
    ).not.toBeInTheDocument();
  });

  it("requires review before confirming a full compensating reversal", async () => {
    const user = userEvent.setup();
    const props = renderFunding();

    await user.click(screen.getByRole("button", { name: "Review reversal" }));
    expect(
      screen.getByText(/full immutable compensating operation/i),
    ).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "Reversal reason" }),
      "Duplicate contract",
    );
    await user.click(
      screen.getByRole("button", { name: "Review full reversal" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm full reversal" }),
    );

    expect(props.onReverse).toHaveBeenCalledWith(
      expect.objectContaining({
        allocation,
        reason: "Duplicate contract",
      }),
    );
    expect(screen.queryByText(allocation.id)).not.toBeInTheDocument();
  });

  it("does not render funding without a backend permission", () => {
    const { container } = render(
      <PlatformFundingWorkspace
        customerName="North Retail"
        allocations={[]}
        hasViewPermission={false}
        hasAllocatePermission={false}
        hasReversePermission={false}
        hasMoreHistory={false}
        isLoadingBalances={false}
        isLoadingHistory={false}
        isLoadingMore={false}
        isAllocating={false}
        isReversing={false}
        onRetryBalances={vi.fn()}
        onRetryHistory={vi.fn()}
        onLoadMore={vi.fn()}
        onAllocate={vi.fn()}
        onReverse={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("announces completed reversals and keeps allocation failures explicit", () => {
    renderFunding({
      reversed: {
        amount: 250,
        currency: "TRY",
        reason: "Duplicate contract",
        reversedAtUtc: "2026-07-29T11:00:00Z",
      },
      allocationError: "The allocation could not be completed.",
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      /TRY\s250\.00 was reversed/,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The allocation could not be completed.",
    );
  });
});
