import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalGiftCard, PortalGiftCardDistribution } from "../../types";
import {
  GiftCardDistribution,
  type GiftCardDistributionIntent,
} from "./GiftCardDistribution";

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

const result: PortalGiftCardDistribution = {
  contactType: "Email",
  maskedRecipientContact: "r***@example.com",
  state: "Pending",
  claimExpiresAtUtc: "2026-08-04T09:00:00Z",
  businessReference: "EMPLOYEE-DELIVERY-42",
  distributedAtUtc: "2026-08-03T09:00:00Z",
};

describe("GiftCardDistribution", () => {
  it("reviews the full transient contact and reuses hidden identity for retry", async () => {
    const user = userEvent.setup();
    const send = vi.fn<(intent: GiftCardDistributionIntent) => void>();
    render(
      <GiftCardDistribution
        organizationName="Portal E2E"
        card={card}
        isSending={false}
        onBack={vi.fn()}
        onSend={send}
      />,
    );

    await user.clear(screen.getByLabelText("Business reference"));
    await user.type(
      screen.getByLabelText("Business reference"),
      " EMPLOYEE-DELIVERY-42 ",
    );
    await user.type(
      screen.getByLabelText("Recipient email"),
      "recipient@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Review delivery" }));

    const review = screen.getByRole("region", {
      name: "Review recipient delivery",
    });
    expect(review).toHaveTextContent("recipient@example.com");
    expect(review).toHaveTextContent("Portal E2E");
    expect(review).toHaveTextContent("does not move or recalculate value");
    await user.click(screen.getByRole("button", { name: "Confirm delivery" }));
    await user.click(screen.getByRole("button", { name: "Confirm delivery" }));

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0]);
    expect(send.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        giftCardId: card.id,
        contactType: "email",
        recipientContact: "recipient@example.com",
        businessReference: "EMPLOYEE-DELIVERY-42",
      }),
    );
    expect(
      screen.queryByText(send.mock.calls[0][0].operationId),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
  });

  it("shows only the backend-masked contact after success", () => {
    render(
      <GiftCardDistribution
        organizationName="Portal E2E"
        card={card}
        result={result}
        isSending={false}
        onBack={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("r***@example.com");
    expect(screen.queryByLabelText("Recipient email")).not.toBeInTheDocument();
    expect(screen.queryByText(card.id)).not.toBeInTheDocument();
    expect(screen.queryByText(/claim token/i)).not.toBeInTheDocument();
  });
});
