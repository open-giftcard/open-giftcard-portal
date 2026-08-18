import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PortalCardRegisterItem,
  PortalCardRegisterPage,
} from "../../types";
import { CardRegisterWorkspace } from "./CardRegisterWorkspace";

/**
 * Derived with the same formatter the component uses. Hard-coding the rendered
 * string would pin the test to one ICU version: this Node build renders TRY
 * without the lira symbol, and a different one may not.
 *
 * The separator is collapsed because Intl emits a non-breaking space and
 * Testing Library normalizes whitespace before comparing, so the two would
 * otherwise look identical and never match.
 */
function money(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "TRY",
  })
    .format(amount)
    .replace(/\s+/g, " ");
}

const inInventory: PortalCardRegisterItem = {
  giftCardId: "018f5dc3-a865-7c11-a2a0-000000000001",
  publicReference: "GC-INV-0001",
  lifecycleState: "Active",
  ownershipState: "OrganizationInventory",
  fundedAmount: 500,
  currency: "TRY",
  remainingBalance: 500,
  maskedRecipientContact: null,
  validFromUtc: "2026-07-01T00:00:00Z",
  expiresAtUtc: "2027-07-01T00:00:00Z",
  issuedAtUtc: "2026-07-01T00:00:00Z",
  distributedAtUtc: null,
  claimedAtUtc: null,
};

const withRecipient: PortalCardRegisterItem = {
  giftCardId: "018f5dc3-a865-7c11-a2a0-000000000002",
  publicReference: "GC-OWNED-0002",
  lifecycleState: "Active",
  ownershipState: "IdentityOwned",
  fundedAmount: 750,
  currency: "TRY",
  // Suppressed by the backend for a card an identity owns (ADR-052).
  remainingBalance: null,
  maskedRecipientContact: "a***@example.com",
  validFromUtc: "2026-07-01T00:00:00Z",
  expiresAtUtc: "2027-07-01T00:00:00Z",
  issuedAtUtc: "2026-07-02T00:00:00Z",
  distributedAtUtc: "2026-07-03T00:00:00Z",
  claimedAtUtc: "2026-07-04T00:00:00Z",
};

const register: PortalCardRegisterPage = {
  items: [inInventory, withRecipient],
  limit: 25,
  nextCursor: "opaque-cursor",
};

function renderWorkspace(
  overrides: Partial<React.ComponentProps<typeof CardRegisterWorkspace>> = {},
) {
  const props: React.ComponentProps<typeof CardRegisterWorkspace> = {
    register,
    appliedFilters: {
      lifecycleState: "",
      ownershipState: "",
      currency: "",
      reference: "",
    },
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    onApplyFilters: () => {},
    onRetry: () => {},
    onLoadMore: () => {},
    ...overrides,
  };
  return render(<CardRegisterWorkspace {...props} />);
}

function rowFor(reference: string) {
  return screen.getByRole("cell", { name: reference }).closest("tr")!;
}

/** The stacked narrow layout keys off data-label, so it identifies a column. */
function cell(reference: string, column: string) {
  return rowFor(reference).querySelector(`[data-label="${column}"]`)!;
}

describe("CardRegisterWorkspace", () => {
  it("reports the funded amount for every card, claimed or not", () => {
    renderWorkspace();

    expect(cell("GC-INV-0001", "Funded")).toHaveTextContent(money(500));
    expect(cell("GC-OWNED-0002", "Funded")).toHaveTextContent(money(750));
  });

  it("withholds the remaining balance once a recipient owns the card", () => {
    renderWorkspace();

    // The company's own money, so its balance is shown.
    expect(cell("GC-INV-0001", "Remaining")).toHaveTextContent(money(500));

    // Someone else's spending, so it is not. Asserted as an absence of any
    // figure rather than a particular word, because substituting a zero here
    // would be a quiet misstatement of what the recipient has left.
    const claimed = within(rowFor("GC-OWNED-0002"));
    expect(claimed.getByText("Not shown")).toBeInTheDocument();
    expect(claimed.queryByText(money(0))).not.toBeInTheDocument();
    expect(claimed.getAllByText(/\d+\.\d{2}/)).toHaveLength(1);
  });

  it("masks the recipient and never renders a full address", () => {
    renderWorkspace();
    const body = document.body.textContent ?? "";

    expect(screen.getByText("a***@example.com")).toBeInTheDocument();
    expect(body).not.toContain("@example.com,");
    expect(
      within(rowFor("GC-INV-0001")).getByText("Not sent yet"),
    ).toBeInTheDocument();
  });

  it("says a card is with its recipient rather than showing the enum", () => {
    renderWorkspace();

    expect(
      within(rowFor("GC-OWNED-0002")).getByText("With recipient"),
    ).toBeInTheDocument();
    expect(
      within(rowFor("GC-INV-0001")).getByText("In inventory"),
    ).toBeInTheDocument();
    expect(screen.queryByText("IdentityOwned")).not.toBeInTheDocument();
    expect(screen.queryByText("OrganizationInventory")).not.toBeInTheDocument();
  });

  it("applies normalized filters when searched", async () => {
    const applied: unknown[] = [];
    renderWorkspace({ onApplyFilters: (filters) => applied.push(filters) });

    await userEvent.selectOptions(
      screen.getByLabelText("Ownership"),
      "IdentityOwned",
    );
    // The currency box is capped at three characters, so trimming is exercised
    // on the reference below where padding actually survives the input.
    await userEvent.type(screen.getByLabelText("Currency"), "try");
    await userEvent.type(screen.getByLabelText("Card reference"), " gc-0001 ");
    await userEvent.click(
      screen.getByRole("button", { name: "Search register" }),
    );

    expect(applied).toEqual([
      {
        lifecycleState: "",
        ownershipState: "IdentityOwned",
        currency: "TRY",
        reference: "gc-0001",
      },
    ]);
  });

  it("offers more cards only while the backend reports another page", () => {
    const { rerender } = renderWorkspace();
    expect(
      screen.getByRole("button", { name: "Load more cards" }),
    ).toBeInTheDocument();

    rerender(
      <CardRegisterWorkspace
        register={{ ...register, nextCursor: null }}
        appliedFilters={{
          lifecycleState: "",
          ownershipState: "",
          currency: "",
          reference: "",
        }}
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        onApplyFilters={() => {}}
        onRetry={() => {}}
        onLoadMore={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Load more cards" }),
    ).not.toBeInTheDocument();
  });

  it("explains an empty register instead of showing a bare table", () => {
    renderWorkspace({ register: { items: [], limit: 25, nextCursor: null } });

    expect(
      screen.getByText("No cards match these filters"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers a retry when the register could not be loaded", async () => {
    let retried = 0;
    renderWorkspace({
      register: undefined,
      registerError: "The card register is temporarily unavailable.",
      onRetry: () => {
        retried += 1;
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retried).toBe(1);
  });
});
