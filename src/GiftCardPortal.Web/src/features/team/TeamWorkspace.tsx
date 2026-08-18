import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import type {
  PortalRole,
  PortalRoleAssignment,
  PortalRoleScope,
  PortalTeamPage,
} from "../../types";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";

interface TeamPermissions {
  viewMembers: boolean;
  addMembers: boolean;
  disableMembers: boolean;
  viewRoles: boolean;
  createRoles: boolean;
  grantPermissions: boolean;
  assignRoles: boolean;
}

interface TeamWorkspaceProps {
  organizationName: string;
  page?: PortalTeamPage;
  roles?: PortalRole[];
  assignments?: PortalRoleAssignment[];
  currentMembershipId?: string;
  grantablePermissions?: string[];
  permissions: TeamPermissions;
  readOnly?: boolean;
  isLoading: boolean;
  isMutating?: boolean;
  errorMessage?: string;
  actionError?: string;
  successMessage?: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onRetry: () => void;
  onAddMember?: (email: string) => void;
  onDisableMember?: (membershipId: string) => void;
  onCreateRole?: (name: string) => void;
  onGrantPermissions?: (roleId: string, permissions: string[]) => void;
  onAssignRole?: (
    membershipId: string,
    roleId: string,
    scope: PortalRoleScope,
  ) => void;
}

type Review =
  | { kind: "add"; email: string }
  | { kind: "disable"; membershipId: string; email: string }
  | { kind: "role"; name: string }
  | { kind: "grant"; roleId: string; permissions: string[] }
  | {
      kind: "assign";
      membershipId: string;
      roleId: string;
      scope: PortalRoleScope;
    };

function permissionLabel(permission: string) {
  return permission
    .replace(/^organization\./, "")
    .replaceAll(".", " · ")
    .replaceAll("_", " ");
}

function assignmentScopeLabel(scope: string, t: Translator) {
  return scope === "Subtree"
    ? t("Organization and subsidiaries")
    : t("Current organization");
}

