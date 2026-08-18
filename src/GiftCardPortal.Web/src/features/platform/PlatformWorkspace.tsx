import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import type {
  PortalOrganization,
  PortalPlatformOrganizationPage,
  PortalUser,
} from "../../types";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";
import { AuditInvestigation } from "../audit/AuditInvestigation";
import { PlatformOrganizationDetail } from "./PlatformOrganizationDetail";
import { PlatformFundingWorkspace } from "./PlatformFundingWorkspace";
import { TeamWorkspace } from "../team/TeamWorkspace";
import { PaymentReportingWorkspace } from "./PaymentReportingWorkspace";

export type PlatformView = "customers" | "payments";

export interface PlatformDirectoryFilters {
  search: string;
  status: string;
}

interface PlatformWorkspaceProps {
  user: PortalUser;
  page?: PortalPlatformOrganizationPage;
  filters: PlatformDirectoryFilters;
  selectedOrganizationId?: string;
  selectedOrganization?: PortalOrganization;
  hasDirectoryPermission: boolean;
  isLoading: boolean;
  isDetailLoading: boolean;
  isLoggingOut: boolean;
  errorMessage?: string;
  detailErrorMessage?: string;
  funding: React.ComponentProps<typeof PlatformFundingWorkspace>;
  audit: React.ComponentProps<typeof AuditInvestigation>;
  team?: React.ComponentProps<typeof TeamWorkspace>;
  payments: React.ComponentProps<typeof PaymentReportingWorkspace>;
  activeView: PlatformView;
  onApplyFilters: (filters: PlatformDirectoryFilters) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onRetry: () => void;
  onOpenOrganization: (organizationId: string) => void;
  onCloseOrganization: () => void;
  onRetryOrganization: () => void;
  onShowCustomers: () => void;
  onShowPayments: () => void;
  onLogout: () => void;
}

