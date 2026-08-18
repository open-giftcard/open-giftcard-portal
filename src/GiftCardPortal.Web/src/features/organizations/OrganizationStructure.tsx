import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";
import { LoadingPanel, StatusPanel } from "../../components/StatusPanel";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation } from "../../i18n/translate";
import type { PortalSubsidiary, PortalSubsidiaryPage } from "../../types";

interface OrganizationStructureProps {
  page?: PortalSubsidiaryPage;
  createdSubsidiary?: PortalSubsidiary;
  hasViewPermission: boolean;
  hasCreatePermission: boolean;
  isLoading: boolean;
  isCreating: boolean;
  listError?: string;
  createError?: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onRetry: () => void;
  onCreate: (name: string, code: string) => void;
}

export function OrganizationStructure({
  page,
  createdSubsidiary,
  hasViewPermission,
  hasCreatePermission,
  isLoading,
  isCreating,
  listError,
  createError,
  onPreviousPage,
  onNextPage,
  onRetry,
  onCreate,
}: OrganizationStructureProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (createdSubsidiary) {
      setName("");
      setCode("");
    }
  }, [createdSubsidiary]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (trimmedName && trimmedCode) {
      onCreate(trimmedName, trimmedCode);
    }
  }

  if (!hasViewPermission && !hasCreatePermission) {
    return (
      <section
        className="finance-unavailable"
        aria-label={t("Organization structure")}
      >
        <StatusPanel
          title={t("Organization workspace access is unavailable")}
          headingLevel={2}
        >
          {t(
            "Your role does not include organization structure access. Ask an organization administrator if you need this workspace.",
          )}
        </StatusPanel>
      </section>
    );
  }

  const firstResult = page && page.items.length > 0 ? page.offset + 1 : 0;
  const lastResult = page ? page.offset + page.items.length : 0;

  return (
    <div className="structure-workspace">
      <section aria-labelledby="structure-title">
        <div className="section-heading">
          <div>
            <p className="card-kicker">{t("Organization structure")}</p>
            <h2 id="structure-title" className="section-title">
              {t("Direct subsidiaries")}
            </h2>
            <p className="supporting-copy">
              {t(
                "Direct children of the verified organization, in backend order.",
              )}
            </p>
          </div>
          {page && page.items.length > 0 ? (
            <p className="result-range" aria-live="polite">
              {t("Showing {from}–{to}", { from: firstResult, to: lastResult })}
            </p>
          ) : null}
        </div>

        {!hasViewPermission ? (
          <div className="structure-state">
            <StatusPanel
              title={t("Subsidiary listing is unavailable")}
              headingLevel={3}
            >
              {t(
                "Your role can create subsidiaries but does not include organization viewing. The backend continues to enforce this boundary.",
              )}
            </StatusPanel>
          </div>
        ) : isLoading ? (
          <div className="structure-state">
            <LoadingPanel label={t("Loading direct subsidiaries…")} />
          </div>
        ) : listError ? (
          <div className="structure-state">
            <StatusPanel
              title={t("Subsidiaries could not be loaded")}
              headingLevel={3}
              actionLabel={t("Try again")}
              onAction={onRetry}
            >
              {listError}
            </StatusPanel>
          </div>
        ) : !page?.items.length ? (
          <div className="structure-state">
            <StatusPanel title={t("No direct subsidiaries")} headingLevel={3}>
              {t(
                "This organization has no direct subsidiaries in the platform.",
              )}
            </StatusPanel>
          </div>
        ) : (
          <>
            <ul className="subsidiary-grid">
              {page.items.map((subsidiary) => (
                <li className="subsidiary-card" key={subsidiary.code}>
                  <div className="subsidiary-card__heading">
                    <div>
                      <p className="subsidiary-code">{subsidiary.code}</p>
                      <h3>{subsidiary.name}</h3>
                    </div>
                    <span className="status-chip">{subsidiary.status}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>{t("Relationship")}</dt>
                      <dd>{t("Direct subsidiary")}</dd>
                    </div>
                    <div>
                      <dt>{t("Added (UTC)")}</dt>
                      <dd>
                        <time dateTime={subsidiary.createdAtUtc}>
                          {formatters.utcDate(subsidiary.createdAtUtc)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="pagination" aria-label={t("Subsidiary pages")}>
              <Button
                className="button button--secondary"
                isDisabled={page.offset === 0}
                onPress={onPreviousPage}
              >
                {t("Previous")}
              </Button>
              <Button
                className="button button--secondary"
                isDisabled={!page.hasMore}
                onPress={onNextPage}
              >
                {t("Next")}
              </Button>
            </div>
          </>
        )}
      </section>

      {hasCreatePermission ? (
        <section className="subsidiary-create" aria-labelledby="create-title">
          <div>
            <p className="card-kicker">{t("Structure management")}</p>
            <h2 id="create-title" className="section-title">
              {t("Add a direct subsidiary")}
            </h2>
            <p className="supporting-copy">
              {t(
                "The backend verifies hierarchy depth, tenant scope, permissions, and code uniqueness.",
              )}
            </p>
          </div>

          {createdSubsidiary ? (
            <p className="success-banner" role="status">
              {t("{name} was created as a direct subsidiary.", {
                name: createdSubsidiary.name,
              })}
            </p>
          ) : null}
          {createError ? (
            <p className="error-banner" role="alert">
              {createError}
            </p>
          ) : null}

          <form className="subsidiary-form" onSubmit={submit}>
            <TextField
              className="field"
              isRequired
              value={name}
              onChange={setName}
            >
              <Label className="field__label">{t("Subsidiary name")}</Label>
              <Input
                className="field__input"
                placeholder={t("For example, North Retail")}
              />
            </TextField>
            <TextField
              className="field"
              isRequired
              value={code}
              onChange={setCode}
            >
              <Label className="field__label">{t("Subsidiary code")}</Label>
              <Input
                className="field__input"
                placeholder={t("For example, NORTH")}
              />
            </TextField>
            <Button
              className="button button--primary"
              type="submit"
              isDisabled={isCreating || !name.trim() || !code.trim()}
            >
              {isCreating ? t("Creating subsidiary…") : t("Create subsidiary")}
            </Button>
          </form>
        </section>
      ) : (
        <p className="permission-note">
          {t(
            "Your role can view the organization structure but cannot create subsidiaries.",
          )}
        </p>
      )}
    </div>
  );
}
