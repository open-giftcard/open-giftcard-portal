import { newIdentifier } from "../../identifiers";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Label, TextArea, TextField } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import type {
  PortalGiftCard,
  PortalGiftCardLifecycleAction,
  PortalGiftCardLifecycleDetail as LifecycleDetail,
  PortalGiftCardLifecycleEvent,
} from "../../types";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";

export interface GiftCardLifecycleIntent {
  giftCardId: string;
  action: PortalGiftCardLifecycleAction;
  reason: string;
  operationId: string;
}

interface GiftCardLifecycleDetailProps {
  organizationName: string;
  selectedCard: PortalGiftCard;
  detail?: LifecycleDetail;
  completedEvent?: PortalGiftCardLifecycleEvent;
  hasManagePermission: boolean;
  isLoading: boolean;
  isRunning: boolean;
  errorMessage?: string;
  actionError?: string;
  onBack: () => void;
  onRetry: () => void;
  onRun: (intent: GiftCardLifecycleIntent) => void;
}

function actionLabels(
  t: Translator,
): Record<PortalGiftCardLifecycleAction, string> {
  return {
    suspend: t("Suspend"),
    reactivate: t("Reactivate"),
    cancel: t("Cancel"),
    expire: t("Finalize expiry"),
  };
}

function formatState(value: string): string {
  return value.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
}

function availableActions(
  card: PortalGiftCard,
): PortalGiftCardLifecycleAction[] {
  const actions: PortalGiftCardLifecycleAction[] = [];
  const isTerminal =
    card.lifecycleState === "Cancelled" || card.lifecycleState === "Expired";

  if (card.lifecycleState === "Suspended") {
    actions.push("reactivate");
  } else if (
    card.lifecycleState === "Active" ||
    card.lifecycleState === "AwaitingClaim"
  ) {
    actions.push("suspend");
  }

  if (!isTerminal && card.ownershipState !== "IdentityOwned") {
    actions.push("cancel");
  }
  if (!isTerminal && Date.parse(card.expiresAtUtc) <= Date.now()) {
    actions.push("expire");
  }

  return actions;
}

function isTerminalAction(action: PortalGiftCardLifecycleAction): boolean {
  return action === "cancel" || action === "expire";
}

