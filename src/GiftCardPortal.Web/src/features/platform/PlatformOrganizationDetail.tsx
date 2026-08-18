import { Button } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";
import type { PortalOrganization } from "../../types";

interface PlatformOrganizationDetailProps {
  organization?: PortalOrganization;
  isLoading: boolean;
  errorMessage?: string;
  onBack: () => void;
  onRetry: () => void;
}

export function PlatformOrganizationDetail({
  organization,
  isLoading,
  errorMessage,
  onBack,
  onRetry,
}: PlatformOrganizationDetailProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  return (
    <section
      className="platform-detail"
      aria-label={t("Customer details")}
      aria-busy={isLoading}
    >
      <Button className="button button--quiet detail-back" onPress={onBack}>
        ← {t("Back to customer directory")}
      </Button>

      {isLoading ? (
        <div className="directory-state">
          <LoadingPanel label={t("Loading customer details…")} />
        </div>
      ) : errorMessage ? (
        <div className="directory-state">
          <StatusPanel
            title={t("Customer details could not be loaded")}
            headingLevel={2}
            actionLabel={t("Try again")}
            onAction={onRetry}
          >
            {errorMessage}
          </StatusPanel>
        </div>
      ) : organization ? (
        <article className="platform-detail__card">
          <div className="platform-detail__heading">
            <div>
              <p className="card-kicker">{t("Platform customer record")}</p>
              <h2 id="platform-detail-title" className="section-title">
                {organization.name}
              </h2>
              <p className="supporting-copy">
                {t("Read directly from the platform organization service.")}
              </p>
            </div>
            <span className="status-chip">{organization.status}</span>
          </div>
          <dl className="platform-detail__facts">
            <div>
              <dt>{t("Customer code")}</dt>
              <dd>{organization.code}</dd>
            </div>
            <div>
              <dt>{t("Organization type")}</dt>
              <dd>
                {organization.depth === 0
                  ? t("Root customer")
                  : t("Hierarchy level {depth}", { depth: organization.depth })}
              </dd>
            </div>
            <div>
              <dt>{t("Added to platform (UTC)")}</dt>
              <dd>
                <time dateTime={organization.createdAtUtc}>
                  {formatters.utcDate(organization.createdAtUtc)}
                </time>
              </dd>
            </div>
          </dl>
          <p className="detail-boundary-note">
            {t(
              "Customer administration remains permission-protected. This view does not enter or impersonate the customer organization.",
            )}
          </p>
        </article>
      ) : null}
    </section>
  );
}
