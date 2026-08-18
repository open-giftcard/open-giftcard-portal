import { newIdentifier } from "../../identifiers";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  TextField,
} from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";
import type { PortalGiftCard } from "../../types";
import { BulkGiftCardBatch } from "./BulkGiftCardBatch";
import { GiftCardDistribution } from "./GiftCardDistribution";
import { GiftCardLifecycleDetail } from "./GiftCardLifecycleDetail";

interface GiftCardIssuanceIntent {
  amount: string;
  currency: string;
  validFromUtc?: string;
  expiresAtUtc: string;
  isTransferable: boolean;
  isDivisible: boolean;
  businessReference: string;
  operationId: string;
}

interface GiftCardWorkspaceProps {
  organizationName: string;
  cards: PortalGiftCard[];
  issuedCard?: PortalGiftCard;
  hasViewPermission: boolean;
  hasIssuePermission: boolean;
  hasDistributePermission: boolean;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isIssuing: boolean;
  inventoryError?: string;
  loadMoreError?: string;
  issuanceError?: string;
  lifecycle?: React.ComponentProps<typeof GiftCardLifecycleDetail>;
  distribution?: React.ComponentProps<typeof GiftCardDistribution>;
  bulkBatch: React.ComponentProps<typeof BulkGiftCardBatch>;
  onRetry: () => void;
  onLoadMore: () => void;
  onOpenCard: (giftCardId: string) => void;
  onDistributeCard: (card: PortalGiftCard) => void;
  onIssue: (intent: GiftCardIssuanceIntent) => void;
}

function formatState(value: string): string {
  return value.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
}

