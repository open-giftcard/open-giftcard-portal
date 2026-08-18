import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  PortalRole,
  PortalRoleAssignment,
  PortalTeamPage,
} from "../../types";
import { TeamWorkspace } from "./TeamWorkspace";

const currentMembershipId = "018f5d9b-18fd-7c02-9e18-f9b3f594a39c";
const otherMembershipId = "018f5dc3-a865-7c11-a2a0-8326b3b96fb0";
const roleId = "018f5dc3-a865-7c11-a2a0-8326b3b96fb2";

const page: PortalTeamPage = {
  items: [
    {
      id: currentMembershipId,
      email: "staff@example.test",
      status: "Active",
      createdAtUtc: "2026-07-31T09:00:00Z",
      disabledAtUtc: null,
    },
    {
      id: otherMembershipId,
      email: "operator@example.test",
      status: "Active",
      createdAtUtc: "2026-07-31T09:00:00Z",
      disabledAtUtc: null,
    },
  ],
  limit: 25,
  offset: 0,
  hasMore: false,
};

const roles: PortalRole[] = [
  {
    id: roleId,
    name: "Gift card operator",
    permissions: ["organization.gift_cards.view"],
    createdAtUtc: "2026-07-31T09:05:00Z",
  },
];

const assignments: PortalRoleAssignment[] = [
  {
    membershipId: otherMembershipId,
    roleId,
    scope: "Subtree",
    createdAtUtc: "2026-07-31T09:10:00Z",
  },
];

function renderTeam(
  overrides: Partial<React.ComponentProps<typeof TeamWorkspace>> = {},
) {
  const props: React.ComponentProps<typeof TeamWorkspace> = {
    organizationName: "North Retail",
    page,
    roles,
    assignments,
    currentMembershipId,
    grantablePermissions: [
      "organization.gift_cards.view",
      "organization.gift_cards.issue",
    ],
    permissions: {
      viewMembers: true,
      addMembers: true,
      disableMembers: true,
      viewRoles: true,
      createRoles: true,
      grantPermissions: true,
      assignRoles: true,
    },
    isLoading: false,
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    onRetry: vi.fn(),
    onAddMember: vi.fn(),
    onDisableMember: vi.fn(),
    onCreateRole: vi.fn(),
    onGrantPermissions: vi.fn(),
    onAssignRole: vi.fn(),
    ...overrides,
  };
  render(<TeamWorkspace {...props} />);
  return props;
}

describe("TeamWorkspace", () => {
  it("reviews an email before adding an existing account", async () => {
    const user = userEvent.setup();
    const props = renderTeam();

    await user.type(
      screen.getByRole("textbox", { name: "Account email" }),
      "  new.operator@example.test  ",
    );
    await user.click(screen.getByRole("button", { name: "Review member" }));

    expect(props.onAddMember).not.toHaveBeenCalled();
    expect(screen.getByText(/new\.operator@example\.test/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirm access change" }),
    );
    expect(props.onAddMember).toHaveBeenCalledWith("new.operator@example.test");
  });

  it("never offers self-disable and confirms disabling another member", async () => {
    const user = userEvent.setup();
    const props = renderTeam();

    expect(screen.getByText("Your membership")).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Disable member" }),
    ).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Disable member" }));
    expect(screen.getByText(/Disable operator@example\.test/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirm access change" }),
    );
    expect(props.onDisableMember).toHaveBeenCalledWith(otherMembershipId);
  });

  it("shows authoritative named role assignments without rendering IDs", () => {
    renderTeam();

    const assignmentList = screen.getByRole("list", {
      name: "Role assignments for operator@example.test",
    });
    expect(assignmentList).toHaveTextContent("Gift card operator");
    expect(assignmentList).toHaveTextContent("Organization and subsidiaries");
    expect(assignmentList).not.toHaveTextContent(roleId);
    expect(assignmentList).not.toHaveTextContent(otherMembershipId);
  });

  it("builds permission grants only from supplied effective permissions", async () => {
    const user = userEvent.setup();
    const props = renderTeam();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Role to extend" }),
      roleId,
    );
    await user.click(
      screen.getByRole("checkbox", { name: "gift cards · issue" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Review permission grant" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm access change" }),
    );

    expect(props.onGrantPermissions).toHaveBeenCalledWith(roleId, [
      "organization.gift_cards.issue",
    ]);
    expect(
      screen.queryByText("organization.platform.admin"),
    ).not.toBeInTheDocument();
  });

  it("renders a platform roster as read-only without management controls", () => {
    renderTeam({
      readOnly: true,
      permissions: {
        viewMembers: true,
        addMembers: false,
        disableMembers: false,
        viewRoles: false,
        createRoles: false,
        grantPermissions: false,
        assignRoles: false,
      },
    });

    expect(screen.getByText(/does not enter or impersonate/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Disable member" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Account email" }),
    ).not.toBeInTheDocument();
  });
});
