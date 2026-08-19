import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalGiftCard } from "../../types";
import { GiftCardWorkspace } from "./GiftCardWorkspace";
import { defaultCurrency } from "../../config";

const card: PortalGiftCard = {
  id: "018f5dc3-a865-7c11-a2a0-8326b3b96f62",
  publicReference: "GC-0123456789ABCDEF0123",
  businessReference: "EMPLOYEE-AWARD-42",
  fundedAmount: 150,
  currency: "TRY",
  ownershipState: "OrganizationInventory",
  lifecycleState: "Active",
  validFromUtc: "2026-08-01T09:00:00Z",
  expiresAtUtc: "2027-08-01T09:00:00Z",
  isTransferable: true,
  isDivisible: false,
  issuedAtUtc: "2026-08-01T09:00:00Z",
};

const bulkBatchUnavailable = {
  organizationName: "Portal E2E",
  canCreate: false,
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
};

function renderWorkspace(
  overrides: Partial<React.ComponentProps<typeof GiftCardWorkspace>> = {},
) {
  const props: React.ComponentProps<typeof GiftCardWorkspace> = {
    organizationName: "Portal E2E",
    cards: [card],
    hasViewPermission: true,
    hasIssuePermission: true,
    hasDistributePermission: false,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    isIssuing: false,
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
    onOpenCard: vi.fn(),
    onDistributeCard: vi.fn(),
    onIssue: vi.fn(),
    bulkBatch: bulkBatchUnavailable,
    ...overrides,
  };
  render(<GiftCardWorkspace {...props} />);
  return props;
}

