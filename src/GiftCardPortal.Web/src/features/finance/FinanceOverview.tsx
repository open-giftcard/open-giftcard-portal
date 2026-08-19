import { type FormEvent, useEffect, useState } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import type {
  PortalFinancialHistoryCategory,
  PortalFinancialHistoryFilters,
  PortalFinancialHistoryItem,
  PortalFinancialSummary,
} from "../../types";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";
import { defaultCurrency } from "../../config";

interface FinanceOverviewProps {
  summary?: PortalFinancialSummary;
  history: PortalFinancialHistoryItem[];
  appliedHistoryFilters: PortalFinancialHistoryFilters;
  hasFinancePermission: boolean;
  hasMoreHistory: boolean;
  isSummaryLoading: boolean;
  isHistoryLoading: boolean;
  isLoadingMore: boolean;
  summaryError?: string;
  historyError?: string;
  loadMoreError?: string;
  onRetrySummary: () => void;
  onRetryHistory: () => void;
  onLoadMore: () => void;
  onApplyHistoryFilters: (filters: PortalFinancialHistoryFilters) => void;
}

function readableLabel(value: string): string {
  return value
    .replaceAll(/[._-]+/g, " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function referenceFor(item: PortalFinancialHistoryItem): string | undefined {
  return item.businessReference ?? item.giftCardPublicReference ?? undefined;
}

function categoryLabel(
  category: PortalFinancialHistoryCategory,
  t: Translator,
): string {
  switch (category) {
    case "CorporateCredit":
      return t("Corporate credit");
    case "GiftCard":
      return t("Gift card");
    case "Distribution":
      return t("Distribution");
    case "Lifecycle":
      return t("Lifecycle");
    default:
      return "";
  }
}

export function FinanceOverview({
  summary,
  history,
  appliedHistoryFilters,
  hasFinancePermission,
  hasMoreHistory,
  isSummaryLoading,
  isHistoryLoading,
  isLoadingMore,
  summaryError,
  historyError,
  loadMoreError,
  onRetrySummary,
  onRetryHistory,
  onLoadMore,
  onApplyHistoryFilters,
}: FinanceOverviewProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [category, setCategory] = useState(appliedHistoryFilters.category);
  const [operation, setOperation] = useState(appliedHistoryFilters.operation);
  const [currency, setCurrency] = useState(appliedHistoryFilters.currency);
  const [reference, setReference] = useState(appliedHistoryFilters.reference);
  const [occurredFrom, setOccurredFrom] = useState(
    appliedHistoryFilters.occurredFrom,
  );
  const [occurredThrough, setOccurredThrough] = useState(
    appliedHistoryFilters.occurredThrough,
  );
  const [filterError, setFilterError] = useState<string>();

  useEffect(() => {
    setCategory(appliedHistoryFilters.category);
    setOperation(appliedHistoryFilters.operation);
    setCurrency(appliedHistoryFilters.currency);
    setReference(appliedHistoryFilters.reference);
    setOccurredFrom(appliedHistoryFilters.occurredFrom);
    setOccurredThrough(appliedHistoryFilters.occurredThrough);
  }, [appliedHistoryFilters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (occurredFrom && occurredThrough && occurredFrom > occurredThrough) {
      setFilterError(t("The from date cannot be later than the through date."));
      return;
    }

    setFilterError(undefined);
    onApplyHistoryFilters({
      category,
      operation: operation.trim(),
      currency: currency.trim().toUpperCase(),
      reference: reference.trim(),
      occurredFrom,
      occurredThrough,
    });
  }

  function clearFilters() {
    setCategory("");
    setOperation("");
    setCurrency("");
    setReference("");
    setOccurredFrom("");
    setOccurredThrough("");
    setFilterError(undefined);
    onApplyHistoryFilters({
      category: "",
      operation: "",
      currency: "",
      reference: "",
      occurredFrom: "",
      occurredThrough: "",
    });
  }

  const activeFilters = [
    appliedHistoryFilters.category
      ? t("Category: {value}", {
          value: categoryLabel(appliedHistoryFilters.category, t),
        })
      : undefined,
    appliedHistoryFilters.operation
      ? t("Operation: {value}", { value: appliedHistoryFilters.operation })
      : undefined,
    appliedHistoryFilters.currency
      ? t("Currency: {value}", { value: appliedHistoryFilters.currency })
      : undefined,
    appliedHistoryFilters.reference
      ? t("Reference contains: {value}", {
          value: appliedHistoryFilters.reference,
        })
      : undefined,
    appliedHistoryFilters.occurredFrom
      ? t("From: {value} UTC", { value: appliedHistoryFilters.occurredFrom })
      : undefined,
    appliedHistoryFilters.occurredThrough
      ? t("Through: {value} UTC", {
          value: appliedHistoryFilters.occurredThrough,
        })
      : undefined,
  ].filter((filter): filter is string => Boolean(filter));
  const hasActiveFilters = activeFilters.length > 0;
  const hasDraftFilters = Boolean(
    category ||
    operation.trim() ||
    currency.trim() ||
    reference.trim() ||
    occurredFrom ||
    occurredThrough,
  );

  if (!hasFinancePermission) {
    return (
      <section className="finance-unavailable" aria-labelledby="finance-title">
        <StatusPanel
          title={t("Finance overview access is unavailable")}
          headingLevel={2}
        >
          {t(
            "Your role does not include both corporate credit and gift card visibility. Ask an organization administrator if you need this workspace.",
          )}
        </StatusPanel>
      </section>
    );
  }

  return (
    <div className="finance-workspace">
      <section aria-labelledby="finance-title">
        <div className="section-heading">
          <div>
            <p className="card-kicker">{t("Finance overview")}</p>
            <h2 id="finance-title" className="section-title">
              {t("Balances by currency")}
            </h2>
            <p className="supporting-copy">
              {t(
                "Rebuilt from the platform’s authoritative financial records. Currencies stay separate.",
              )}
            </p>
          </div>
          {summary ? (
            <p className="as-of">
              {t("As of")}{" "}
              <time dateTime={summary.asOfUtc}>
                {t("{timestamp} UTC", {
                  timestamp: formatters.utcDateTime(summary.asOfUtc),
                })}
              </time>
            </p>
          ) : null}
        </div>

        {isSummaryLoading ? (
          <div className="finance-region-state">
            <LoadingPanel label={t("Loading financial totals…")} />
          </div>
        ) : summaryError ? (
          <div className="finance-region-state">
            <StatusPanel
              title={t("Financial totals could not be loaded")}
              headingLevel={3}
              actionLabel={t("Try again")}
              onAction={onRetrySummary}
            >
              {summaryError}
            </StatusPanel>
          </div>
        ) : !summary?.currencies.length ? (
          <div className="empty-state">
            <h3>{t("No financial activity yet")}</h3>
            <p>
              {t(
                "Totals will appear here after the organization receives corporate credit or issues gift cards.",
              )}
            </p>
          </div>
        ) : (
          <div className="currency-stack">
            {summary.currencies.map((item) => (
              <article className="currency-panel" key={item.currency}>
                <div className="currency-panel__heading">
                  <div>
                    <p className="currency-code">{item.currency}</p>
                    <h3>{t("Current position")}</h3>
                  </div>
                  <span className="source-badge">{t("Backend reported")}</span>
                </div>
                <dl className="balance-grid">
                  <div className="balance-card balance-card--primary">
                    <dt>{t("Corporate credit available")}</dt>
                    <dd>
                      {formatters.money(
                        item.remainingCorporateCredit,
                        item.currency,
                      )}
                    </dd>
                  </div>
                  <div className="balance-card balance-card--primary">
                    <dt>{t("Gift card value remaining")}</dt>
                    <dd>
                      {formatters.money(
                        item.remainingGiftCardValue,
                        item.currency,
                      )}
                    </dd>
                  </div>
                  <div className="balance-card">
                    <dt>{t("Credit granted")}</dt>
                    <dd>{formatters.money(item.granted, item.currency)}</dd>
                  </div>
                  <div className="balance-card">
                    <dt>{t("Credit reversed")}</dt>
                    <dd>{formatters.money(item.reversed, item.currency)}</dd>
                  </div>
                  <div className="balance-card">
                    <dt>{t("Gift cards issued")}</dt>
                    <dd>{formatters.money(item.issued, item.currency)}</dd>
                  </div>
                  <div className="balance-card">
                    <dt>{t("Value distributed")}</dt>
                    <dd>{formatters.money(item.distributed, item.currency)}</dd>
                  </div>
                  <div className="balance-card">
                    <dt>{t("Cancelled value returned")}</dt>
                    <dd>
                      {formatters.money(item.cancelledReturned, item.currency)}
                    </dd>
                  </div>
                  <div className="balance-card">
                    <dt>{t("Expired value returned")}</dt>
                    <dd>
                      {formatters.money(item.expiredReturned, item.currency)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="activity-section" aria-labelledby="activity-title">
        <div className="section-heading">
          <div>
            <p className="card-kicker">{t("Financial activity report")}</p>
            <h2 id="activity-title" className="section-title">
              {t("Search financial activity")}
            </h2>
            <p className="supporting-copy">
              {t(
                "The backend searches the organization’s available history and returns stable, newest-first pages. The portal does not calculate totals from these results.",
              )}
            </p>
          </div>
        </div>

        <form
          className="financial-search"
          role="search"
          aria-labelledby="activity-title"
          onSubmit={applyFilters}
        >
          <div className="financial-search__fields">
            <div className="field">
              <label className="field__label" htmlFor="finance-category">
                {t("Category")}
              </label>
              <select
                id="finance-category"
                className="field__input field__select"
                value={category}
                onChange={(event) => {
                  setCategory(
                    event.target.value as PortalFinancialHistoryCategory,
                  );
                }}
              >
                <option value="">{t("All categories")}</option>
                <option value="CorporateCredit">{t("Corporate credit")}</option>
                <option value="GiftCard">{t("Gift card")}</option>
                <option value="Distribution">{t("Distribution")}</option>
                <option value="Lifecycle">{t("Lifecycle")}</option>
              </select>
            </div>
            <TextField
              className="field"
              value={operation}
              onChange={setOperation}
            >
              <Label className="field__label">{t("Exact operation")}</Label>
              <Input
                className="field__input"
                maxLength={128}
                placeholder={t("For example, Issued")}
              />
            </TextField>
            <TextField
              className="field"
              value={currency}
              onChange={setCurrency}
            >
              <Label className="field__label">{t("Currency")}</Label>
              <Input
                className="field__input"
                maxLength={3}
                pattern="[A-Za-z]{3}"
                placeholder={defaultCurrency}
              />
            </TextField>
            <TextField
              className="field"
              value={reference}
              onChange={setReference}
            >
              <Label className="field__label">
                {t("Business or card reference")}
              </Label>
              <Input
                className="field__input"
                maxLength={200}
                placeholder={t("Literal reference text")}
              />
            </TextField>
            <div className="field">
              <label className="field__label" htmlFor="finance-occurred-from">
                {t("From date (UTC)")}
              </label>
              <input
                id="finance-occurred-from"
                className="field__input"
                type="date"
                max={occurredThrough || undefined}
                value={occurredFrom}
                onChange={(event) => {
                  setOccurredFrom(event.target.value);
                }}
              />
            </div>
            <div className="field">
              <label
                className="field__label"
                htmlFor="finance-occurred-through"
              >
                {t("Through date (UTC)")}
              </label>
              <input
                id="finance-occurred-through"
                className="field__input"
                type="date"
                min={occurredFrom || undefined}
                value={occurredThrough}
                onChange={(event) => {
                  setOccurredThrough(event.target.value);
                }}
              />
            </div>
          </div>
          {filterError ? (
            <p className="error-banner" role="alert">
              {filterError}
            </p>
          ) : null}
          <div className="filter-form__actions">
            <Button
              className="button button--primary"
              type="submit"
              isDisabled={isHistoryLoading}
            >
              {isHistoryLoading ? t("Searching…") : t("Search activity")}
            </Button>
            <Button
              className="button button--quiet"
              type="button"
              isDisabled={
                isHistoryLoading || (!hasActiveFilters && !hasDraftFilters)
              }
              onPress={clearFilters}
            >
              {t("Clear filters")}
            </Button>
          </div>
        </form>

        <div className="active-filter-summary" aria-live="polite">
          {hasActiveFilters ? (
            <>
              <p>
                <strong>
                  {t("{count} active filters", { count: activeFilters.length })}
                </strong>
              </p>
              <ul aria-label={t("Active financial activity filters")}>
                {activeFilters.map((filter) => (
                  <li key={filter}>{filter}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              <strong>{t("All financial activity")}</strong>{" "}
              {t("— no search filters are active.")}
            </p>
          )}
        </div>

        {isHistoryLoading ? (
          <div className="finance-region-state">
            <LoadingPanel label={t("Loading recent financial activity…")} />
          </div>
        ) : historyError ? (
          <div className="finance-region-state">
            <StatusPanel
              title={t("Financial activity could not be loaded")}
              headingLevel={3}
              actionLabel={t("Try again")}
              onAction={onRetryHistory}
            >
              {historyError}
            </StatusPanel>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <h3>
              {hasActiveFilters
                ? t("No activity matches these filters")
                : t("No financial activity")}
            </h3>
            <p>
              {hasActiveFilters
                ? t(
                    "The authoritative backend returned no rows for this exact search. Adjust or clear the filters to try again.",
                  )
                : t("Financial events will appear here when activity begins.")}
            </p>
          </div>
        ) : (
          <>
            <p className="financial-result-count" aria-live="polite">
              {history.length === 1
                ? t("Showing 1 backend-returned event")
                : t("Showing {count} backend-returned events", {
                    count: history.length,
                  })}
            </p>
            <ol className="activity-list">
              {history.map((item) => {
                const reference = referenceFor(item);
                return (
                  <li className="activity-card" key={item.eventKey}>
                    <div className="activity-card__marker" aria-hidden="true" />
                    <div className="activity-card__body">
                      <div className="activity-card__heading">
                        <div>
                          <p className="activity-category">
                            {readableLabel(item.category)}
                          </p>
                          <h3>{readableLabel(item.operation)}</h3>
                        </div>
                        {item.amount !== null && item.currency ? (
                          <p className="activity-amount">
                            {formatters.money(item.amount, item.currency)}
                          </p>
                        ) : null}
                      </div>
                      <div className="activity-meta">
                        <time dateTime={item.occurredAtUtc}>
                          {t("{timestamp} UTC", {
                            timestamp: formatters.utcDateTime(
                              item.occurredAtUtc,
                            ),
                          })}
                        </time>
                        {reference ? (
                          <span>
                            {t("Reference {value}", { value: reference })}
                          </span>
                        ) : null}
                        {item.state ? (
                          <span>{readableLabel(item.state)}</span>
                        ) : null}
                        <span>{readableLabel(item.financialDirection)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {loadMoreError ? (
              <div className="pagination-error" role="alert">
                <p>{loadMoreError}</p>
                <Button
                  className="button button--secondary"
                  isDisabled={isLoadingMore}
                  onPress={onLoadMore}
                >
                  {t("Try loading more again")}
                </Button>
              </div>
            ) : hasMoreHistory ? (
              <div className="load-more">
                <Button
                  className="button button--secondary"
                  isDisabled={isLoadingMore}
                  onPress={onLoadMore}
                >
                  {isLoadingMore ? t("Loading more…") : t("Load more activity")}
                </Button>
              </div>
            ) : (
              <p className="timeline-end">
                {t("You have reached the end of these backend results.")}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
