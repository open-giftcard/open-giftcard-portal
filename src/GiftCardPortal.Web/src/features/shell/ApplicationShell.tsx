import { Button } from "react-aria-components";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "../../i18n/translate";
import type { PortalUser } from "../../types";
import { AuditInvestigation } from "../audit/AuditInvestigation";
import { FinanceOverview } from "../finance/FinanceOverview";
import { ReconciliationPanel } from "../finance/ReconciliationPanel";
import { CardRegisterWorkspace } from "../gift-cards/CardRegisterWorkspace";
import { GiftCardWorkspace } from "../gift-cards/GiftCardWorkspace";
import { OrganizationStructure } from "../organizations/OrganizationStructure";
import { TeamWorkspace } from "../team/TeamWorkspace";

interface ApplicationShellProps {
  user: PortalUser;
  isChangingOrganization: boolean;
  isLoggingOut: boolean;
  errorMessage?: string;
  finance: React.ComponentProps<typeof FinanceOverview>;
  cards: React.ComponentProps<typeof GiftCardWorkspace>;
  cardRegister: React.ComponentProps<typeof CardRegisterWorkspace>;
  reconciliation: React.ComponentProps<typeof ReconciliationPanel>;
  organization: React.ComponentProps<typeof OrganizationStructure>;
  audit: React.ComponentProps<typeof AuditInvestigation>;
  team: React.ComponentProps<typeof TeamWorkspace>;
  onChangeOrganization: () => void;
  onLogout: () => void;
}

export function ApplicationShell({
  user,
  isChangingOrganization,
  isLoggingOut,
  errorMessage,
  finance,
  cards,
  cardRegister,
  reconciliation,
  organization,
  audit,
  team,
  onChangeOrganization,
  onLogout,
}: ApplicationShellProps) {
  type Workspace =
    | "overview"
    | "cards"
    | "register"
    | "organization"
    | "team"
    | "reconciliation"
    | "audit";
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedWorkspace = location.pathname.split("/")[1] as Workspace;
  const allowedWorkspaces: Workspace[] = [
    "overview",
    "cards",
    "register",
    "organization",
    "reconciliation",
    ...(Object.values(team.permissions).some(Boolean)
      ? (["team"] as Workspace[])
      : []),
    ...(audit.hasPermission ? (["audit"] as Workspace[]) : []),
  ];
  const workspace: Workspace = allowedWorkspaces.includes(requestedWorkspace)
    ? requestedWorkspace
    : "overview";
  const context = user.organizationContext;
  if (!context) {
    return null;
  }

  return (
    <main id="main-content" className="page-width shell-layout">
      <section className="shell-hero" aria-labelledby="shell-title">
        <div>
          <p className="eyebrow">{t("Verified organization context")}</p>
          <h1 id="shell-title" className="display-title display-title--compact">
            {context.organization.name}
          </h1>
          <p className="supporting-copy">
            {t("Organization code {code}", { code: context.organization.code })}
          </p>
        </div>
        <span className="verified-badge">
          <span aria-hidden="true">✓</span> {t("Verified")}
        </span>
      </section>

      {errorMessage ? (
        <p className="error-banner shell-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <nav className="workspace-nav" aria-label={t("Organization workspace")}>
        <Button
          className="workspace-nav__button"
          aria-current={workspace === "overview" ? "page" : undefined}
          onPress={() => {
            void navigate("/overview");
          }}
        >
          {t("Overview")}
        </Button>
        <Button
          className="workspace-nav__button"
          aria-current={workspace === "cards" ? "page" : undefined}
          onPress={() => {
            void navigate("/cards");
          }}
        >
          {t("Cards")}
        </Button>
        <Button
          className="workspace-nav__button"
          aria-current={workspace === "register" ? "page" : undefined}
          onPress={() => {
            void navigate("/register");
          }}
        >
          {t("Register")}
        </Button>
        <Button
          className="workspace-nav__button"
          aria-current={workspace === "organization" ? "page" : undefined}
          onPress={() => {
            void navigate("/organization");
          }}
        >
          {t("Organization")}
        </Button>
        {Object.values(team.permissions).some(Boolean) ? (
          <Button
            className="workspace-nav__button"
            aria-current={workspace === "team" ? "page" : undefined}
            onPress={() => {
              void navigate("/team");
            }}
          >
            {t("Team")}
          </Button>
        ) : null}
        <Button
          className="workspace-nav__button"
          aria-current={workspace === "reconciliation" ? "page" : undefined}
          onPress={() => {
            void navigate("/reconciliation");
          }}
        >
          {t("Reconciliation")}
        </Button>
        {audit.hasPermission ? (
          <Button
            className="workspace-nav__button"
            aria-current={workspace === "audit" ? "page" : undefined}
            onPress={() => {
              void navigate("/audit");
            }}
          >
            {t("Audit")}
          </Button>
        ) : null}
      </nav>

      {workspace === "overview" ? (
        <FinanceOverview {...finance} />
      ) : workspace === "cards" ? (
        <GiftCardWorkspace {...cards} />
      ) : workspace === "register" ? (
        <CardRegisterWorkspace {...cardRegister} />
      ) : workspace === "organization" ? (
        <OrganizationStructure {...organization} />
      ) : workspace === "team" ? (
        <TeamWorkspace {...team} />
      ) : workspace === "reconciliation" ? (
        <ReconciliationPanel {...reconciliation} />
      ) : (
        <AuditInvestigation {...audit} />
      )}

      <div className="shell-account-bar">
        <p>
          {t("Signed in as")} <strong>{user.email}</strong>
        </p>
        <div className="button-row">
          <Button
            className="button button--secondary"
            isDisabled={isChangingOrganization || isLoggingOut}
            onPress={() => {
              void navigate("/");
              onChangeOrganization();
            }}
          >
            {isChangingOrganization
              ? t("Clearing context…")
              : t("Change organization")}
          </Button>
          <Button
            className="button button--quiet"
            isDisabled={isChangingOrganization || isLoggingOut}
            onPress={onLogout}
          >
            {isLoggingOut ? t("Signing out…") : t("Sign out")}
          </Button>
        </div>
      </div>
    </main>
  );
}
