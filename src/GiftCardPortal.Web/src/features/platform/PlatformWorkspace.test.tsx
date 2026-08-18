import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortalPlatformOrganizationPage, PortalUser } from "../../types";
import { PlatformWorkspace } from "./PlatformWorkspace";

const platformUser: PortalUser = {
  id: "018f5d99-7179-7b25-88d0-a9fc17b6361a",
  email: "operator@example.test",
  phoneNumber: null,
  status: "Active",
  contextType: "Platform",
  platformPermissions: ["platform.organizations.view"],
  organizationContext: null,
};

const customerPage: PortalPlatformOrganizationPage = {
  items: [
    {
      id: "018f5d9a-c17f-7b30-a954-4f28198669b7",
      name: "North Retail",
      code: "NORTH",
      status: "Active",
      depth: 0,
      createdAtUtc: "2026-07-28T10:00:00Z",
    },
  ],
  limit: 20,
  offset: 0,
  hasMore: true,
};

function renderWorkspace(
  overrides: Partial<React.ComponentProps<typeof PlatformWorkspace>> = {},
) {
  const props: React.ComponentProps<typeof PlatformWorkspace> = {
    user: platformUser,
    page: customerPage,
    filters: { search: "", status: "" },
    hasDirectoryPermission: true,
    isLoading: false,
    isDetailLoading: false,
    isLoggingOut: false,
    funding: {
      customerName: "North Retail",
      balances: [],
      allocations: [],
      hasViewPermission: false,
      hasAllocatePermission: false,
      hasReversePermission: false,
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
    },
    audit: {
      scopeName: "North Retail",
      records: [],
      appliedFilters: {
        operation: "",
        outcome: "",
        correlationId: "",
      },
      hasPermission: false,
      hasMore: false,
      isLoading: false,
      isLoadingMore: false,
      onApplyFilters: vi.fn(),
      onRetry: vi.fn(),
      onLoadMore: vi.fn(),
    },
    activeView: "customers",
    payments: {
      appliedFilters: {
        storeReference: "",
        state: "",
        currency: "",
        reference: "",
        occurredFrom: "",
        occurredThrough: "",
      },
      hasPermission: false,
      hasMore: false,
      isLoading: false,
      isLoadingMore: false,
      isReceiptLoading: false,
      onApplyFilters: vi.fn(),
      onRetry: vi.fn(),
      onLoadMore: vi.fn(),
      onOpenReceipt: vi.fn(),
      onCloseReceipt: vi.fn(),
      onRetryReceipt: vi.fn(),
    },
    onApplyFilters: vi.fn(),
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    onRetry: vi.fn(),
    onOpenOrganization: vi.fn(),
    onCloseOrganization: vi.fn(),
    onRetryOrganization: vi.fn(),
    onShowCustomers: vi.fn(),
    onShowPayments: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
  render(<PlatformWorkspace {...props} />);
  return props;
}

describe("PlatformWorkspace", () => {
  it("searches and filters without exposing customer identifiers", async () => {
    const interaction = userEvent.setup();
    const props = renderWorkspace();

    expect(screen.getByRole("heading", { name: "North Retail" })).toBeVisible();
    expect(screen.getByText("NORTH")).toBeVisible();
    expect(
      screen.queryByText("018f5d9a-c17f-7b30-a954-4f28198669b7"),
    ).not.toBeInTheDocument();

    await interaction.type(
      screen.getByRole("textbox", { name: "Company name or code" }),
      "  north  ",
    );
    await interaction.selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "Active",
    );
    await interaction.click(screen.getByRole("button", { name: "Search" }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      search: "north",
      status: "Active",
    });
    await interaction.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onNextPage).toHaveBeenCalledOnce();
    await interaction.click(
      screen.getByRole("button", { name: "View customer" }),
    );
    expect(props.onOpenOrganization).toHaveBeenCalledWith(
      "018f5d9a-c17f-7b30-a954-4f28198669b7",
    );
  });

  it("explains missing directory permission without rendering filters", () => {
    renderWorkspace({ hasDirectoryPermission: false, page: undefined });

    expect(
      screen.getByRole("heading", {
        name: "Customer directory access is unavailable",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("shows backend-loaded customer detail and returns to filters", async () => {
    const interaction = userEvent.setup();
    const props = renderWorkspace({
      selectedOrganizationId: customerPage.items[0].id,
      selectedOrganization: customerPage.items[0],
    });

    expect(screen.getByRole("heading", { name: "North Retail" })).toBeVisible();
    expect(screen.getByText("Root customer")).toBeVisible();
    expect(
      screen.queryByText(customerPage.items[0].id),
    ).not.toBeInTheDocument();

    await interaction.click(
      screen.getByRole("button", {
        name: "← Back to customer directory",
      }),
    );
    expect(props.onCloseOrganization).toHaveBeenCalledOnce();
  });
});
