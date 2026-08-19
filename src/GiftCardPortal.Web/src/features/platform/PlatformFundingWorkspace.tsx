import { newIdentifier } from "../../identifiers";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import type {
  PortalCorporateCreditAllocation,
  PortalCorporateCreditBalance,
  PortalCorporateCreditReversal,
} from "../../types";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";
import { defaultCurrency } from "../../config";

interface AllocationIntent {
  amount: string;
  currency: string;
  businessReference: string;
  operationId: string;
}

interface ReversalIntent {
  allocation: PortalCorporateCreditAllocation;
  reason: string;
  operationId: string;
}

interface PlatformFundingWorkspaceProps {
  customerName: string;
  balances?: PortalCorporateCreditBalance[];
  allocations: PortalCorporateCreditAllocation[];
  allocated?: PortalCorporateCreditAllocation;
  reversed?: PortalCorporateCreditReversal;
  hasViewPermission: boolean;
  hasAllocatePermission: boolean;
  hasReversePermission: boolean;
  hasMoreHistory: boolean;
  isLoadingBalances: boolean;
  isLoadingHistory: boolean;
  isLoadingMore: boolean;
  isAllocating: boolean;
  isReversing: boolean;
  balancesError?: string;
  historyError?: string;
  allocationError?: string;
  reversalError?: string;
  onRetryBalances: () => void;
  onRetryHistory: () => void;
  onLoadMore: () => void;
  onAllocate: (intent: AllocationIntent) => void;
  onReverse: (intent: ReversalIntent) => void;
}