export function PlatformWorkspace({
  user,
  page,
  filters,
  selectedOrganizationId,
  selectedOrganization,
  hasDirectoryPermission,
  isLoading,
  isDetailLoading,
  isLoggingOut,
  errorMessage,
  detailErrorMessage,
  funding,
  audit,
  team,
  payments,
  activeView,
  onApplyFilters,
  onPreviousPage,
  onNextPage,
  onRetry,
  onOpenOrganization,
  onCloseOrganization,
  onRetryOrganization,
  onShowCustomers,
  onShowPayments,
  onLogout,
}: PlatformWorkspaceProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState(filters.status);

  useEffect(() => {
    setSearch(filters.search);
    setStatus(filters.status);
  }, [filters.search, filters.status]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyFilters({ search: search.trim(), status });
  }

  function clearFilters() {
    setSearch("");
    setStatus("");
    onApplyFilters({ search: "", status: "" });
  }

  const firstResult = page && page.items.length > 0 ? page.offset + 1 : 0;
  const lastResult = page ? page.offset + page.items.length : 0;

  return (
    <main id="main-content" className="page-width platform-layout">
      <section className="platform-hero" aria-labelledby="platform-title">
        <div>
          <p className="eyebrow">{t("Platform operator workspace")}</p>
          <h1
            id="platform-title"
            className="display-title display-title--compact"
          >
            {activeView === "payments"
              ? t("POS payments")
              : t("Customer organizations")}
          </h1>
          <p className="supporting-copy supporting-copy--wide">
            {activeView === "payments"
              ? t(
                  "Investigate cross-tenant checkout, receipt, and refund activity.",
                )
              : t(
                  "Search the platform-authorized root customer directory by company name or code.",
                )}
          </p>
        </div>
        <div className="operator-summary">
          <span>{t("Signed in as")}</span>
          <strong>{user.email}</strong>
          <Button
            className="button button--quiet"
            isDisabled={isLoggingOut}
            onPress={onLogout}
          >
            {isLoggingOut ? t("Signing out…") : t("Sign out")}
          </Button>
        </div>
      </section>

      <nav className="workspace-nav" aria-label={t("Platform workspace")}>
        <Button
          className="workspace-nav__button"
          aria-current={activeView === "customers" ? "page" : undefined}
          onPress={onShowCustomers}
        >
          {t("Customers")}
        </Button>
        {payments.hasPermission ? (
          <Button
            className="workspace-nav__button"
            aria-current={activeView === "payments" ? "page" : undefined}
            onPress={onShowPayments}
          >
            {t("POS payments")}
          </Button>
        ) : null}
      </nav>

      {activeView === "payments" ? (
        <PaymentReportingWorkspace {...payments} />
      ) : selectedOrganizationId ? (
        <>
          <PlatformOrganizationDetail
            organization={selectedOrganization}
            isLoading={isDetailLoading}
            errorMessage={detailErrorMessage}
            onBack={onCloseOrganization}
            onRetry={onRetryOrganization}
          />
          <PlatformFundingWorkspace {...funding} />
          {team ? <TeamWorkspace {...team} /> : null}
          <AuditInvestigation {...audit} />
        </>
      ) : !hasDirectoryPermission ? (
        <div className="directory-centered">
          <StatusPanel title={t("Customer directory access is unavailable")}>
            {t(
              "Your platform account is active, but the backend did not grant customer-directory access. Contact a platform administrator if this is unexpected.",
            )}
          </StatusPanel>
        </div>
      ) : (
        <>
          <section className="directory-filters" aria-labelledby="filter-title">
            <div>
              <p className="card-kicker">{t("Directory filters")}</p>
              <h2 id="filter-title" className="section-title">
                {t("Find a customer")}
              </h2>
            </div>
            <form className="filter-form" role="search" onSubmit={submit}>
              <TextField
                className="field filter-form__search"
                value={search}
                onChange={setSearch}
              >
                <Label className="field__label">
                  {t("Company name or code")}
                </Label>
                <Input
                  className="field__input"
                  placeholder={t("For example, NORTH or North Retail")}
                />
              </TextField>
              <div className="field">
                <label className="field__label" htmlFor="customer-status">
                  {t("Status")}
                </label>
                <select
                  id="customer-status"
                  className="field__input field__select"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                  }}
                >
                  <option value="">{t("All statuses")}</option>
                  <option value="Active">{t("Active")}</option>
                  <option value="Suspended">{t("Suspended")}</option>
                  <option value="Disabled">{t("Disabled")}</option>
                </select>
              </div>
              <div className="filter-form__actions">
                <Button className="button button--primary" type="submit">
                  {t("Search")}
                </Button>
                <Button
                  className="button button--quiet"
                  type="button"
                  onPress={clearFilters}
                >
                  {t("Clear filters")}
                </Button>
              </div>
            </form>
          </section>

          <section
            className="directory-results"
            aria-labelledby="directory-results-title"
            aria-busy={isLoading}
          >
            <div className="directory-results__heading">
              <div>
                <p className="card-kicker">{t("Platform customers")}</p>
                <h2 id="directory-results-title" className="section-title">
                  {t("Directory results")}
                </h2>
              </div>
              {page && page.items.length > 0 ? (
                <p className="result-range" aria-live="polite">
                  {t("Showing {from}–{to}", {
                    from: firstResult,
                    to: lastResult,
                  })}
                </p>
              ) : null}
            </div>

            {isLoading ? (
              <div className="directory-state">
                <LoadingPanel label={t("Loading customer organizations…")} />
              </div>
            ) : errorMessage ? (
              <div className="directory-state">
                <StatusPanel
                  title={t("Customer organizations could not be loaded")}
                  actionLabel={t("Try again")}
                  onAction={onRetry}
                >
                  {errorMessage}
                </StatusPanel>
              </div>
            ) : !page?.items.length ? (
              <div className="directory-state">
                <StatusPanel title={t("No customers match these filters")}>
                  {t(
                    "Try a different company name, code, or status. The search is matched literally by the platform.",
                  )}
                </StatusPanel>
              </div>
            ) : (
              <>
                <ul className="customer-grid">
                  {page.items.map((organization) => (
                    <li className="customer-card" key={organization.id}>
                      <div className="customer-card__heading">
                        <h3>{organization.name}</h3>
                        <span className="status-chip">
                          {organization.status}
                        </span>
                      </div>
                      <dl className="customer-card__details">
                        <div>
                          <dt>{t("Customer code")}</dt>
                          <dd>{organization.code}</dd>
                        </div>
                        <div>
                          <dt>{t("Added (UTC)")}</dt>
                          <dd>
                            {formatters.utcDate(organization.createdAtUtc)}
                          </dd>
                        </div>
                      </dl>
                      <Button
                        className="button button--secondary customer-card__action"
                        onPress={() => {
                          onOpenOrganization(organization.id);
                        }}
                      >
                        {t("View customer")}
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="pagination" aria-label={t("Customer pages")}>
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
        </>
      )}
    </main>
  );
}