export function GiftCardLifecycleDetail({
  organizationName,
  selectedCard,
  detail,
  completedEvent,
  hasManagePermission,
  isLoading,
  isRunning,
  errorMessage,
  actionError,
  onBack,
  onRetry,
  onRun,
}: GiftCardLifecycleDetailProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const labels = actionLabels(t);
  const [draftAction, setDraftAction] =
    useState<PortalGiftCardLifecycleAction>();
  const [reason, setReason] = useState("");
  const [intent, setIntent] = useState<GiftCardLifecycleIntent>();

  useEffect(() => {
    if (completedEvent) {
      setDraftAction(undefined);
      setReason("");
      setIntent(undefined);
    }
  }, [completedEvent]);

  const card = detail?.giftCard ?? selectedCard;
  const actions = availableActions(card);

  function reviewAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftAction || !reason.trim()) {
      return;
    }

    setIntent({
      giftCardId: card.id,
      action: draftAction,
      reason: reason.trim(),
      operationId: newIdentifier(),
    });
  }

  return (
    <section className="gift-card-detail" aria-labelledby="card-detail-title">
      <Button className="text-button detail-back" onPress={onBack}>
        ← {t("Back to inventory")}
      </Button>

      {isLoading && !detail ? (
        <LoadingPanel label={t("Loading gift card detail…")} />
      ) : errorMessage && !detail ? (
        <StatusPanel
          title={t("Gift card detail could not be loaded")}
          headingLevel={2}
          actionLabel={t("Try again")}
          onAction={onRetry}
        >
          {errorMessage}
        </StatusPanel>
      ) : (
        <>
          <div className="gift-card-detail__hero">
            <div>
              <p className="card-kicker">{t("Gift card detail")}</p>
              <p className="gift-card-reference">{card.publicReference}</p>
              <h2 id="card-detail-title" className="section-title">
                {card.businessReference}
              </h2>
              <p className="supporting-copy">
                {t(
                  "Current backend detail for {organization}. The public reference is not a payment credential.",
                  { organization: organizationName },
                )}
              </p>
            </div>
            <span className="status-chip">
              {formatState(card.lifecycleState)}
            </span>
          </div>

          {errorMessage ? (
            <div className="detail-refresh-error" role="alert">
              <p>{errorMessage}</p>
              <Button className="text-button" onPress={onRetry}>
                {t("Refresh detail")}
              </Button>
            </div>
          ) : null}

          <dl className="gift-card-detail__facts">
            <div>
              <dt>{t("Funded amount")}</dt>
              <dd>{formatters.money(card.fundedAmount, card.currency)}</dd>
            </div>
            <div>
              <dt>{t("Ownership")}</dt>
              <dd>{formatState(card.ownershipState)}</dd>
            </div>
            <div>
              <dt>{t("Valid from")}</dt>
              <dd>
                <time dateTime={card.validFromUtc}>
                  {formatters.dateTime(card.validFromUtc)}
                </time>
              </dd>
            </div>
            <div>
              <dt>{t("Expires")}</dt>
              <dd>
                <time dateTime={card.expiresAtUtc}>
                  {formatters.dateTime(card.expiresAtUtc)}
                </time>
              </dd>
            </div>
            <div>
              <dt>{t("Capabilities")}</dt>
              <dd>
                {card.isTransferable
                  ? t("Transferable")
                  : t("Not transferable")}
                {" · "}
                {card.isDivisible ? t("Divisible") : t("Not divisible")}
              </dd>
            </div>
            <div>
              <dt>{t("Issued")}</dt>
              <dd>
                <time dateTime={card.issuedAtUtc}>
                  {formatters.dateTime(card.issuedAtUtc)}
                </time>
              </dd>
            </div>
          </dl>

          {completedEvent ? (
            <p className="success-banner" role="status">
              {t("{action} completed: {from} → {to}.", {
                action:
                  labels[
                    completedEvent.action.toLowerCase() as PortalGiftCardLifecycleAction
                  ] ?? completedEvent.action,
                from: formatState(completedEvent.previousState),
                to: formatState(completedEvent.newState),
              })}
              {completedEvent.returnedAmount !== null && completedEvent.currency
                ? ` ${t("The backend returned {amount}.", {
                    amount: formatters.money(
                      completedEvent.returnedAmount,
                      completedEvent.currency,
                    ),
                  })}`
                : null}
            </p>
          ) : null}

          <div className="gift-card-detail__columns">
            <section
              className="lifecycle-controls"
              aria-labelledby="lifecycle-controls-title"
            >
              <p className="card-kicker">{t("Lifecycle controls")}</p>
              <h3 id="lifecycle-controls-title">{t("Manage current state")}</h3>
              <p className="supporting-copy">
                {t(
                  "The backend decides whether an action is valid using its current state, server clock, ownership, permissions, and financial rules.",
                )}
              </p>

              {!hasManagePermission ? (
                <p className="permission-note">
                  {t(
                    "Your role can view lifecycle detail but cannot change it.",
                  )}
                </p>
              ) : intent ? (
                <div
                  className={`lifecycle-review ${
                    isTerminalAction(intent.action)
                      ? "lifecycle-review--terminal"
                      : ""
                  }`}
                  role="region"
                  aria-label={t("Review lifecycle action")}
                >
                  <h4>
                    {t("Confirm {action}", {
                      action: labels[intent.action].toLowerCase(),
                    })}
                  </h4>
                  <dl>
                    <div>
                      <dt>{t("Organization")}</dt>
                      <dd>{organizationName}</dd>
                    </div>
                    <div>
                      <dt>{t("Card")}</dt>
                      <dd>{card.publicReference}</dd>
                    </div>
                    <div>
                      <dt>{t("Current state")}</dt>
                      <dd>{formatState(card.lifecycleState)}</dd>
                    </div>
                    <div>
                      <dt>{t("Action")}</dt>
                      <dd>{labels[intent.action]}</dd>
                    </div>
                    <div>
                      <dt>{t("Reason")}</dt>
                      <dd>{intent.reason}</dd>
                    </div>
                  </dl>
                  {isTerminalAction(intent.action) ? (
                    <p className="terminal-warning">
                      {t(
                        "This action is terminal. The backend will close any pending activation and return the exact remaining ledger-derived value at most once when applicable.",
                      )}
                    </p>
                  ) : (
                    <p>
                      {t(
                        "This changes lifecycle state but does not move card value.",
                      )}
                    </p>
                  )}
                  {actionError ? (
                    <p className="error-banner" role="alert">
                      {actionError}
                    </p>
                  ) : null}
                  <div className="action-row">
                    <Button
                      className={
                        isTerminalAction(intent.action)
                          ? "button button--danger"
                          : "button button--primary"
                      }
                      isDisabled={isRunning}
                      onPress={() => {
                        onRun(intent);
                      }}
                    >
                      {isRunning
                        ? t("Applying…")
                        : t("Confirm {action}", {
                            action: labels[intent.action].toLowerCase(),
                          })}
                    </Button>
                    <Button
                      className="button button--secondary"
                      isDisabled={isRunning}
                      onPress={() => {
                        setIntent(undefined);
                      }}
                    >
                      {t("Back")}
                    </Button>
                  </div>
                </div>
              ) : draftAction ? (
                <form className="lifecycle-reason-form" onSubmit={reviewAction}>
                  <div className="lifecycle-action-heading">
                    <div>
                      <p className="card-kicker">{t("Selected action")}</p>
                      <h4>{labels[draftAction]}</h4>
                    </div>
                    <Button
                      className="text-button"
                      onPress={() => {
                        setDraftAction(undefined);
                        setReason("");
                      }}
                    >
                      {t("Choose another")}
                    </Button>
                  </div>
                  {isTerminalAction(draftAction) ? (
                    <p className="terminal-warning">
                      {t(
                        "Cancellation and expiration cannot be undone and may return remaining value through a compensating Ledger operation.",
                      )}
                    </p>
                  ) : null}
                  <TextField
                    className="field"
                    isRequired
                    value={reason}
                    onChange={setReason}
                  >
                    <Label className="field__label">{t("Reason")}</Label>
                    <TextArea
                      className="field__input field__textarea"
                      placeholder={t(
                        "Explain why this lifecycle change is needed",
                      )}
                    />
                  </TextField>
                  <Button
                    className="button button--primary"
                    type="submit"
                    isDisabled={!reason.trim()}
                  >
                    {t("Review action")}
                  </Button>
                </form>
              ) : actions.length === 0 ? (
                <p className="permission-note">
                  {t(
                    "No lifecycle action is currently suggested for this card. Refresh detail if its state changed elsewhere.",
                  )}
                </p>
              ) : (
                <div className="lifecycle-action-list">
                  {actions.map((action) => (
                    <Button
                      className={
                        isTerminalAction(action)
                          ? "button button--danger-outline"
                          : "button button--secondary"
                      }
                      key={action}
                      onPress={() => {
                        setDraftAction(action);
                        setReason("");
                      }}
                    >
                      {labels[action]}
                    </Button>
                  ))}
                </div>
              )}
            </section>

            <section
              className="lifecycle-history"
              aria-labelledby="lifecycle-history-title"
            >
              <p className="card-kicker">{t("Immutable history")}</p>
              <h3 id="lifecycle-history-title">{t("Lifecycle events")}</h3>
              {!detail?.events.length ? (
                <p className="timeline-end">
                  {t("No lifecycle changes have been recorded for this card.")}
                </p>
              ) : (
                <ol>
                  {detail.events.map((event, index) => (
                    <li key={`${event.occurredAtUtc}-${event.action}-${index}`}>
                      <div className="lifecycle-event__heading">
                        <h4>{event.action}</h4>
                        <time dateTime={event.occurredAtUtc}>
                          {formatters.dateTime(event.occurredAtUtc)}
                        </time>
                      </div>
                      <p>
                        {formatState(event.previousState)} →{" "}
                        {formatState(event.newState)}
                      </p>
                      <p>{event.reason}</p>
                      {event.returnedAmount !== null && event.currency ? (
                        <p className="lifecycle-return">
                          {t("Backend value return: {amount}", {
                            amount: formatters.money(
                              event.returnedAmount,
                              event.currency,
                            ),
                          })}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
