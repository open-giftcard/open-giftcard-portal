import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  PortalGiftCard,
  PortalGiftCardLifecycleDetail as LifecycleDetail,
  PortalGiftCardLifecycleEvent,
} from "../../types";
import { GiftCardLifecycleDetail } from "./GiftCardLifecycleDetail";

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

const lifecycleEvent: PortalGiftCardLifecycleEvent = {
  action: "Suspend",
  previousState: "Active",
  newState: "Suspended",
  reason: "Card reported missing",
  returnedAmount: null,
  currency: null,
  occurredAtUtc: "2026-08-03T09:00:00Z",
};

const detail: LifecycleDetail = {
  giftCard: card,
  events: [lifecycleEvent],
};

function renderDetail(
  overrides: Partial<React.ComponentProps<typeof GiftCardLifecycleDetail>> = {},
) {
  const props: React.ComponentProps<typeof GiftCardLifecycleDetail> = {
    organizationName: "Portal E2E",
    selectedCard: card,
    detail,
    hasManagePermission: true,
    isLoading: false,
    isRunning: false,
    onBack: vi.fn(),
    onRetry: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };
  render(<GiftCardLifecycleDetail {...props} />);
  return props;
}

describe("GiftCardLifecycleDetail", () => {
  it("renders safe current detail and immutable history without identifiers", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { name: card.businessReference }),
    ).toBeVisible();
    expect(screen.getByText(card.publicReference)).toBeVisible();
    expect(screen.getByText("Card reported missing")).toBeVisible();
    expect(screen.getByText("Active → Suspended")).toBeVisible();
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
  });

  it("reviews an action and preserves one hidden identity for retry", async () => {
    const user = userEvent.setup();
    const props = renderDetail();
    const run = vi.mocked(props.onRun);

    await user.click(screen.getByRole("button", { name: "Suspend" }));
    await user.type(screen.getByLabelText("Reason"), " Security review ");
    await user.click(screen.getByRole("button", { name: "Review action" }));

    const review = screen.getByRole("region", {
      name: "Review lifecycle action",
    });
    expect(review).toHaveTextContent("Portal E2E");
    expect(review).toHaveTextContent(card.publicReference);
    expect(review).toHaveTextContent("Security review");
    await user.click(screen.getByRole("button", { name: "Confirm suspend" }));
    await user.click(screen.getByRole("button", { name: "Confirm suspend" }));

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, run.mock.calls[1][0]);
    expect(run.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        giftCardId: card.id,
        action: "suspend",
        reason: "Security review",
      }),
    );
    expect(
      screen.queryByText(run.mock.calls[0][0].operationId),
    ).not.toBeInTheDocument();
  });

  it("requires stronger terminal review and reports backend-returned value", async () => {
    const user = userEvent.setup();
    const completedEvent: PortalGiftCardLifecycleEvent = {
      ...lifecycleEvent,
      action: "Cancel",
      newState: "Cancelled",
      returnedAmount: 150,
      currency: "TRY",
    };
    renderDetail({ completedEvent });

    expect(screen.getByRole("status")).toHaveTextContent(
      "The backend returned TRY 150.00",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByText(/Cancellation and expiration cannot be undone/),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Reason"), "Recipient request");
    await user.click(screen.getByRole("button", { name: "Review action" }));
    expect(screen.getByText(/This action is terminal/)).toBeVisible();
  });

  it("separates lifecycle-management permission from detail viewing", () => {
    renderDetail({ hasManagePermission: false });

    expect(screen.getByText("Card reported missing")).toBeVisible();
    expect(
      screen.getByText(/can view lifecycle detail but cannot change it/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Suspend" }),
    ).not.toBeInTheDocument();
  });

  it("offers safe retry when refreshed detail is unavailable", async () => {
    const user = userEvent.setup();
    const props = renderDetail({
      detail: undefined,
      errorMessage: "That card is no longer available.",
    });

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
  });
});