export function TeamWorkspace({
  organizationName,
  page,
  roles = [],
  assignments = [],
  currentMembershipId,
  grantablePermissions = [],
  permissions,
  readOnly = false,
  isLoading,
  isMutating = false,
  errorMessage,
  actionError,
  successMessage,
  onPreviousPage,
  onNextPage,
  onRetry,
  onAddMember,
  onDisableMember,
  onCreateRole,
  onGrantPermissions,
  onAssignRole,
}: TeamWorkspaceProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [grantRoleId, setGrantRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [assignmentMemberId, setAssignmentMemberId] = useState("");
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [scope, setScope] = useState<PortalRoleScope>("Organization");
  const [review, setReview] = useState<Review>();

  const activeMembers =
    page?.items.filter((member) => member.status === "Active") ?? [];
  const firstResult = page && page.items.length > 0 ? page.offset + 1 : 0;
  const lastResult = page ? page.offset + page.items.length : 0;
  const reviewedRole =
    review?.kind === "grant" || review?.kind === "assign"
      ? roles.find((role) => role.id === review.roleId)
      : undefined;
  const reviewedMember =
    review?.kind === "assign"
      ? activeMembers.find((member) => member.id === review.membershipId)
      : undefined;
  const assignmentCount = (roleId: string) =>
    assignments.filter((assignment) => assignment.roleId === roleId).length;
  const permissionsAlreadyHeld =
    roles.find((role) => role.id === grantRoleId)?.permissions ?? [];

  useEffect(() => {
    if (successMessage) {
      setReview(undefined);
    }
  }, [successMessage]);

  function reviewAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim()) {
      setReview({ kind: "add", email: email.trim() });
    }
  }

  function reviewRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roleName.trim()) {
      setReview({ kind: "role", name: roleName.trim() });
    }
  }

  function reviewGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (grantRoleId && selectedPermissions.length > 0) {
      setReview({
        kind: "grant",
        roleId: grantRoleId,
        permissions: [...selectedPermissions],
      });
    }
  }

  function reviewAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assignmentMemberId && assignmentRoleId) {
      setReview({
        kind: "assign",
        membershipId: assignmentMemberId,
        roleId: assignmentRoleId,
        scope,
      });
    }
  }

  function confirmReview() {
    if (!review) return;
    if (review.kind === "add") onAddMember?.(review.email);
    if (review.kind === "disable") onDisableMember?.(review.membershipId);
    if (review.kind === "role") onCreateRole?.(review.name);
    if (review.kind === "grant") {
      onGrantPermissions?.(review.roleId, review.permissions);
    }
    if (review.kind === "assign") {
      onAssignRole?.(review.membershipId, review.roleId, review.scope);
    }
  }

  return (
    <div className="team-workspace">
      <section aria-labelledby="team-title">
        <div className="section-heading">
          <div>
            <p className="card-kicker">
              {readOnly ? t("Customer access") : t("Organization access")}
            </p>
            <h2 id="team-title" className="section-title">
              {t("Team")}
            </h2>
            <p className="supporting-copy">
              {readOnly
                ? t(
                    "Read-only membership roster for {organization}. This does not enter or impersonate the customer.",
                    { organization: organizationName },
                  )
                : t(
                    "Memberships and roles for {organization}. Authorization and tenant scope remain enforced by the backend. To prevent lockout, you cannot disable your current membership.",
                    { organization: organizationName },
                  )}
            </p>
          </div>
          {page && page.items.length > 0 ? (
            <p className="result-range" aria-live="polite">
              {t("Showing {from}–{to}", { from: firstResult, to: lastResult })}
            </p>
          ) : null}
        </div>

        {!permissions.viewMembers ? (
          <StatusPanel
            title={t("Team roster access is unavailable")}
            headingLevel={3}
          >
            {t("Your role does not include membership viewing.")}
          </StatusPanel>
        ) : isLoading ? (
          <LoadingPanel label={t("Loading team members…")} />
        ) : errorMessage ? (
          <StatusPanel
            title={t("Team members could not be loaded")}
            headingLevel={3}
            actionLabel={t("Try again")}
            onAction={onRetry}
          >
            {errorMessage}
          </StatusPanel>
        ) : !page?.items.length ? (
          <StatusPanel title={t("No team members")} headingLevel={3}>
            {t("The backend returned no memberships for this organization.")}
          </StatusPanel>
        ) : (
          <>
            <ul className="team-grid">
              {page.items.map((member) => {
                const isCurrent = member.id === currentMembershipId;
                const memberAssignments = assignments
                  .filter((assignment) => assignment.membershipId === member.id)
                  .map((assignment) => ({
                    assignment,
                    role: roles.find((role) => role.id === assignment.roleId),
                  }))
                  .filter(
                    (
                      item,
                    ): item is {
                      assignment: PortalRoleAssignment;
                      role: PortalRole;
                    } => Boolean(item.role),
                  );
                return (
                  <li className="team-card" key={member.id}>
                    <div className="team-card__heading">
                      <div>
                        <h3>{member.email ?? t("Email unavailable")}</h3>
                        {isCurrent ? (
                          <p className="card-kicker">{t("Your membership")}</p>
                        ) : null}
                      </div>
                      <span className="status-chip">{member.status}</span>
                    </div>
                    <p>
                      {t("Added (UTC)")}{" "}
                      <time dateTime={member.createdAtUtc}>
                        {formatters.utcDate(member.createdAtUtc)}
                      </time>
                    </p>
                    {permissions.viewRoles && memberAssignments.length ? (
                      <ul
                        className="member-role-list"
                        aria-label={t("Role assignments for {member}", {
                          member: member.email ?? t("this member"),
                        })}
                      >
                        {memberAssignments.map(({ assignment, role }) => (
                          <li key={`${assignment.roleId}-${assignment.scope}`}>
                            <strong>{role.name}</strong>
                            <span>
                              {assignmentScopeLabel(assignment.scope, t)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {!readOnly &&
                    permissions.disableMembers &&
                    member.status === "Active" &&
                    !isCurrent ? (
                      <Button
                        className="button button--danger"
                        onPress={() => {
                          setReview({
                            kind: "disable",
                            membershipId: member.id,
                            email: member.email ?? t("this member"),
                          });
                        }}
                      >
                        {t("Disable member")}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="pagination" aria-label={t("Team member pages")}>
              <Button
                className="button button--secondary"
                isDisabled={page.offset === 0}
                onPress={onPreviousPage}
              >
                {t("Previous")}
              </Button>
              <Button
                className="button button--secondary"
                isDisabled={!page.hasMore}
                onPress={onNextPage}
              >
                {t("Next")}
              </Button>
            </div>
          </>
        )}
      </section>

      {!readOnly && permissions.addMembers ? (
        <section className="team-management" aria-labelledby="add-member-title">
          <div>
            <p className="card-kicker">{t("Membership management")}</p>
            <h2 id="add-member-title" className="section-title">
              {t("Add an existing account")}
            </h2>
            <p className="supporting-copy">
              {t(
                "This does not invite or create an account. The email must already belong to an active platform user.",
              )}
            </p>
          </div>
          <form className="team-form" onSubmit={reviewAdd}>
            <TextField
              className="field"
              isRequired
              value={email}
              onChange={setEmail}
            >
              <Label className="field__label">{t("Account email")}</Label>
              <Input
                className="field__input"
                type="email"
                autoComplete="email"
              />
            </TextField>
            <Button
              className="button button--primary"
              type="submit"
              isDisabled={!email.trim() || isMutating}
            >
              {t("Review member")}
            </Button>
          </form>
        </section>
      ) : null}

      {!readOnly && (permissions.viewRoles || permissions.createRoles) ? (
        <section className="team-management" aria-labelledby="roles-title">
          <div>
            <p className="card-kicker">{t("Role management")}</p>
            <h2 id="roles-title" className="section-title">
              {t("Roles and assignments")}
            </h2>
            <p className="supporting-copy">
              {t(
                "Permissions are additive. This slice does not revoke permissions, assignments, or memberships.",
              )}
            </p>
          </div>
          {!permissions.viewRoles ? (
            <p className="permission-note">
              {t("Your role can create roles but cannot list existing roles.")}
            </p>
          ) : !roles.length ? (
            <p className="permission-note">
              {t("No roles are currently available.")}
            </p>
          ) : (
            <ul className="role-grid">
              {roles.map((role) => (
                <li className="role-card" key={role.id}>
                  <h3>{role.name}</h3>
                  <p>
                    {role.permissions.length
                      ? role.permissions.map(permissionLabel).join(", ")
                      : t("No permissions granted")}
                  </p>
                  <p>
                    {assignmentCount(role.id) === 1
                      ? t("1 current assignment")
                      : t("{count} current assignments", {
                          count: assignmentCount(role.id),
                        })}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {permissions.createRoles ? (
            <form className="team-form" onSubmit={reviewRole}>
              <TextField
                className="field"
                isRequired
                value={roleName}
                onChange={setRoleName}
              >
                <Label className="field__label">{t("New role name")}</Label>
                <Input className="field__input" />
              </TextField>
              <Button
                className="button button--secondary"
                type="submit"
                isDisabled={roleName.trim().length < 2 || isMutating}
              >
                {t("Review new role")}
              </Button>
            </form>
          ) : null}

          {permissions.grantPermissions && roles.length ? (
            <form
              className="team-form team-form--stacked"
              onSubmit={reviewGrant}
            >
              <div className="field">
                <label className="field__label" htmlFor="permission-role">
                  {t("Role to extend")}
                </label>
                <select
                  id="permission-role"
                  className="field__input field__select"
                  value={grantRoleId}
                  onChange={(event) => {
                    setGrantRoleId(event.target.value);
                  }}
                >
                  <option value="">{t("Choose a role")}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="permission-choices">
                <legend>{t("Permissions to add")}</legend>
                {grantablePermissions
                  .filter(
                    (permission) =>
                      !permissionsAlreadyHeld.includes(permission),
                  )
                  .map((permission) => (
                    <label key={permission}>
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission)}
                        onChange={(event) => {
                          setSelectedPermissions((current) =>
                            event.target.checked
                              ? [...current, permission]
                              : current.filter((item) => item !== permission),
                          );
                        }}
                      />
                      {permissionLabel(permission)}
                    </label>
                  ))}
              </fieldset>
              <Button
                className="button button--secondary"
                type="submit"
                isDisabled={
                  !grantRoleId || selectedPermissions.length === 0 || isMutating
                }
              >
                {t("Review permission grant")}
              </Button>
            </form>
          ) : null}

          {permissions.assignRoles && roles.length && activeMembers.length ? (
            <form className="team-form" onSubmit={reviewAssignment}>
              <div className="field">
                <label className="field__label" htmlFor="assignment-member">
                  {t("Team member")}
                </label>
                <select
                  id="assignment-member"
                  className="field__input field__select"
                  value={assignmentMemberId}
                  onChange={(event) => {
                    setAssignmentMemberId(event.target.value);
                  }}
                >
                  <option value="">{t("Choose a member")}</option>
                  {activeMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.email ?? t("Email unavailable")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="assignment-role">
                  {t("Role")}
                </label>
                <select
                  id="assignment-role"
                  className="field__input field__select"
                  value={assignmentRoleId}
                  onChange={(event) => {
                    setAssignmentRoleId(event.target.value);
                  }}
                >
                  <option value="">{t("Choose a role")}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="assignment-scope">
                  {t("Scope")}
                </label>
                <select
                  id="assignment-scope"
                  className="field__input field__select"
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value as PortalRoleScope);
                  }}
                >
                  <option value="Organization">
                    {t("Current organization")}
                  </option>
                  <option value="Subtree">
                    {t("Organization and subsidiaries")}
                  </option>
                </select>
              </div>
              <Button
                className="button button--secondary"
                type="submit"
                isDisabled={
                  !assignmentMemberId || !assignmentRoleId || isMutating
                }
              >
                {t("Review role assignment")}
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {review ? (
        <section className="team-review" aria-labelledby="team-review-title">
          <p className="card-kicker">{t("Confirmation")}</p>
          <h2 id="team-review-title" className="section-title">
            {t("Review access change")}
          </h2>
          <p>
            {review.kind === "add"
              ? t("Add the existing account {email} to this organization.", {
                  email: review.email,
                })
              : review.kind === "disable"
                ? t(
                    "Disable {email}. They will lose this organization membership.",
                    { email: review.email },
                  )
                : review.kind === "role"
                  ? t("Create the role “{name}”.", { name: review.name })
                  : review.kind === "grant"
                    ? review.permissions.length === 1
                      ? t("Add 1 permission to {role}.", {
                          role: reviewedRole?.name ?? t("the selected role"),
                        })
                      : t("Add {count} permissions to {role}.", {
                          count: review.permissions.length,
                          role: reviewedRole?.name ?? t("the selected role"),
                        })
                    : t("Assign {role} to {member} for {scope}.", {
                        role: reviewedRole?.name ?? t("the selected role"),
                        member:
                          reviewedMember?.email ?? t("the selected member"),
                        scope:
                          review.scope === "Subtree"
                            ? t("the organization and its subsidiaries")
                            : t("the current organization"),
                      })}
          </p>
          {actionError ? (
            <p className="error-banner" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="button-row">
            <Button
              className="button button--primary"
              isDisabled={isMutating}
              onPress={confirmReview}
            >
              {isMutating ? t("Applying change…") : t("Confirm access change")}
            </Button>
            <Button
              className="button button--quiet"
              isDisabled={isMutating}
              onPress={() => {
                setReview(undefined);
              }}
            >
              {t("Go back")}
            </Button>
          </div>
        </section>
      ) : null}
      {successMessage ? (
        <p className="success-banner" role="status">
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