function datePart(value: string): string {
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function timePart(value: string): string {
  return value.match(/[T ](\d{2}:\d{2})/)?.[1] ?? "";
}

function withDate(value: string, date: string): string {
  const time = timePart(value);
  return date && time ? `${date}T${time}` : date;
}

function withTime(value: string, time: string): string {
  const date = datePart(value);
  return date && time ? `${date}T${time}` : date;
}

function localDateTimeToIso(
  value: string,
  defaultTime: "00:00" | "23:59",
): string | undefined {
  if (!value) {
    return undefined;
  }

  const localValue = timePart(value)
    ? value
    : `${datePart(value)}T${defaultTime}`;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function GiftCardWorkspace({
  organizationName,
  cards,
  issuedCard,
  hasViewPermission,
  hasIssuePermission,
  hasDistributePermission,
  hasMore,
  isLoading,
  isLoadingMore,
  isIssuing,
  inventoryError,
  loadMoreError,
  issuanceError,
  lifecycle,
  distribution,
  bulkBatch,
  onRetry,
  onLoadMore,
  onOpenCard,
  onDistributeCard,
  onIssue,
}: GiftCardWorkspaceProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [validFrom, setValidFrom] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isTransferable, setIsTransferable] = useState(false);
  const [isDivisible, setIsDivisible] = useState(false);
  const [businessReference, setBusinessReference] = useState("");
  const [intent, setIntent] = useState<GiftCardIssuanceIntent>();

  useEffect(() => {
    if (issuedCard) {
      setAmount("");
      setCurrency("TRY");
      setValidFrom("");
      setExpiresAt("");
      setIsTransferable(false);
      setIsDivisible(false);
      setBusinessReference("");
      setIntent(undefined);
    }
  }, [issuedCard]);

  function reviewIssuance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validFromUtc = localDateTimeToIso(validFrom, "00:00");
    const expiresAtUtc = localDateTimeToIso(expiresAt, "23:59");
    const nextIntent = {
      amount: amount.trim(),
      currency: currency.trim().toUpperCase(),
      validFromUtc,
      expiresAtUtc: expiresAtUtc ?? "",
      isTransferable,
      isDivisible,
      businessReference: businessReference.trim(),
      operationId: newIdentifier(),
    };

    if (
      nextIntent.amount &&
      nextIntent.currency &&
      nextIntent.expiresAtUtc &&
      nextIntent.businessReference &&
      (!validFrom || validFromUtc)
    ) {
      setIntent(nextIntent);
    }
  }

  if (!hasViewPermission && !hasIssuePermission && !hasDistributePermission) {
    return (
      <section className="finance-unavailable" aria-label={t("Gift cards")}>
        <StatusPanel
          title={t("Gift card workspace access is unavailable")}
          headingLevel={2}
        >
          {t(
            "Your role does not include card inventory or issuance. Ask an organization administrator if you need this workspace.",
          )}
        </StatusPanel>
      </section>
    );
  }

  if (lifecycle) {
    return (
      <div className="cards-workspace">
        <GiftCardLifecycleDetail {...lifecycle} />
      </div>
    );
  }

  if (distribution) {
    return (
      <div className="cards-workspace">
        <GiftCardDistribution {...distribution} />
      </div>
    );
  }

  return (
    <div className="cards-workspace">
      <section aria-labelledby="inventory-title">
        <div className="section-heading">
          <div>
            <p className="card-kicker">{t("Gift card inventory")}</p>
            <h2 id="inventory-title" className="section-title">
              {t("Organization-owned cards")}
            </h2>
            <p className="supporting-copy">
              {t(
                "Newest-first inventory returned for {organization}. Public references are for display and support, not payment credentials.",
                { organization: organizationName },
              )}
            </p>
          </div>
        </div>

        {!hasViewPermission ? (
          <div className="cards-state">
            <StatusPanel
              title={t("Card inventory is unavailable")}
              headingLevel={3}
            >
              {t(
                "Your role can issue cards but does not include inventory viewing. The backend continues to enforce this boundary.",
              )}
            </StatusPanel>
          </div>
        ) : isLoading ? (
          <div className="cards-state">
            <LoadingPanel label={t("Loading gift card inventory…")} />
          </div>
        ) : inventoryError ? (
          <div className="cards-state">
            <StatusPanel
              title={t("Card inventory could not be loaded")}
              headingLevel={3}
              actionLabel={t("Try again")}
              onAction={onRetry}
            >
              {inventoryError}
            </StatusPanel>
          </div>
        ) : cards.length === 0 ? (
          <div className="cards-state">
            <StatusPanel title={t("No cards in inventory")} headingLevel={3}>
              {t("This organization does not currently own any gift cards.")}
            </StatusPanel>
          </div>
        ) : (
          <>
            <ol className="gift-card-grid">
              {cards.map((card) => (
                <li className="gift-card-card" key={card.id}>
                  <div className="gift-card-card__heading">
                    <div>
                      <p className="gift-card-reference">
                        {card.publicReference}
                      </p>
                      <h3>{card.businessReference}</h3>
                    </div>
                    <span className="status-chip">
                      {formatState(card.lifecycleState)}
                    </span>
                  </div>
                  <p className="gift-card-amount">
                    {formatters.money(card.fundedAmount, card.currency)}
                  </p>
                  <dl className="gift-card-facts">
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
                  <div className="gift-card-card__actions">
                    <Button
                      className="button button--secondary"
                      onPress={() => {
                        onOpenCard(card.id);
                      }}
                    >
                      {t("View lifecycle")}
                    </Button>
                    {hasDistributePermission &&
                    card.ownershipState === "OrganizationInventory" &&
                    card.lifecycleState === "Active" ? (
                      <Button
                        className="button button--primary"
                        onPress={() => {
                          onDistributeCard(card);
                        }}
                      >
                        {t("Send to recipient")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            {loadMoreError ? (
              <div className="pagination-error" role="alert">
                <p>{loadMoreError}</p>
                <Button
                  className="button button--secondary"
                  onPress={onLoadMore}
                >
                  {t("Try loading more again")}
                </Button>
              </div>
            ) : null}
            {hasMore ? (
              <div className="load-more">
                <Button
                  className="button button--secondary"
                  isDisabled={isLoadingMore}
                  onPress={onLoadMore}
                >
                  {isLoadingMore ? t("Loading…") : t("Load more cards")}
                </Button>
              </div>
            ) : (
              <p className="timeline-end">
                {t("You have reached the end of this inventory.")}
              </p>
            )}
          </>
        )}
      </section>

      {hasIssuePermission ? (
        <section className="card-issuance" aria-labelledby="issue-title">
          <div>
            <p className="card-kicker">{t("Ledger-funded issuance")}</p>
            <h2 id="issue-title" className="section-title">
              {t("Issue a gift card")}
            </h2>
            <p className="supporting-copy supporting-copy--wide">
              {t(
                "The backend verifies funding, tenant scope, permissions, validity, currency, ownership, ledger posting, and audit.",
              )}
            </p>
          </div>

          {issuedCard ? (
            <p className="success-banner" role="status">
              {t("{reference} was issued to {organization} for {amount}.", {
                reference: issuedCard.publicReference,
                organization: organizationName,
                amount: formatters.money(
                  issuedCard.fundedAmount,
                  issuedCard.currency,
                ),
              })}
            </p>
          ) : null}
          {issuanceError ? (
            <p className="error-banner" role="alert">
              {issuanceError}
            </p>
          ) : null}

          {intent ? (
            <div
              className="card-issuance-review"
              role="region"
              aria-label={t("Review gift card issuance")}
            >
              <h3>{t("Confirm issuance")}</h3>
              <dl>
                <div>
                  <dt>{t("Organization")}</dt>
                  <dd>{organizationName}</dd>
                </div>
                <div>
                  <dt>{t("Amount")}</dt>
                  <dd>
                    {intent.currency} {intent.amount}
                  </dd>
                </div>
                <div>
                  <dt>{t("Business reference")}</dt>
                  <dd>{intent.businessReference}</dd>
                </div>
                <div>
                  <dt>{t("Valid from")}</dt>
                  <dd>
                    {intent.validFromUtc
                      ? formatters.dateTime(intent.validFromUtc)
                      : t("Backend posting time")}
                  </dd>
                </div>
                <div>
                  <dt>{t("Expires")}</dt>
                  <dd>{formatters.dateTime(intent.expiresAtUtc)}</dd>
                </div>
                <div>
                  <dt>{t("Capabilities")}</dt>
                  <dd>
                    {intent.isTransferable
                      ? t("Transferable")
                      : t("Not transferable")}
                    {" · "}
                    {intent.isDivisible ? t("Divisible") : t("Not divisible")}
                  </dd>
                </div>
              </dl>
              <div className="action-row">
                <Button
                  className="button button--primary"
                  isDisabled={isIssuing}
                  onPress={() => {
                    onIssue(intent);
                  }}
                >
                  {isIssuing ? t("Issuing…") : t("Confirm issuance")}
                </Button>
                <Button
                  className="button button--secondary"
                  isDisabled={isIssuing}
                  onPress={() => {
                    setIntent(undefined);
                  }}
                >
                  {t("Back")}
                </Button>
              </div>
            </div>
          ) : (
            <form className="card-issuance-form" onSubmit={reviewIssuance}>
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
                  placeholder="250.00"
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
                value={datePart(validFrom)}
                onChange={(value) => {
                  setValidFrom(withDate(validFrom, value));
                }}
              >
                <Label className="field__label">
                  {t("Valid from date (optional)")}
                </Label>
                <Input className="field__input" type="date" />
              </TextField>
              <TextField
                className="field"
                value={timePart(validFrom)}
                onChange={(value) => {
                  setValidFrom(withTime(validFrom, value));
                }}
              >
                <Label className="field__label">
                  {t("Valid from time (optional; defaults to 00:00)")}
                </Label>
                <Input
                  className="field__input"
                  type="time"
                  disabled={!datePart(validFrom)}
                />
              </TextField>
              <TextField
                className="field"
                isRequired
                value={datePart(expiresAt)}
                onChange={(value) => {
                  setExpiresAt(withDate(expiresAt, value));
                }}
              >
                <Label className="field__label">{t("Expiry date")}</Label>
                <Input className="field__input" type="date" />
              </TextField>
              <TextField
                className="field"
                value={timePart(expiresAt)}
                onChange={(value) => {
                  setExpiresAt(withTime(expiresAt, value));
                }}
              >
                <Label className="field__label">
                  {t("Expiry time (optional; defaults to 23:59)")}
                </Label>
                <Input
                  className="field__input"
                  type="time"
                  disabled={!datePart(expiresAt)}
                />
              </TextField>
              <TextField
                className="field card-issuance-form__reference"
                isRequired
                value={businessReference}
                onChange={setBusinessReference}
              >
                <Label className="field__label">
                  {t("Business reference")}
                </Label>
                <Input
                  className="field__input"
                  placeholder={t("Award, campaign, or order reference")}
                />
              </TextField>
              <fieldset className="card-capabilities">
                <legend>{t("Card capabilities")}</legend>
                <Checkbox
                  className="card-checkbox"
                  isSelected={isTransferable}
                  onChange={setIsTransferable}
                >
                  <span className="card-checkbox__box" aria-hidden="true">
                    ✓
                  </span>
                  {t("Transferable")}
                </Checkbox>
                <Checkbox
                  className="card-checkbox"
                  isSelected={isDivisible}
                  onChange={setIsDivisible}
                >
                  <span className="card-checkbox__box" aria-hidden="true">
                    ✓
                  </span>
                  {t("Divisible")}
                </Checkbox>
              </fieldset>
              <Button
                className="button button--primary card-issuance-form__submit"
                type="submit"
                isDisabled={
                  !amount.trim() ||
                  !currency.trim() ||
                  !expiresAt ||
                  !businessReference.trim()
                }
              >
                {t("Review issuance")}
              </Button>
            </form>
          )}
        </section>
      ) : (
        <p className="permission-note">
          {t("Your role can view card inventory but cannot issue cards.")}
        </p>
      )}

      <BulkGiftCardBatch {...bulkBatch} />
    </div>
  );
}
