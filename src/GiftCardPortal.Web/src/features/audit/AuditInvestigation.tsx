import { type FormEvent, useEffect, useState } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";
import type {
  PortalAuditFilters,
  PortalAuditItem,
  PortalAuditOutcomeFilter,
} from "../../types";

interface AuditInvestigationProps {
  scopeName: string;
  records: PortalAuditItem[];
  appliedFilters: PortalAuditFilters;
  hasPermission: boolean;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  errorMessage?: string;
  loadMoreError?: string;
  onApplyFilters: (filters: PortalAuditFilters) => void;
  onRetry: () => void;
  onLoadMore: () => void;
}

const emptyFilters: PortalAuditFilters = {
  operation: "",
  outcome: "",
  correlationId: "",
};

const correlationPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AuditInvestigation({
  scopeName,
  records,
  appliedFilters,
  hasPermission,
  hasMore,
  isLoading,
  isLoadingMore,
  errorMessage,
  loadMoreError,
  onApplyFilters,
  onRetry,
  onLoadMore,
}: AuditInvestigationProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [operation, setOperation] = useState(appliedFilters.operation);
  const [outcome, setOutcome] = useState(appliedFilters.outcome);
  const [correlationId, setCorrelationId] = useState(
    appliedFilters.correlationId,
  );
  const [filterError, setFilterError] = useState<string>();

  useEffect(() => {
    setOperation(appliedFilters.operation);
    setOutcome(appliedFilters.outcome);
    setCorrelationId(appliedFilters.correlationId);
  }, [appliedFilters]);

  if (!hasPermission) {
    return (
      <section className="audit-section" aria-label={t("Audit investigation")}>
        <StatusPanel title={t("Audit investigation access is unavailable")}>
          {t(
            "The backend did not grant audit-view permission for this workspace. Audit evidence remains protected and no records were requested.",
          )}
        </StatusPanel>
      </section>
    );
  }

  const activeFilters = [
    appliedFilters.operation
      ? t("Operation: {value}", { value: appliedFilters.operation })
      : undefined,
    appliedFilters.outcome
      ? t("Outcome: {value}", { value: appliedFilters.outcome })
      : undefined,
    appliedFilters.correlationId
      ? t("Correlation: {value}", { value: appliedFilters.correlationId })
      : undefined,
  ].filter((filter): filter is string => Boolean(filter));
  const hasActiveFilters = activeFilters.length > 0;
  const hasDraftFilters = Boolean(
    operation.trim() || outcome || correlationId.trim(),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCorrelation = correlationId.trim();
    if (
      normalizedCorrelation &&
      !correlationPattern.test(normalizedCorrelation)
    ) {
      setFilterError(t("Enter a complete correlation reference."));
      return;
    }

    setFilterError(undefined);
    onApplyFilters({
      operation: operation.trim(),
      outcome,
      correlationId: normalizedCorrelation.toLowerCase(),
    });
  }

  function clearFilters() {
    setOperation("");
    setOutcome("");
    setCorrelationId("");
    setFilterError(undefined);
    onApplyFilters(emptyFilters);
  }

  return (
    <section
      className="audit-section"
      aria-labelledby="audit-title"
      aria-busy={isLoading}
    >
      <div className="section-heading">
        <div>
          <p className="card-kicker">{t("Append-only evidence")}</p>
          <h2 id="audit-title" className="section-title">
            {t("Audit investigation")}
          </h2>
          <p className="supporting-copy">
            {t(
              "Showing organization-scoped records for {scope}, newest first in the exact order returned by the backend. This is not a global sign-in log.",
              { scope: scopeName },
            )}
          </p>
        </div>
      </div>

      <form
        className="audit-search"
        role="search"
        aria-labelledby="audit-title"
        onSubmit={submit}
      >
        <div className="audit-search__fields">
          <TextField
            className="field"
            value={operation}
            onChange={setOperation}
          >
            <Label className="field__label">{t("Exact operation")}</Label>
            <Input
              className="field__input"
              maxLength={128}
              placeholder={t("For example, authorization.denied")}
            />
          </TextField>
          <div className="field">
            <label className="field__label" htmlFor="audit-outcome">
              {t("Outcome")}
            </label>
            <select
              id="audit-outcome"
              className="field__input field__select"
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as PortalAuditOutcomeFilter);
              }}
            >
              <option value="">{t("All outcomes")}</option>
              <option value="Success">{t("Success")}</option>
              <option value="Failure">{t("Failure")}</option>
            </select>
          </div>
          <TextField
            className="field"
            value={correlationId}
            onChange={setCorrelationId}
          >
            <Label className="field__label">{t("Correlation reference")}</Label>
            <Input
              className="field__input field__input--technical"
              maxLength={36}
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </TextField>
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
            isDisabled={isLoading}
          >
            {isLoading ? t("Searching…") : t("Search audit records")}
          </Button>
          <Button
            className="button button--quiet"
            type="button"
            isDisabled={isLoading || (!hasActiveFilters && !hasDraftFilters)}
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
                {t("{count} active audit filters", {
                  count: activeFilters.length,
                })}
              </strong>
            </p>
            <ul aria-label={t("Active audit filters")}>
              {activeFilters.map((filter) => (
                <li key={filter}>{filter}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            <strong>{t("All available organization audit records")}</strong>{" "}
            {t("— no exact filters are active.")}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="audit-state">
          <LoadingPanel label={t("Loading protected audit evidence…")} />
        </div>
      ) : errorMessage ? (
        <div className="audit-state">
          <StatusPanel
            title={t("Audit evidence could not be loaded")}
            headingLevel={3}
            actionLabel={t("Try again")}
            onAction={onRetry}
          >
            {errorMessage}
          </StatusPanel>
        </div>
      ) : records.length === 0 ? (
        <div className="audit-state">
          <StatusPanel
            title={
              hasActiveFilters
                ? t("No audit records match these exact filters")
                : t("No organization audit records are available")
            }
            headingLevel={3}
          >
            {t(
              "The authoritative backend returned no records for this organization-scoped investigation.",
            )}
          </StatusPanel>
        </div>
      ) : (
        <>
          <p className="financial-result-count" aria-live="polite">
            {records.length === 1
              ? t("Showing 1 backend-returned audit record")
              : t("Showing {count} backend-returned audit records", {
                  count: records.length,
                })}
          </p>
          <ol className="audit-list">
            {records.map((record, recordIndex) => {
              const metadata = Object.entries(record.metadata);
              return (
                <li
                  className="audit-card"
                  key={`${record.correlationReference}-${record.occurredAtUtc}-${record.operation}-${record.entityReference}-${recordIndex}`}
                >
                  <div className="audit-card__heading">
                    <div>
                      <p className="activity-category">{record.actorType}</p>
                      <h3>{record.operation}</h3>
                    </div>
                    <span
                      className={`status-chip ${
                        record.outcome === "Failure"
                          ? "status-chip--danger"
                          : "status-chip--success"
                      }`}
                    >
                      {record.outcome}
                    </span>
                  </div>
                  <dl className="audit-card__facts">
                    <div>
                      <dt>{t("Entity type")}</dt>
                      <dd>{record.entityType}</dd>
                    </div>
                    <div>
                      <dt>{t("Occurred (UTC)")}</dt>
                      <dd>
                        <time dateTime={record.occurredAtUtc}>
                          {formatters.utcTimestamp(record.occurredAtUtc)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                  <details className="technical-details audit-card__technical">
                    <summary>{t("Technical evidence")}</summary>
                    <dl>
                      <div>
                        <dt>{t("Actor reference")}</dt>
                        <dd>
                          <code>{record.actorUserReference}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>{t("Entity reference")}</dt>
                        <dd>
                          <code>{record.entityReference}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>{t("Correlation reference")}</dt>
                        <dd>
                          <code>{record.correlationReference}</code>
                        </dd>
                      </div>
                    </dl>
                    {metadata.length > 0 ? (
                      <div className="audit-metadata">
                        <h4>{t("Backend metadata")}</h4>
                        <dl>
                          {metadata.map(([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : (
                      <p>{t("No additional backend metadata was returned.")}</p>
                    )}
                  </details>
                </li>
              );
            })}
          </ol>
          {loadMoreError ? (
            <p className="error-banner" role="alert">
              {loadMoreError}
            </p>
          ) : null}
          <div className="timeline-actions">
            {hasMore ? (
              <Button
                className="button button--secondary"
                isDisabled={isLoadingMore}
                onPress={onLoadMore}
              >
                {isLoadingMore
                  ? t("Loading more…")
                  : t("Load more audit records")}
              </Button>
            ) : (
              <p className="timeline-end">
                {t("You have reached the end of these backend audit results.")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
