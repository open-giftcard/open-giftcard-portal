import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortalAuditFilters, PortalAuditItem } from "../../types";
import { AuditInvestigation } from "./AuditInvestigation";

const emptyFilters: PortalAuditFilters = {
  operation: "",
  outcome: "",
  correlationId: "",
};

const records: PortalAuditItem[] = [
  {
    actorUserReference: "018f5dc3-a865-7c11-a2a0-8326b3b96fa1",
    actorType: "Organization member",
    operation: "authorization.denied",
    entityType: "Permission",
    entityReference: "organization.audit.view",
    outcome: "Failure",
    correlationReference: "018f5dc3-a865-7c11-a2a0-8326b3b96fa3",
    occurredAtUtc: "2026-07-30T08:15:00Z",
    metadata: {
      reason: "Permission check failed",
    },
  },
];

function renderAudit(
  overrides: Partial<React.ComponentProps<typeof AuditInvestigation>> = {},
) {
  const props: React.ComponentProps<typeof AuditInvestigation> = {
    scopeName: "Test Organization",
    records,
    appliedFilters: emptyFilters,
    hasPermission: true,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    onApplyFilters: vi.fn(),
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
    ...overrides,
  };
  render(<AuditInvestigation {...props} />);
  return props;
}

describe("AuditInvestigation", () => {
  it("keeps technical evidence collapsed until deliberate disclosure", async () => {
    const interaction = userEvent.setup();
    renderAudit();

    expect(screen.getByText("authorization.denied")).toBeVisible();
    expect(screen.getByText(/not a global sign-in log/i)).toBeVisible();
    const details = screen.getByText("Technical evidence").closest("details");
    expect(details).not.toHaveAttribute("open");

    await interaction.click(screen.getByText("Technical evidence"));

    expect(details).toHaveAttribute("open");
    expect(
      screen.getByText("018f5dc3-a865-7c11-a2a0-8326b3b96fa3"),
    ).toBeVisible();
    expect(screen.getByText("Permission check failed")).toBeVisible();
  });

  it("submits normalized exact filters", async () => {
    const interaction = userEvent.setup();
    const props = renderAudit();

    await interaction.type(
      screen.getByLabelText("Exact operation"),
      "  authorization.denied  ",
    );
    await interaction.selectOptions(
      screen.getByLabelText("Outcome"),
      "Failure",
    );
    await interaction.type(
      screen.getByLabelText("Correlation reference"),
      "018F5DC3-A865-7C11-A2A0-8326B3B96FA3",
    );
    await interaction.click(
      screen.getByRole("button", { name: "Search audit records" }),
    );

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      operation: "authorization.denied",
      outcome: "Failure",
      correlationId: "018f5dc3-a865-7c11-a2a0-8326b3b96fa3",
    });
  });

  it("rejects an incomplete correlation reference before search", async () => {
    const interaction = userEvent.setup();
    const props = renderAudit();

    await interaction.type(
      screen.getByLabelText("Correlation reference"),
      "not-complete",
    );
    await interaction.click(
      screen.getByRole("button", { name: "Search audit records" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a complete correlation reference.",
    );
    expect(props.onApplyFilters).not.toHaveBeenCalled();
  });

  it("clears an unsubmitted draft and applied filters", async () => {
    const interaction = userEvent.setup();
    const props = renderAudit({
      appliedFilters: {
        ...emptyFilters,
        outcome: "Success",
      },
    });

    await interaction.type(
      screen.getByLabelText("Exact operation"),
      "gift_card.issued",
    );
    await interaction.click(
      screen.getByRole("button", { name: "Clear filters" }),
    );

    expect(screen.getByLabelText("Exact operation")).toHaveValue("");
    expect(screen.getByLabelText("Outcome")).toHaveValue("");
    expect(props.onApplyFilters).toHaveBeenCalledWith(emptyFilters);
  });

  it("does not request or expose evidence without the named permission", () => {
    renderAudit({ hasPermission: false, records: [] });

    expect(
      screen.getByRole("region", { name: "Audit investigation" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Audit investigation access is unavailable",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Search audit records" }),
    ).not.toBeInTheDocument();
  });
});
