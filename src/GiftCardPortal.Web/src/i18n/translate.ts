import { useMemo } from "react";
import {
  usePreferences,
  type PortalLanguage,
} from "../preferences/preferences";
import { turkish } from "./turkish";

/**
 * The English sentence is the key.
 *
 * A retrofit onto a portal that already had thousands of written strings has
 * two options: invent an identifier for each one, or let the source sentence be
 * the identifier. Identifiers would mean a second artefact to keep honest and a
 * screen reading bulk.repair.status.problems instead of the sentence it
 * renders. Keying on the sentence keeps the screens readable, makes an
 * untranslated string fall back to correct English rather than to a key, and
 * means the dictionary can be diffed against the source at any time.
 *
 * The cost is that editing an English sentence orphans its translation, so
 * `turkish.test.ts` reads every screen and fails when a rendered phrase is
 * missing from the dictionary or when the dictionary keeps one no screen uses.
 */
export type TranslationValues = Record<string, string | number>;

const placeholder = /\{(\w+)\}/g;

export function interpolate(
  template: string,
  values?: TranslationValues,
): string {
  if (!values) {
    return template;
  }
  return template.replace(placeholder, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  language: PortalLanguage,
  text: string,
  values?: TranslationValues,
): string {
  const template = language === "tr" ? (turkish[text] ?? text) : text;
  return interpolate(template, values);
}

export type Translator = (text: string, values?: TranslationValues) => string;

export interface TranslationTools {
  t: Translator;
  language: PortalLanguage;
}

export function useTranslation(): TranslationTools {
  const { language } = usePreferences();
  return useMemo(
    () => ({
      language,
      t: (text: string, values?: TranslationValues) =>
        translate(language, text, values),
    }),
    [language],
  );
}
