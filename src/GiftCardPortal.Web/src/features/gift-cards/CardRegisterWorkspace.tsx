import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import type {
  PortalCardLifecycleState,
  PortalCardOwnershipState,
  PortalCardRegisterFilters,
  PortalCardRegisterItem,
  PortalCardRegisterPage,
} from "../../types";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { useFormatters, type PortalFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";
import { defaultCurrency } from "../../config";

/**
 * Backend states are identifiers. Turning them into sentences here rather than
 * showing the enum keeps the register readable by the finance staff who use it,
 * and keeps the wire values authoritative.
 */
function ownership(state: string, t: Translator) {
  const labels: Record<string, string> = {
    OrganizationInventory: t("In inventory"),
    AwaitingClaim: t("Sent, not claimed"),
    IdentityOwned: t("With recipient"),
  };
  return labels[state] ?? state;
}

/**
 * Funded amount leads because it is the company's own number and the reason
 * this screen exists. Remaining value sits beside it and is deliberately blank
 * for a card someone already owns.
 */
function registerColumns(
  t: Translator,
  formatters: PortalFormatters,
): readonly DataTableColumn<PortalCardRegisterItem>[] {
  return [
    {
      key: "reference",
      header: t("Gift card"),
      render: (card) => (
        <span className="gift-card-reference">{card.publicReference}</span>
      ),
    },
    {
      key: "recipient",
      header: t("Recipient"),
      render: (card) => card.maskedRecipientContact ?? t("Not sent yet"),
    },
    {
      key: "ownership",
      header: t("Ownership"),
      render: (card) => (
        <span className="status-chip">{ownership(card.ownershipState, t)}</span>
      ),
    },
    {
      key: "lifecycle",
      header: t("State"),
      render: (card) => (
        <span className="status-chip">{card.lifecycleState}</span>
      ),
    },
    {
      key: "funded",
      header: t("Funded"),
      numeric: true,
      render: (card) => formatters.money(card.fundedAmount, card.currency),
    },
    {
      key: "remaining",
      header: t("Remaining"),
      numeric: true,
      render: (card) =>
        card.remainingBalance === null ? (
          // Not an error and not zero. The company funded this card, and how
          // much of it the recipient has spent is theirs (ADR-052).
          <span
            className="data-table__absent"
            title={t("Held by the recipient")}
          >
            {t("Not shown")}
          </span>
        ) : (
          formatters.money(card.remainingBalance, card.currency)
        ),
    },
    {
      key: "issued",
      header: t("Issued (UTC)"),
      secondary: true,
      render: (card) => formatters.utcDate(card.issuedAtUtc),
    },
    {
      key: "expires",
      header: t("Expires (UTC)"),
      secondary: true,
      render: (card) => formatters.utcDate(card.expiresAtUtc),
    },
  ];
}

const emptyFilters: PortalCardRegisterFilters = {
  lifecycleState: "",
  ownershipState: "",
  currency: "",
  reference: "",
};

interface CardRegisterWorkspaceProps {
  register?: PortalCardRegisterPage;
  appliedFilters: PortalCardRegisterFilters;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  registerError?: string;
  loadMoreError?: string;
  onApplyFilters: (filters: PortalCardRegisterFilters) => void;
  onRetry: () => void;
  onLoadMore: () => void;
}

export function CardRegisterWorkspace({
  register,
  appliedFilters,
  hasMore,
  isLoading,
  isLoadingMore,
  registerError,
  loadMoreError,
  onApplyFilters,
  onRetry,
  onLoadMore,
}: CardRegisterWorkspaceProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [filters, setFilters] = useState(appliedFilters);

  useEffect(() => setFilters(appliedFilters), [appliedFilters]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyFilters({
      ...filters,
      currency: filters.currency.trim().toUpperCase(),
      reference: filters.reference.trim(),
    });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    onApplyFilters(emptyFilters);
  }

  return (
    <div className="workspace-section card-register">
      <section
        className="directory-filters"
        aria-labelledby="card-register-filter-title"
      >
        <div>
          <p className="card-kicker">
            {t("Every card this organization funded")}
          </p>
          <h2 id="card-register-filter-title" className="section-title">
            {t("Card register")}
          </h2>
          <p className="supporting-copy">
            {t(
              "Inventory shows only cards still held by the organization, so a card disappears from it the moment it reaches someone. The register keeps all of them. Recipient contacts are masked, and the remaining balance of a card someone already owns is not reported.",
            )}
          </p>
        </div>
        <form className="filter-form" role="search" onSubmit={submit}>
          <div className="field">
            <label className="field__label" htmlFor="register-ownership">
              {t("Ownership")}
            </label>
            <select
              id="register-ownership"
              className="field__input field__select"
              value={filters.ownershipState}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  ownershipState: event.target
                    .value as PortalCardOwnershipState,
                }))
              }
            >
              <option value="">{t("All ownership")}</option>
              <option value="OrganizationInventory">{t("In inventory")}</option>
              <option value="AwaitingClaim">{t("Sent, not claimed")}</option>
              <option value="IdentityOwned">{t("With recipient")}</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="register-lifecycle">
              {t("Lifecycle state")}
            </label>
            <select
              id="register-lifecycle"
              className="field__input field__select"
              value={filters.lifecycleState}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  lifecycleState: event.target
                    .value as PortalCardLifecycleState,
                }))
              }
            >
              <option value="">{t("All states")}</option>
              <option value="Active">{t("Active")}</option>
              <option value="AwaitingClaim">{t("Awaiting claim")}</option>
              <option value="Suspended">{t("Suspended")}</option>
              <option value="Cancelled">{t("Cancelled")}</option>
              <option value="Expired">{t("Expired")}</option>
            </select>
          </div>
          <TextField
            className="field"
            value={filters.currency}
            onChange={(value) =>
              setFilters((current) => ({ ...current, currency: value }))
            }
          >
            <Label className="field__label">{t("Currency")}</Label>
            <Input className="field__input" maxLength={3} placeholder={defaultCurrency} />
          </TextField>
          <TextField
            className="field"
            value={filters.reference}
            onChange={(value) =>
              setFilters((current) => ({ ...current, reference: value }))
            }
          >
            <Label className="field__label">{t("Card reference")}</Label>
            <Input
              className="field__input"
              placeholder={t("For example, GC-")}
            />
          </TextField>
          <div className="filter-form__actions">
            <Button className="button button--primary" type="submit">
              {t("Search register")}
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
        aria-labelledby="card-register-results-title"
        aria-busy={isLoading}
      >
        <div className="directory-results__heading">
          <div>
            <p className="card-kicker">{t("Newest first")}</p>
            <h2 id="card-register-results-title" className="section-title">
              {t("Funded cards")}
            </h2>
          </div>
          {register?.items.length ? (
            <p className="result-range" aria-live="polite">
              {t("{count} shown", { count: register.items.length })}
            </p>
          ) : null}
        </div>
        {isLoading ? (
          <LoadingPanel label={t("Loading the card register…")} />
        ) : registerError && !register ? (
          <StatusPanel
            title={t("The card register could not be loaded")}
            actionLabel={t("Try again")}
            onAction={onRetry}
          >
            {registerError}
          </StatusPanel>
        ) : !register?.items.length ? (
          <StatusPanel title={t("No cards match these filters")}>
            {t(
              "Clear one or more filters and search again. A newly created organization has no funded cards until the first issuance.",
            )}
          </StatusPanel>
        ) : (
          <>
            <DataTable
              caption={t("Gift cards funded by this organization")}
              columns={registerColumns(t, formatters)}
              rows={register.items}
              rowKey={(card) => card.giftCardId}
            />
            {loadMoreError ? (
              <StatusPanel
                title={t("More cards could not be loaded")}
                actionLabel={t("Try again")}
                onAction={onLoadMore}
              >
                {loadMoreError}
              </StatusPanel>
            ) : null}
            {hasMore ? (
              <Button
                className="button button--secondary"
                type="button"
                isDisabled={isLoadingMore}
                onPress={onLoadMore}
              >
                {isLoadingMore ? t("Loading…") : t("Load more cards")}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