export function PlatformFundingWorkspace({
  customerName,
  balances,
  allocations,
  allocated,
  reversed,
  hasViewPermission,
  hasAllocatePermission,
  hasReversePermission,
  hasMoreHistory,
  isLoadingBalances,
  isLoadingHistory,
  isLoadingMore,
  isAllocating,
  isReversing,
  balancesError,
  historyError,
  allocationError,
  reversalError,
  onRetryBalances,
  onRetryHistory,
  onLoadMore,
  onAllocate,
  onReverse,
}: PlatformFundingWorkspaceProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [businessReference, setBusinessReference] = useState("");
  const [allocationIntent, setAllocationIntent] = useState<AllocationIntent>();
  const [reversalAllocation, setReversalAllocation] =
    useState<PortalCorporateCreditAllocation>();
  const [reversalReason, setReversalReason] = useState("");
  const [reversalIntent, setReversalIntent] = useState<ReversalIntent>();

  useEffect(() => {
    if (allocated) {
      setAmount("");
      setCurrency(defaultCurrency);
      setBusinessReference("");
      setAllocationIntent(undefined);
    }
  }, [allocated]);

  useEffect(() => {
    if (reversed) {
      setReversalAllocation(undefined);
      setReversalReason("");
      setReversalIntent(undefined);
    }
  }, [reversed]);

  function reviewAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = {
      amount: amount.trim(),
      currency: currency.trim().toUpperCase(),
      businessReference: businessReference.trim(),
      operationId: newIdentifier(),
    };
    if (intent.amount && intent.currency && intent.businessReference) {
      setAllocationIntent(intent);
    }
  }

  function reviewReversal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reversalAllocation && reversalReason.trim()) {
      setReversalIntent({
        allocation: reversalAllocation,
        reason: reversalReason.trim(),
        operationId: newIdentifier(),
      });
    }
  }

  if (!hasViewPermission && !hasAllocatePermission && !hasReversePermission) {
    return null;
  }

  return (
    <section className="platform-funding" aria-labelledby="funding-title">
      <div className="section-heading">
        <div>
          <p className="card-kicker">{t("Funding operations")}</p>
          <h2 id="funding-title" className="section-title">
            {t("Corporate credit")}
          </h2>
          <p className="supporting-copy">
            {t(
              "Ledger-derived balances and immutable operations for {customer}.",
              { customer: customerName },
            )}
          </p>
        </div>
      </div>
      {reversed ? (
        <p className="success-banner" role="status">
          {t("{amount} was reversed.", {
            amount: formatters.money(reversed.amount, reversed.currency),
          })}
        </p>
      ) : null}

      {hasViewPermission ? (
        <div className="funding-read-grid">
          <section aria-labelledby="funding-balances-title">
            <h3 id="funding-balances-title">{t("Available balances")}</h3>
            {isLoadingBalances ? (
              <LoadingPanel label={t("Loading corporate-credit balances…")} />
            ) : balancesError ? (
              <StatusPanel
                title={t("Balances could not be loaded")}
                headingLevel={3}
                actionLabel={t("Try again")}
                onAction={onRetryBalances}
              >
                {balancesError}
              </StatusPanel>
            ) : !balances?.length ? (
              <p className="funding-empty">
                {t("No corporate credit is available.")}
              </p>
            ) : (
              <dl className="funding-balances">
                {balances.map((balance) => (
                  <div key={balance.currency}>
                    <dt>{balance.currency}</dt>
                    <dd>
                      {formatters.money(balance.amount, balance.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section aria-labelledby="funding-history-title">
            <h3 id="funding-history-title">{t("Allocation history")}</h3>
            {isLoadingHistory ? (
              <LoadingPanel label={t("Loading allocation history…")} />
            ) : historyError ? (
              <StatusPanel
                title={t("Allocation history could not be loaded")}
                headingLevel={3}
                actionLabel={t("Try again")}
                onAction={onRetryHistory}
              >
                {historyError}
              </StatusPanel>
            ) : allocations.length === 0 ? (
              <p className="funding-empty">
                {t("No allocations have been recorded.")}
              </p>
            ) : (
              <>
                <ol className="funding-history">
                  {allocations.map((allocation) => (
                    <li key={allocation.id}>
                      <div>
                        <strong>{allocation.businessReference}</strong>
                        <span>
                          {formatters.money(
                            allocation.amount,
                            allocation.currency,
                          )}
                        </span>
                        <time dateTime={allocation.allocatedAtUtc}>
                          {formatters.dateTime(allocation.allocatedAtUtc)}
                        </time>
                      </div>
                      {allocation.reversal ? (
                        <p className="funding-reversed">
                          {t("Reversed: {reason}", {
                            reason: allocation.reversal.reason,
                          })}
                        </p>
                      ) : hasReversePermission ? (
                        <Button
                          className="button button--quiet"
                          onPress={() => {
                            setReversalAllocation(allocation);
                            setReversalIntent(undefined);
                            setReversalReason("");
                          }}
                        >
                          {t("Review reversal")}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {hasMoreHistory ? (
                  <Button
                    className="button button--secondary"
                    isDisabled={isLoadingMore}
                    onPress={onLoadMore}
                  >
                    {isLoadingMore ? t("Loading…") : t("Load more allocations")}
                  </Button>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : (
        <p className="permission-note">
          {t(
            "Your role can perform a funding action but cannot view balances or history.",
          )}
        </p>
      )}

      {hasAllocatePermission ? (
        <section className="funding-action" aria-labelledby="allocate-title">
          <h3 id="allocate-title">{t("Allocate corporate credit")}</h3>
          {allocated ? (
            <p className="success-banner" role="status">
              {t("{amount} was allocated to {customer}.", {
                amount: formatters.money(allocated.amount, allocated.currency),
                customer: customerName,
              })}
            </p>
          ) : null}
          {allocationError ? (
            <p className="error-banner" role="alert">
              {allocationError}
            </p>
          ) : null}
          {allocationIntent ? (
            <div
              className="funding-review"
              role="region"
              aria-label={t("Review allocation")}
            >
              <p>
                {t("Confirm {currency} {amount} for {customer}, reference", {
                  currency: allocationIntent.currency,
                  amount: allocationIntent.amount,
                  customer: customerName,
                })}{" "}
                <strong>{allocationIntent.businessReference}</strong>.
              </p>
              <div className="action-row">
                <Button
                  className="button button--primary"
                  isDisabled={isAllocating}
                  onPress={() => {
                    onAllocate(allocationIntent);
                  }}
                >
                  {isAllocating ? t("Allocating…") : t("Confirm allocation")}
                </Button>
                <Button
                  className="button button--secondary"
                  isDisabled={isAllocating}
                  onPress={() => {
                    setAllocationIntent(undefined);
                  }}
                >
                  {t("Back")}
                </Button>
              </div>
            </div>
          ) : (
            <form className="funding-form" onSubmit={reviewAllocation}>
              <TextField
                className="field"
                isRequired
                value={amount}
                onChange={setAmount}
              >
                <Label className="field__label">{t("Amount")}</Label>
                <Input
                  className="field__input"
                  inputMode="decimal"
                  placeholder="1000.00"
                />
              </TextField>
              <TextField
                className="field"
                isRequired
                value={currency}
                onChange={setCurrency}
              >
                <Label className="field__label">{t("Currency")}</Label>
                <Input className="field__input" maxLength={3} />
              </TextField>
              <TextField
                className="field"
                isRequired
                value={businessReference}
                onChange={setBusinessReference}
              >
                <Label className="field__label">
                  {t("Business reference")}
                </Label>
                <Input
                  className="field__input"
                  placeholder={t("Contract or order reference")}
                />
              </TextField>
              <Button className="button button--primary" type="submit">
                {t("Review allocation")}
              </Button>
            </form>
          )}
        </section>
      ) : null}

      {reversalAllocation ? (
        <section
          className="funding-action funding-action--warning"
          aria-labelledby="reverse-title"
        >
          <h3 id="reverse-title">{t("Reverse allocation")}</h3>
          <p>
            {t(
              "This creates a full immutable compensating operation. The original allocation remains in history.",
            )}
          </p>
          {reversalError ? (
            <p className="error-banner" role="alert">
              {reversalError}
            </p>
          ) : null}
          {reversalIntent ? (
            <div
              className="funding-review"
              role="region"
              aria-label={t("Review reversal")}
            >
              <p>
                {t("Confirm full reversal of {amount} for {reference}.", {
                  amount: formatters.money(
                    reversalIntent.allocation.amount,
                    reversalIntent.allocation.currency,
                  ),
                  reference: reversalIntent.allocation.businessReference,
                })}{" "}
                {t("Reason:")} <strong>{reversalIntent.reason}</strong>.
              </p>
              <div className="action-row">
                <Button
                  className="button button--danger"
                  isDisabled={isReversing}
                  onPress={() => {
                    onReverse(reversalIntent);
                  }}
                >
                  {isReversing ? t("Reversing…") : t("Confirm full reversal")}
                </Button>
                <Button
                  className="button button--secondary"
                  isDisabled={isReversing}
                  onPress={() => {
                    setReversalIntent(undefined);
                  }}
                >
                  {t("Back")}
                </Button>
              </div>
            </div>
          ) : (
            <form className="funding-form" onSubmit={reviewReversal}>
              <TextField
                className="field"
                isRequired
                value={reversalReason}
                onChange={setReversalReason}
              >
                <Label className="field__label">{t("Reversal reason")}</Label>
                <Input
                  className="field__input"
                  placeholder={t("Why is this correction required?")}
                />
              </TextField>
              <Button className="button button--danger" type="submit">
                {t("Review full reversal")}
              </Button>
              <Button
                className="button button--secondary"
                onPress={() => {
                  setReversalAllocation(undefined);
                }}
              >
                {t("Cancel")}
              </Button>
            </form>
          )}
        </section>
      ) : null}
    </section>
  );
}
