import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortalOrganizationMembership, PortalUser } from "../../types";
import { OrganizationChooser } from "./OrganizationChooser";

const userAccount: PortalUser = {
  id: "018f5d99-7179-7b25-88d0-a9fc17b6361a",
  email: "staff@example.test",
  phoneNumber: null,
  status: "Active",
  contextType: "Identity",
  platformPermissions: [],
  organizationContext: null,
};

const organizations: PortalOrganizationMembership[] = [
  {
    membershipId: "018f5d9b-18fd-7c02-9e18-f9b3f594a39c",
    tenantRootOrganizationId: "018f5d9a-c17f-7b30-a954-4f28198669b7",
    membershipCreatedAtUtc: "2026-07-28T10:00:00Z",
    organization: {
      id: "018f5d9a-c17f-7b30-a954-4f28198669b7",
      name: "Demo Retail",
      code: "DEMO-RTL",
      status: "Active",
      depth: 0,
      createdAtUtc: "2026-07-28T10:00:00Z",
    },
  },
  {
    membershipId: "018f5d9b-18fd-7c02-9e18-f9b3f594a39d",
    tenantRootOrganizationId: "018f5d9a-c17f-7b30-a954-4f28198669b8",
    membershipCreatedAtUtc: "2026-07-28T10:00:00Z",
    organization: {
      id: "018f5d9a-c17f-7b30-a954-4f28198669b8",
      name: "Demo Logistics",
      code: "DEMO-LOG",
      status: "Active",
      depth: 0,
      createdAtUtc: "2026-07-28T10:00:00Z",
    },
  },
];

describe("OrganizationChooser", () => {
  it("selects only an organization returned by the platform", async () => {
    const interaction = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <OrganizationChooser
        user={userAccount}
        organizations={organizations}
        isPending={false}
        contextWasCleared={false}
        onSelect={onSelect}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await interaction.click(
      screen.getByRole("radio", { name: /Demo Logistics/ }),
    );
    await interaction.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSelect).toHaveBeenCalledWith(
      "018f5d9a-c17f-7b30-a954-4f28198669b8",
    );
  });

  it("announces when a previous context was cleared", () => {
    render(
      <OrganizationChooser
        user={userAccount}
        organizations={organizations}
        isPending={false}
        contextWasCleared
        onSelect={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "previous organization is no longer available",
    );
  });
});