describe("GiftCardWorkspace", () => {
  it("renders safe inventory fields without technical card identifiers", () => {
    renderWorkspace();

    expect(screen.getByText(card.publicReference)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: card.businessReference }),
    ).toBeVisible();
    expect(screen.getByText("TRY 150.00")).toBeVisible();
    expect(screen.getByText("Organization Inventory")).toBeVisible();
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
  });

  it("opens lifecycle detail from a returned card without rendering its id", async () => {
    const user = userEvent.setup();
    const props = renderWorkspace();

    await user.click(screen.getByRole("button", { name: "View lifecycle" }));

    expect(props.onOpenCard).toHaveBeenCalledWith(card.id);
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
  });

  it("opens recipient delivery only from an eligible returned inventory card", async () => {
    const user = userEvent.setup();
    const props = renderWorkspace({ hasDistributePermission: true });

    await user.click(screen.getByRole("button", { name: "Send to recipient" }));

    expect(props.onDistributeCard).toHaveBeenCalledWith(card);
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
  });

  it("reviews every issuance choice and reuses hidden identity for retry", async () => {
    const user = userEvent.setup();
    const props = renderWorkspace();
    const issue = vi.mocked(props.onIssue);

    await user.type(screen.getByLabelText("Amount"), "250.50");
    await user.type(
      screen.getByLabelText("Business reference"),
      " STAFF-AWARD-99 ",
    );
    fireEvent.change(screen.getByLabelText("Valid from date (optional)"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(
      screen.getByLabelText("Valid from time (optional; defaults to 00:00)"),
      { target: { value: "09:30" } },
    );
    fireEvent.change(screen.getByLabelText("Expiry date"), {
      target: { value: "2027-09-01" },
    });
    fireEvent.change(
      screen.getByLabelText("Expiry time (optional; defaults to 23:59)"),
      { target: { value: "09:30" } },
    );
    await user.click(screen.getByRole("checkbox", { name: "Transferable" }));
    await user.click(screen.getByRole("checkbox", { name: "Divisible" }));
    await user.click(screen.getByRole("button", { name: "Review issuance" }));

    const review = screen.getByRole("region", {
      name: "Review gift card issuance",
    });
    expect(review).toHaveTextContent("Portal E2E");
    expect(review).toHaveTextContent(`${defaultCurrency} 250.50`);
    expect(review).toHaveTextContent("STAFF-AWARD-99");
    expect(review).toHaveTextContent("Transferable · Divisible");

    await user.click(screen.getByRole("button", { name: "Confirm issuance" }));
    await user.click(screen.getByRole("button", { name: "Confirm issuance" }));

    expect(issue).toHaveBeenCalledTimes(2);
    expect(issue).toHaveBeenNthCalledWith(1, issue.mock.calls[1][0]);
    const submitted = issue.mock.calls[0][0];
    expect(submitted).toEqual(
      expect.objectContaining({
        amount: "250.50",
        currency: defaultCurrency,
        isTransferable: true,
        isDivisible: true,
        businessReference: "STAFF-AWARD-99",
      }),
    );
    expect(submitted.validFromUtc).toMatch(/Z$/);
    expect(submitted.expiresAtUtc).toMatch(/Z$/);
    expect(screen.queryByText(submitted.operationId)).not.toBeInTheDocument();
  });

  it("uses backend posting time when valid-from is omitted", async () => {
    const user = userEvent.setup();
    const props = renderWorkspace();

    await user.type(screen.getByLabelText("Amount"), "75");
    await user.type(screen.getByLabelText("Business reference"), "CAMPAIGN-75");
    fireEvent.change(screen.getByLabelText("Expiry date"), {
      target: { value: "2027-10-01" },
    });
    await user.click(screen.getByRole("button", { name: "Review issuance" }));

    expect(screen.getByText("Backend posting time")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm issuance" }));
    expect(props.onIssue).toHaveBeenCalledWith(
      expect.objectContaining({ validFromUtc: undefined }),
    );
    const expiry = new Date(
      vi.mocked(props.onIssue).mock.calls[0][0].expiresAtUtc,
    );
    expect(expiry.getHours()).toBe(23);
    expect(expiry.getMinutes()).toBe(59);
  });

  it("announces success and clears the reviewed form", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <GiftCardWorkspace
        organizationName="Portal E2E"
        cards={[]}
        hasViewPermission
        hasIssuePermission
        hasDistributePermission={false}
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        isIssuing={false}
        onRetry={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenCard={vi.fn()}
        onDistributeCard={vi.fn()}
        onIssue={vi.fn()}
        bulkBatch={bulkBatchUnavailable}
      />,
    );
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.type(screen.getByLabelText("Business reference"), "AWARD-100");
    fireEvent.change(screen.getByLabelText("Expiry date"), {
      target: { value: "2027-11-01" },
    });

    rerender(
      <GiftCardWorkspace
        organizationName="Portal E2E"
        cards={[card]}
        issuedCard={card}
        hasViewPermission
        hasIssuePermission
        hasDistributePermission={false}
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        isIssuing={false}
        onRetry={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenCard={vi.fn()}
        onDistributeCard={vi.fn()}
        onIssue={vi.fn()}
        bulkBatch={bulkBatchUnavailable}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      `${card.publicReference} was issued`,
    );
    expect(screen.getByLabelText("Amount")).toHaveValue("");
    expect(screen.getByLabelText("Business reference")).toHaveValue("");
  });

  it("separates inventory and issuance permissions", () => {
    renderWorkspace({
      hasViewPermission: true,
      hasIssuePermission: false,
    });

    expect(screen.getByText(card.publicReference)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Review issuance" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/cannot issue cards/i)).toBeVisible();
  });

  it("offers inventory and pagination retries without dropping prior cards", async () => {
    const user = userEvent.setup();
    const initial = renderWorkspace({
      cards: [],
      inventoryError: "The backend is unavailable.",
    });

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(initial.onRetry).toHaveBeenCalledOnce();

    const loadMore = vi.fn();
    const { unmount } = render(
      <GiftCardWorkspace
        organizationName="Portal E2E"
        cards={[card]}
        hasViewPermission
        hasIssuePermission
        hasDistributePermission={false}
        hasMore
        isLoading={false}
        isLoadingMore={false}
        isIssuing={false}
        loadMoreError="More cards could not be loaded."
        onRetry={vi.fn()}
        onLoadMore={loadMore}
        onOpenCard={vi.fn()}
        onDistributeCard={vi.fn()}
        onIssue={vi.fn()}
        bulkBatch={bulkBatchUnavailable}
      />,
    );
    expect(screen.getAllByText(card.publicReference)).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Try loading more again" }),
    );
    expect(loadMore).toHaveBeenCalledOnce();
    unmount();
  });

  it("renders an accessible unavailable state without either permission", () => {
    renderWorkspace({
      hasViewPermission: false,
      hasIssuePermission: false,
    });

    expect(screen.getByRole("region", { name: "Gift cards" })).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Gift card workspace access is unavailable",
      }),
    ).toBeVisible();
  });
});
