import { Button } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import type {
  PortalFinancialReconciliation,
  PortalReconciliationFinding,
} from "../../types";
import { useFormatters, type PortalFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";

interface ReconciliationPanelProps {
  result?: PortalFinancialReconciliation;
  hasFinancePermission: boolean;
  isRunning: boolean;
  errorMessage?: string;
  onRun: () => void;
}

function readableLabel(value: string): string {
  return value
    .replaceAll(/[._-]+/g, " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function amountLabel(
  label: string,
  amount: number | null,
  currency: string | null,
  formatters: PortalFormatters,
) {
  if (amount === null) {
    return null;
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {currency
          ? formatters.money(amount, currency)
          : formatters.number(amount)}
      </dd>
    </div>
  );
}

function Finding({
  finding,
  t,
  formatters,
}: {
  finding: PortalReconciliationFinding;
  t: Translator;
  formatters: PortalFormatters;
}) {
  const severityClass = finding.severity.toLowerCase();

  return (
    <li className={`finding-card finding-card--${severityClass}`}>
      <div className="finding-card__heading">
        <span className={`severity-badge severity-badge--${severityClass}`}>
          {finding.severity}
        </span>
        <span className="finding-code">{readableLabel(finding.code)}</span>
      </div>
      <h3>{readableLabel(finding.entityType)}</h3>
      <p>{finding.message}</p>
      {finding.expectedAmount !== null || finding.actualAmount !== null ? (
        <dl className="finding-amounts">
          {amountLabel(
            t("Expected"),
            finding.expectedAmount,
            finding.currency,
            formatters,
          )}
          {amountLabel(
            t("Actual"),
            finding.actualAmount,
            finding.currency,
            formatters,
          )}
        </dl>
      ) : null}
      {finding.technicalReference ? (
        <details className="technical-reference">
          <summary>{t("Technical reference")}</summary>
          <code>{finding.technicalReference}</code>
        </details>
      ) : null}
    </li>
  );
}

export function ReconciliationPanel({
  result,
  hasFinancePermission,
  isRunning,
  errorMessage,
  onRun,
}: ReconciliationPanelProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  if (!hasFinancePermission) {
    return (
      <section
        className="finance-unavailable"
        aria-labelledby="reconciliation-title"
      >
        <StatusPanel
          title={t("Reconciliation access is unavailable")}
          headingLevel={2}
        >
          {t(
            "Your role does not include both corporate credit and gift card visibility. Ask an organization administrator if you need this workspace.",
          )}
        </StatusPanel>
      </section>
    );
  }

  if (isRunning && !result) {
    return (
      <section
        className="reconciliation-workspace"
        aria-labelledby="reconciliation-title"
      >
        <div className="section-heading">
          <div>
            <p className="card-kicker">{t("Financial controls")}</p>
            <h2 id="reconciliation-title" className="section-title">
              {t("Financial reconciliation")}
            </h2>
          </div>
        </div>
        <div className="finance-region-state" aria-live="polite">
          <LoadingPanel
            label={t("Checking authoritative financial records…")}
          />
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section
        className="reconciliation-workspace"
        aria-labelledby="reconciliation-title"
      >
        <div className="section-heading">
          <div>
            <p className="card-kicker">{t("Financial controls")}</p>
            <h2 id="reconciliation-title" className="section-title">
              {t("Financial reconciliation")}
            </h2>
            <p className="supporting-copy">
              {t(
                "Compare company financial records with immutable Ledger postings. This read-only check never changes or repairs history.",
              )}
            </p>
          </div>
        </div>
        <div className="reconciliation-ready">
          {errorMessage ? (
            <p className="error-banner" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div>
            <h3>{t("Ready to verify financial records")}</h3>
            <p>
              {t(
                "The platform will check linked transactions, gift cards, amounts, currencies, account roles, balances, terminal values, share transfers, child card lineage, and active reservations.",
              )}
            </p>
          </div>
          <Button
            className="button button--primary"
            isDisabled={isRunning}
            onPress={onRun}
          >
            {t("Run reconciliation")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="reconciliation-workspace"
      aria-labelledby="reconciliation-title"
      aria-busy={isRunning}
    >
      <div className="section-heading">
        <div>
          <p className="card-kicker">{t("Financial controls")}</p>
          <h2 id="reconciliation-title" className="section-title">
            {t("Financial reconciliation")}
          </h2>
          <p className="supporting-copy">
            {t("A read-only result reported by the authoritative backend.")}
          </p>
        </div>
        <Button
          className="button button--secondary"
          isDisabled={isRunning}
          onPress={onRun}
        >
          {isRunning ? t("Running again…") : t("Run again")}
        </Button>
      </div>

      {errorMessage ? (
        <p className="error-banner reconciliation-error" role="alert">
          {errorMessage} {t("The previous successful result remains below.")}
        </p>
      ) : null}

      <div
        className={`reconciliation-result ${
          result.isConsistent
            ? "reconciliation-result--consistent"
            : "reconciliation-result--inconsistent"
        }`}
        role="status"
      >
        <div>
          <p className="result-label">{t("Backend result")}</p>
          <h3>
            {result.isConsistent
              ? t("No inconsistencies found")
              : result.findings.length === 1
                ? t("1 finding needs review")
                : t("{count} findings need review", {
                    count: result.findings.length,
                  })}
          </h3>
          <p>
            {t("Checked")}{" "}
            <time dateTime={result.checkedAtUtc}>
              {formatters.dateTime(result.checkedAtUtc)}
            </time>
          </p>
        </div>
        <dl className="reconciliation-counts">
          <div>
            <dt>{t("Transactions checked")}</dt>
            <dd>{formatters.number(result.transactionsChecked)}</dd>
          </div>
          <div>
            <dt>{t("Gift cards checked")}</dt>
            <dd>{formatters.number(result.giftCardsChecked)}</dd>
          </div>
          <div>
            <dt>{t("Shares checked")}</dt>
            <dd>{formatters.number(result.sharesChecked)}</dd>
          </div>
          <div>
            <dt>{t("Active reservations checked")}</dt>
            <dd>{formatters.number(result.activeReservationsChecked)}</dd>
          </div>
        </dl>
      </div>

      {result.findings.length ? (
        <div className="findings-section">
          <div>
            <h3>{t("Backend findings")}</h3>
            <p>
              {t(
                "Review these records with an authorized support or finance administrator. The portal cannot repair financial history.",
              )}
            </p>
          </div>
          <ol className="findings-list">
            {result.findings.map((finding, index) => (
              <Finding
                finding={finding}
                t={t}
                formatters={formatters}
                key={`${finding.code}-${finding.technicalReference ?? index}`}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
