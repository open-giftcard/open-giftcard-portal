import { Link } from "react-router";
import { useTranslation } from "../i18n/translate";
import { PortalSettings } from "./PortalSettings";

export function BrandHeader() {
  const { t } = useTranslation();

  return (
    <header className="brand-header">
      <div className="page-width brand-header__content">
        <Link
          className="brand-home-link"
          to="/"
          aria-label={t("Go to portal home")}
        >
          <img
            className="brand-logo"
            src="/logo.svg"
            alt="Gift Card Platform"
            width="148"
            height="40"
          />
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-product">{t("Gift Card Portal")}</span>
        </Link>
        <PortalSettings />
      </div>
    </header>
  );
}
