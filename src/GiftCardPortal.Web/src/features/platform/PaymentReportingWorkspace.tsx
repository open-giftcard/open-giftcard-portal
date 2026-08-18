import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import type {
  PortalPaymentFilters,
  PortalPaymentReceipt,
  PortalPaymentReportItem,
  PortalPaymentReportPage,
  PortalPaymentState,
} from "../../types";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { useFormatters, type PortalFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";

/**
 * One column per fact, ordered so the identifying values lead and the money
 * groups together on the right where it can be compared down the column.
 *
 * The POS client and receipt reference are marked secondary: useful when
 * reconciling on a wide screen, noise on a phone, and hidden there.
 */
function paymentColumns(
  t: Translator,
  formatters: PortalFormatters,
): readonly DataTableColumn<PortalPaymentReportItem>[] {
  return [
    {
      key: "card",
      header: t("Gift card"),
      render: (payment) => (
        <span className="gift-card-reference">
          {payment.giftCardPublicReference}
        </span>
      ),
    },
    {
      key: "store",
      header: t("Store / terminal"),
      render: (payment) =>
        `${payment.storeReference} / ${payment.posTerminalCode}`,
    },
    {
      key: "posClient",
      header: t("POS client"),
      secondary: true,
      render: (payment) =>
        `${payment.posClientDisplayName} (${payment.posClientCode})`,
    },
    {
      key: "receipt",
      header: t("Receipt reference"),
      secondary: true,
      render: (payment) => payment.posTransactionReference ?? t("Not supplied"),
    },
    {
      key: "confirmed",
      header: t("Confirmed"),
      numeric: true,
      render: (payment) =>
        payment.confirmedAmount === null
          ? t("Not confirmed")
          : formatters.money(payment.confirmedAmount, payment.currency),
    },
    {
      key: "refunded",
      header: t("Refunded"),
      numeric: true,
      render: (payment) =>
        formatters.money(payment.refundedAmount, payment.currency),
    },
    {
      key: "net",
      header: t("Net"),
      numeric: true,
      render: (payment) =>
        formatters.money(payment.netAmount, payment.currency),
    },
    {
      key: "created",
      header: t("Created (UTC)"),
      render: (payment) => formatters.utcDateTime(payment.createdAtUtc),
    },
    {
      key: "state",
      header: t("State"),
      render: (payment) => (
        <span className="status-chip">
          {payment.isFullyReversed ? t("Fully reversed") : payment.state}
        </span>
      ),
    },
  ];
}

interface PaymentReportingWorkspaceProps {
  report?: PortalPaymentReportPage;
  receipt?: PortalPaymentReceipt;
  appliedFilters: PortalPaymentFilters;
  hasPermission: boolean;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isReceiptLoading: boolean;
  reportError?: string;
  loadMoreError?: string;
  receiptError?: string;
  selectedPaymentId?: string;
  onApplyFilters: (filters: PortalPaymentFilters) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onOpenReceipt: (paymentId: string) => void;
  onCloseReceipt: () => void;
  onRetryReceipt: () => void;
}

export function PaymentReportingWorkspace({
  report,
  receipt,
  appliedFilters,
  hasPermission,
  hasMore,
  isLoading,
  isLoadingMore,
  isReceiptLoading,
  reportError,
  loadMoreError,
  receiptError,
  selectedPaymentId,
  onApplyFilters,
  onRetry,
  onLoadMore,
  onOpenReceipt,
  onCloseReceipt,
  onRetryReceipt,
}: PaymentReportingWorkspaceProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const columns = paymentColumns(t, formatters);
  const [filters, setFilters] = useState(appliedFilters);

  useEffect(() => setFilters(appliedFilters), [appliedFilters]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyFilters({
      ...filters,
      storeReference: filters.storeReference.trim(),
      currency: filters.currency.trim().toUpperCase(),
      reference: filters.reference.trim(),
    });
  }

  function clearFilters() {
    const empty: PortalPaymentFilters = {
      storeReference: "",
      state: "",
      currency: "",
      reference: "",
      occurredFrom: "",
      occurredThrough: "",
    };
    setFilters(empty);
    onApplyFilters(empty);
  }

  if (!hasPermission) {
    return (
      <section className="workspace-section">
        <StatusPanel title={t("POS payment reporting is unavailable")}>
          {t(
            "Your platform account does not have payment-report access. The backend controls this permission independently from customer and POS device administration.",
          )}
        </StatusPanel>
      </section>
    );
  }

  return (
    <div className="workspace-section payment-reporting">
      <section
        className="directory-filters"
        aria-labelledby="payment-filter-title"
      >
        <div>
          <p className="card-kicker">{t("Read-only operations report")}</p>
          <h2 id="payment-filter-title" className="section-title">
            {t("Find POS payments")}
          </h2>
          <p className="supporting-copy">
            {t(
              "Search by business references and UTC dates. Totals and reversal status come directly from the backend.",
            )}
          </p>
        </div>
        <form
          className="filter-form payment-filter-form"
          role="search"
          onSubmit={submit}
        >
          <TextField
            className="field"
            value={filters.storeReference}
            onChange={(value) =>
              setFilters((current) => ({ ...current, storeReference: value }))
            }
          >
            <Label className="field__label">{t("Store reference")}</Label>
            <Input
              className="field__input"
              placeholder={t("For example, STORE-101")}
            />
          </TextField>
          <div className="field">
            <label className="field__label" htmlFor="payment-state">
              {t("Payment state")}
            </label>
            <select
              id="payment-state"
              className="field__input field__select"
              value={filters.state}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  state: event.target.value as PortalPaymentState,
                }))
              }
            >
              <option value="">{t("All states")}</option>
              <option value="Active">{t("Active")}</option>
              <option value="Confirmed">{t("Confirmed")}</option>
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
            <Input className="field__input" maxLength={3} placeholder="TRY" />
          </TextField>
          <TextField
            className="field"
            value={filters.reference}
            onChange={(value) =>
              setFilters((current) => ({ ...current, reference: value }))
            }
          >
            <Label className="field__label">
              {t("Receipt or card reference")}
            </Label>
            <Input className="field__input" />
          </TextField>
          <div className="field">
            <label className="field__label" htmlFor="payment-from">
              {t("From date (UTC)")}
            </label>
            <input
              id="payment-from"
              className="field__input"
              type="date"
              value={filters.occurredFrom}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  occurredFrom: event.target.value,
                }))
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="payment-through">
              {t("Through date (UTC)")}
            </label>
            <input
              id="payment-through"
              className="field__input"
              type="date"
              value={filters.occurredThrough}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  occurredThrough: event.target.value,
                }))
              }
            />
          </div>
          <div className="filter-form__actions">
            <Button className="button button--primary" type="submit">
              {t("Search payments")}
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

      {report?.matchingTotals.length ? (
        <section aria-labelledby="payment-totals-title">
          <div className="directory-results__heading">
            <div>
              <p className="card-kicker">{t("All matching records")}</p>
              <h2 id="payment-totals-title" className="section-title">
                {t("Payment totals")}
              </h2>
            </div>
            <p className="result-range" aria-live="polite">
              {t("{count} matching payments", {
                count: report.totalMatchingPayments,
              })}
            </p>
          </div>
          <ul className="summary-grid payment-total-grid">
            {report.matchingTotals.map((total) => (
              <li className="summary-card" key={total.currency}>
                <h3>{total.currency}</h3>
                <dl className="customer-card__details">
                  <div>
                    <dt>{t("Confirmed")}</dt>
                    <dd>
                      {formatters.money(total.confirmedAmount, total.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Refunded")}</dt>
                    <dd>
                      {formatters.money(total.refundedAmount, total.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Net")}</dt>
                    <dd>{formatters.money(total.netAmount, total.currency)}</dd>
                  </div>
                  <div>
                    <dt>{t("Refunds")}</dt>
                    <dd>{total.refundCount}</dd>
                  </div>
                  <div>
                    <dt>{t("Fully reversed")}</dt>
                    <dd>{total.fullyReversedPaymentCount}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selectedPaymentId ? (
        <PaymentReceiptPanel
          receipt={receipt}
          columns={columns}
          t={t}
          formatters={formatters}
          isLoading={isReceiptLoading}
          error={receiptError}
          onClose={onCloseReceipt}
          onRetry={onRetryReceipt}
        />
      ) : null}

      <section
        className="directory-results"
        aria-labelledby="payment-results-title"
        aria-busy={isLoading}
      >
        <div className="directory-results__heading">
          <div>
            <p className="card-kicker">{t("Newest first")}</p>
            <h2 id="payment-results-title" className="section-title">
              {t("Payment results")}
            </h2>
          </div>
        </div>
        {isLoading ? (
          <LoadingPanel label={t("Loading POS payments…")} />
        ) : reportError && !report ? (
          <StatusPanel
            title={t("POS payments could not be loaded")}
            actionLabel={t("Try again")}
            onAction={onRetry}
          >
            {reportError}
          </StatusPanel>
        ) : !report?.items.length ? (
          <StatusPanel title={t("No payments match these filters")}>
            {t("Clear one or more filters and search again.")}
          </StatusPanel>
        ) : (
          <>
            <DataTable
              caption={t("Payments matching the current filters")}
              columns={columns}
              rows={report.items}
              rowKey={(payment) => payment.id}
              rowAction={
                onOpenReceipt
                  ? (payment) => (
                      // The cell stays narrow, so the visible word is just the
                      // noun, but a row action should announce as an action.
                      // "Receipt" is contained in the accessible name, so the
                      // two do not disagree for speech input.
                      <Button
                        className="button button--secondary button--compact"
                        aria-label={t("View receipt")}
                        onPress={() => onOpenReceipt(payment.id)}
                      >
                        {t("Receipt")}
                      </Button>
                    )
                  : undefined
              }
            />
            {loadMoreError ? (
              <p className="alert alert--error" role="alert">
                {loadMoreError}
              </p>
            ) : null}
            {hasMore ? (
              <Button
                className="button button--secondary"
                isDisabled={isLoadingMore}
                onPress={onLoadMore}
              >
                {isLoadingMore ? t("Loading more…") : t("Load more payments")}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function PaymentReceiptPanel({
  receipt,
  columns,
  t,
  formatters,
  isLoading,
  error,
  onClose,
  onRetry,
}: {
  receipt?: PortalPaymentReceipt;
  columns: readonly DataTableColumn<PortalPaymentReportItem>[];
  t: Translator;
  formatters: PortalFormatters;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <section
      className="detail-card payment-receipt"
      aria-labelledby="payment-receipt-title"
      aria-busy={isLoading}
    >
      <div className="directory-results__heading">
        <div>
          <p className="card-kicker">{t("Receipt and immutable returns")}</p>
          <h2 id="payment-receipt-title" className="section-title">
            {t("Payment receipt")}
          </h2>
        </div>
        <Button className="button button--quiet" onPress={onClose}>
          {t("Close receipt")}
        </Button>
      </div>
      {isLoading ? (
        <LoadingPanel label={t("Loading receipt…")} />
      ) : error ? (
        <StatusPanel
          title={t("Receipt could not be loaded")}
          actionLabel={t("Try again")}
          onAction={onRetry}
        >
          {error}
        </StatusPanel>
      ) : receipt ? (
        <>
          <dl className="customer-card__details payment-result__details">
            {columns.map((column) => (
              <div key={column.key}>
                <dt>{column.header}</dt>
                <dd>{column.render(receipt.payment)}</dd>
              </div>
            ))}
          </dl>
          <h3>{t("Refund history")}</h3>
          {!receipt.refunds.length ? (
            <p>{t("No refunds were recorded for this payment.")}</p>
          ) : (
            <ol className="timeline-list">
              {receipt.refunds.map((refund, index) => (
                <li key={`${refund.refundedAtUtc}-${index}`}>
                  <strong>
                    {formatters.money(refund.amount, receipt.payment.currency)}
                  </strong>
                  <span>{refund.reason}</span>
                  <span>
                    {refund.storeReference} / {refund.posTerminalCode}
                  </span>
                  <span>
                    {t("{timestamp} UTC", {
                      timestamp: formatters.utcDateTime(refund.refundedAtUtc),
                    })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </section>
  );
}
