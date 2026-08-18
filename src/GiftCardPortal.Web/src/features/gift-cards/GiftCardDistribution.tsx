import { newIdentifier } from "../../identifiers";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import type {
  PortalGiftCard,
  PortalGiftCardDistribution as DistributionResult,
  PortalRecipientContactType,
} from "../../types";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";

export interface GiftCardDistributionIntent {
  giftCardId: string;
  contactType: PortalRecipientContactType;
  recipientContact: string;
  businessReference: string;
  operationId: string;
}

interface GiftCardDistributionProps {
  organizationName: string;
  card: PortalGiftCard;
  result?: DistributionResult;
  isSending: boolean;
  errorMessage?: string;
  onBack: () => void;
  onSend: (intent: GiftCardDistributionIntent) => void;
}

export function GiftCardDistribution({
  organizationName,
  card,
  result,
  isSending,
  errorMessage,
  onBack,
  onSend,
}: GiftCardDistributionProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [contactType, setContactType] =
    useState<PortalRecipientContactType>("email");
  const [recipientContact, setRecipientContact] = useState("");
  const [businessReference, setBusinessReference] = useState(
    card.businessReference,
  );
  const [intent, setIntent] = useState<GiftCardDistributionIntent>();

  useEffect(() => {
    if (result) {
      setRecipientContact("");
      setBusinessReference("");
      setIntent(undefined);
    }
  }, [result]);

  function reviewDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientContact.trim() || !businessReference.trim()) {
      return;
    }

    setIntent({
      giftCardId: card.id,
      contactType,
      recipientContact: recipientContact.trim(),
      businessReference: businessReference.trim(),
      operationId: newIdentifier(),
    });
  }

  return (
    <section
      className="gift-card-distribution"
      aria-labelledby="distribution-title"
    >
      <Button className="text-button detail-back" onPress={onBack}>
        ← {t("Back to inventory")}
      </Button>
      <div className="gift-card-distribution__hero">
        <div>
          <p className="card-kicker">{t("Recipient delivery")}</p>
          <p className="gift-card-reference">{card.publicReference}</p>
          <h2 id="distribution-title" className="section-title">
            {t("Send {reference}", { reference: card.businessReference })}
          </h2>
          <p className="supporting-copy">
            {t(
              "Deliver {amount} from {organization}. The backend changes ownership to awaiting claim; no card value moves.",
              {
                amount: formatters.money(card.fundedAmount, card.currency),
                organization: organizationName,
              },
            )}
          </p>
        </div>
      </div>

      {result ? (
        <div className="distribution-result" role="status">
          <p className="card-kicker">{t("Delivery created")}</p>
          <h3>{t("Invitation is awaiting claim")}</h3>
          <dl>
            <div>
              <dt>{t("Recipient")}</dt>
              <dd>{result.maskedRecipientContact}</dd>
            </div>
            <div>
              <dt>{t("Channel")}</dt>
              <dd>{result.contactType}</dd>
            </div>
            <div>
              <dt>{t("Business reference")}</dt>
              <dd>{result.businessReference}</dd>
            </div>
            <div>
              <dt>{t("Invitation state")}</dt>
              <dd>{result.state}</dd>
            </div>
            <div>
              <dt>{t("Claim expires")}</dt>
              <dd>
                <time dateTime={result.claimExpiresAtUtc}>
                  {formatters.dateTime(result.claimExpiresAtUtc)}
                </time>
              </dd>
            </div>
            <div>
              <dt>{t("Distributed")}</dt>
              <dd>
                <time dateTime={result.distributedAtUtc}>
                  {formatters.dateTime(result.distributedAtUtc)}
                </time>
              </dd>
            </div>
          </dl>
          <p className="privacy-note">
            {t(
              "Only the backend-masked recipient is retained in this portal view. Activation secrets are delivered outside the portal.",
            )}
          </p>
          <Button className="button button--secondary" onPress={onBack}>
            {t("Return to inventory")}
          </Button>
        </div>
      ) : intent ? (
        <div
          className="distribution-review"
          role="region"
          aria-label={t("Review recipient delivery")}
        >
          <p className="card-kicker">{t("Review delivery")}</p>
          <h3>{t("Confirm recipient and ownership change")}</h3>
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
              <dt>{t("Value")}</dt>
              <dd>{formatters.money(card.fundedAmount, card.currency)}</dd>
            </div>
            <div>
              <dt>{t("Channel")}</dt>
              <dd>
                {intent.contactType === "email" ? t("Email") : t("Phone")}
              </dd>
            </div>
            <div>
              <dt>{t("Recipient")}</dt>
              <dd>{intent.recipientContact}</dd>
            </div>
            <div>
              <dt>{t("Business reference")}</dt>
              <dd>{intent.businessReference}</dd>
            </div>
          </dl>
          <p className="ownership-warning">
            {t(
              "The card will leave organization inventory and wait for this recipient to claim it. This ownership-only operation does not move or recalculate value.",
            )}
          </p>
          {errorMessage ? (
            <p className="error-banner" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="action-row">
            <Button
              className="button button--primary"
              isDisabled={isSending}
              onPress={() => {
                onSend(intent);
              }}
            >
              {isSending ? t("Sending…") : t("Confirm delivery")}
            </Button>
            <Button
              className="button button--secondary"
              isDisabled={isSending}
              onPress={() => {
                setIntent(undefined);
              }}
            >
              {t("Back")}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="distribution-form"
          onSubmit={reviewDelivery}
          autoComplete="off"
        >
          <div className="field">
            <label className="field__label" htmlFor="recipient-channel">
              {t("Delivery channel")}
            </label>
            <select
              id="recipient-channel"
              className="field__input"
              value={contactType}
              onChange={(event) => {
                setContactType(
                  event.target.value as PortalRecipientContactType,
                );
                setRecipientContact("");
              }}
            >
              <option value="email">{t("Email")}</option>
              <option value="phone">{t("Phone")}</option>
            </select>
          </div>
          <TextField
            className="field"
            isRequired
            value={recipientContact}
            onChange={setRecipientContact}
          >
            <Label className="field__label">
              {contactType === "email"
                ? t("Recipient email")
                : t("Recipient phone (E.164)")}
            </Label>
            <Input
              className="field__input"
              type={contactType === "email" ? "email" : "tel"}
              placeholder={
                contactType === "email"
                  ? "recipient@example.com"
                  : "+905551234567"
              }
            />
          </TextField>
          <TextField
            className="field distribution-form__reference"
            isRequired
            value={businessReference}
            onChange={setBusinessReference}
          >
            <Label className="field__label">{t("Business reference")}</Label>
            <Input
              className="field__input"
              placeholder={t("Delivery, campaign, or award reference")}
            />
          </TextField>
          <p className="privacy-note distribution-form__privacy">
            {t(
              "The full contact is sent only to the backend after confirmation. The portal does not store it in browser or session storage.",
            )}
          </p>
          <Button
            className="button button--primary distribution-form__submit"
            type="submit"
            isDisabled={!recipientContact.trim() || !businessReference.trim()}
          >
            {t("Review delivery")}
          </Button>
        </form>
      )}
    </section>
  );
}
