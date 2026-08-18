import { useState } from "react";
import { Button, Radio, RadioGroup } from "react-aria-components";
import { useTranslation } from "../../i18n/translate";
import type { PortalOrganizationMembership, PortalUser } from "../../types";

interface OrganizationChooserProps {
  user: PortalUser;
  organizations: PortalOrganizationMembership[];
  isPending: boolean;
  errorMessage?: string;
  contextWasCleared: boolean;
  onSelect: (organizationId: string) => void;
  onLogout: () => void;
}

export function OrganizationChooser({
  user,
  organizations,
  isPending,
  errorMessage,
  contextWasCleared,
  onSelect,
  onLogout,
}: OrganizationChooserProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <main id="main-content" className="page-width context-layout">
      <section className="context-heading" aria-labelledby="organization-title">
        <p className="eyebrow">
          {t("Signed in as {email}", { email: user.email })}
        </p>
        <h1
          id="organization-title"
          className="display-title display-title--compact"
        >
          {t("Choose your organization")}
        </h1>
        <p className="supporting-copy supporting-copy--wide">
          {t(
            "Your selection sets the verified organization context for this session. You can change it later.",
          )}
        </p>
      </section>

      {contextWasCleared ? (
        <p className="notice" role="status">
          {t(
            "Your previous organization is no longer available. Choose another organization to continue.",
          )}
        </p>
      ) : null}

      <section className="organization-panel">
        <RadioGroup
          className="organization-grid"
          aria-label={t("Available organizations")}
          value={selectedId}
          onChange={setSelectedId}
          isDisabled={isPending}
        >
          {organizations.map(({ organization }) => (
            <Radio
              className="organization-card"
              value={organization.id}
              key={organization.id}
            >
              <span className="radio-indicator" aria-hidden="true" />
              <span className="organization-card__body">
                <span className="organization-card__name">
                  {organization.name}
                </span>
                <span className="organization-card__meta">
                  {t("Code {code}", { code: organization.code })}
                </span>
              </span>
              <span className="status-chip">{organization.status}</span>
            </Radio>
          ))}
        </RadioGroup>

        <div className="form-message" aria-live="polite">
          {errorMessage ? (
            <p className="error-banner" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="button-row">
          <Button
            className="button button--primary"
            isDisabled={!selectedId || isPending}
            onPress={() => {
              if (selectedId) {
                onSelect(selectedId);
              }
            }}
          >
            {isPending ? t("Verifying…") : t("Continue")}
          </Button>
          <Button className="button button--quiet" onPress={onLogout}>
            {t("Sign out")}
          </Button>
        </div>
      </section>
    </main>
  );
}
