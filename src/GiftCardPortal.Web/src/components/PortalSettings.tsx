import { useState } from "react";
import {
  Button,
  Dialog,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
} from "react-aria-components";
import { createFormatters } from "../i18n/formatters";
import { useTranslation } from "../i18n/translate";
import {
  usePreferences,
  type PortalClockFormat,
  type PortalLanguage,
  type PortalThemeChoice,
} from "../preferences/preferences";

/**
 * A fixed instant so the samples beside each choice show the difference between
 * the formats rather than the difference between two readings of the clock.
 * Afternoon on purpose: 09:05 looks the same on both clocks.
 */
const sampleInstant = new Date("2026-08-12T14:05:00Z");

interface SettingsOption<TValue> {
  value: TValue;
  label: string;
  hint: string;
}

export function PortalSettings() {
  const { t } = useTranslation();
  const { language, theme, clock, setLanguage, setTheme, setClock } =
    usePreferences();
  const [isOpen, setIsOpen] = useState(false);

  const languageOptions: SettingsOption<PortalLanguage>[] = [
    // Each language names itself. Somebody who has landed in a language they
    // cannot read needs to recognise their own, not read a translation of it.
    { value: "tr", label: "Türkçe", hint: t("Turkish") },
    { value: "en", label: "English", hint: t("English") },
  ];

  const themeOptions: SettingsOption<PortalThemeChoice>[] = [
    { value: "light", label: t("Light"), hint: t("Always the light palette.") },
    { value: "dark", label: t("Dark"), hint: t("Always the dark palette.") },
    {
      value: "system",
      label: t("Device"),
      hint: t("Follow the device appearance setting."),
    },
  ];

  const clockOptions: SettingsOption<PortalClockFormat>[] = (
    ["24h", "12h"] as const
  ).map((value) => ({
    value,
    label: value === "24h" ? t("24-hour") : t("12-hour (AM/PM)"),
    // The sample is built with the language currently selected, so switching
    // language updates both columns and the reader sees the real result.
    hint: createFormatters(language, value).dateTime(sampleInstant),
  }));

  return (
    <>
      <Button
        className="settings-trigger"
        onPress={() => {
          setIsOpen(true);
        }}
      >
        <span className="settings-trigger__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.7 7.7 0 0 0-1.8-1L14.9 3h-3.8l-.4 2.5a7.7 7.7 0 0 0-1.8 1l-2.3-1-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1c.55.42 1.16.76 1.8 1l.4 2.6h3.8l.4-2.6c.64-.24 1.25-.58 1.8-1l2.3 1 2-3.4-2-1.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {t("Settings")}
      </Button>

      <ModalOverlay
        className="settings-overlay"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
      >
        <Modal className="settings-modal">
          <Dialog className="settings-dialog" aria-label={t("Portal settings")}>
            <header className="settings-dialog__header">
              <div>
                <p className="card-kicker">{t("This browser only")}</p>
                <h2>{t("Settings")}</h2>
              </div>
              <Button
                className="text-button"
                onPress={() => {
                  setIsOpen(false);
                }}
              >
                {t("Close")}
              </Button>
            </header>

            <div className="settings-dialog__body">
              <RadioGroup
                className="settings-group"
                value={language}
                onChange={(value) => {
                  setLanguage(value as PortalLanguage);
                }}
              >
                <Label className="settings-group__label">{t("Language")}</Label>
                <div className="settings-group__options">
                  {languageOptions.map((option) => (
                    <Radio
                      key={option.value}
                      className="settings-option"
                      value={option.value}
                    >
                      <span
                        className="settings-option__mark"
                        aria-hidden="true"
                      />
                      <span className="settings-option__text">
                        <span className="settings-option__label">
                          {option.label}
                        </span>
                        <span className="settings-option__hint">
                          {option.hint}
                        </span>
                      </span>
                    </Radio>
                  ))}
                </div>
              </RadioGroup>

              <RadioGroup
                className="settings-group"
                value={theme}
                onChange={(value) => {
                  setTheme(value as PortalThemeChoice);
                }}
              >
                <Label className="settings-group__label">
                  {t("Appearance")}
                </Label>
                <div className="settings-group__options">
                  {themeOptions.map((option) => (
                    <Radio
                      key={option.value}
                      className="settings-option"
                      value={option.value}
                    >
                      <span
                        className="settings-option__mark"
                        aria-hidden="true"
                      />
                      <span className="settings-option__text">
                        <span className="settings-option__label">
                          {option.label}
                        </span>
                        <span className="settings-option__hint">
                          {option.hint}
                        </span>
                      </span>
                    </Radio>
                  ))}
                </div>
              </RadioGroup>

              <RadioGroup
                className="settings-group"
                value={clock}
                onChange={(value) => {
                  setClock(value as PortalClockFormat);
                }}
              >
                <Label className="settings-group__label">
                  {t("Date and time")}
                </Label>
                <div className="settings-group__options">
                  {clockOptions.map((option) => (
                    <Radio
                      key={option.value}
                      className="settings-option"
                      value={option.value}
                    >
                      <span
                        className="settings-option__mark"
                        aria-hidden="true"
                      />
                      <span className="settings-option__text">
                        <span className="settings-option__label">
                          {option.label}
                        </span>
                        <span className="settings-option__hint settings-option__hint--sample">
                          {option.hint}
                        </span>
                      </span>
                    </Radio>
                  ))}
                </div>
              </RadioGroup>

              <p className="privacy-note">
                {t(
                  "These choices are remembered in this browser only. They are not part of your account and are never sent to the backend.",
                )}
              </p>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
