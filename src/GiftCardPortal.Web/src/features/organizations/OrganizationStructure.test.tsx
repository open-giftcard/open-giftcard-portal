import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PortalSubsidiaryPage } from "../../types";
import { OrganizationStructure } from "./OrganizationStructure";

const page: PortalSubsidiaryPage = {
  items: [
    {
      name: "North Retail",
      code: "NORTH",
      status: "Active",
      depth: 1,
      createdAtUtc: "2026-07-29T10:00:00Z",
    },
  ],
  limit: 20,
  offset: 0,
  hasMore: true,
};

function renderStructure(
  overrides: Partial<React.ComponentProps<typeof OrganizationStructure>> = {},
) {
  const props: React.ComponentProps<typeof OrganizationStructure> = {
    page,
    hasViewPermission: true,
    hasCreatePermission: true,
    isLoading: false,
    isCreating: false,
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  };
  render(<OrganizationStructure {...props} />);
  return props;
}

describe("OrganizationStructure", () => {
  it("renders safe direct-subsidiary details and paging", async () => {
    const user = userEvent.setup();
    const props = renderStructure();

    expect(screen.getByRole("heading", { name: "North Retail" })).toBeVisible();
    expect(screen.getByText("NORTH")).toBeVisible();
    expect(screen.getByText("Direct subsidiary")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onNextPage).toHaveBeenCalledOnce();
  });

  it("creates with trimmed business fields only", async () => {
    const user = userEvent.setup();
    const props = renderStructure();

    await user.type(
      screen.getByRole("textbox", { name: "Subsidiary name" }),
      "  East Retail  ",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Subsidiary code" }),
      "  EAST  ",
    );
    await user.click(screen.getByRole("button", { name: "Create subsidiary" }));

    expect(props.onCreate).toHaveBeenCalledWith("East Retail", "EAST");
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("announces creation and clears the form", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <OrganizationStructure
        page={page}
        hasViewPermission
        hasCreatePermission
        isLoading={false}
        isCreating={false}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
        onRetry={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: "Subsidiary name" }),
      "East Retail",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Subsidiary code" }),
      "EAST",
    );

    rerender(
      <OrganizationStructure
        page={page}
        createdSubsidiary={{
          name: "East Retail",
          code: "EAST",
          status: "Active",
          depth: 1,
          createdAtUtc: "2026-07-29T12:00:00Z",
        }}
        hasViewPermission
        hasCreatePermission
        isLoading={false}
        isCreating={false}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
        onRetry={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "East Retail was created",
    );
    expect(
      screen.getByRole("textbox", { name: "Subsidiary name" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("textbox", { name: "Subsidiary code" }),
    ).toHaveValue("");
  });

  it("separates view and create permissions", () => {
    renderStructure({
      hasViewPermission: true,
      hasCreatePermission: false,
    });

    expect(screen.getByText("North Retail")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Create subsidiary" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/cannot create subsidiaries/i)).toBeVisible();
  });

  it("offers a retry for a failed listing and announces create failures", async () => {
    const user = userEvent.setup();
    const props = renderStructure({
      page: undefined,
      listError: "The backend is unavailable.",
      createError: "That subsidiary code is already in use.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That subsidiary code is already in use.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it("renders an accessible unavailable state without either permission", () => {
    renderStructure({
      hasViewPermission: false,
      hasCreatePermission: false,
    });

    expect(
      screen.getByRole("region", { name: "Organization structure" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Organization workspace access is unavailable",
      }),
    ).toBeVisible();
  });
});
