import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type PortalLanguage = "tr" | "en";
export type PortalThemeChoice = "light" | "dark" | "system";
export type PortalResolvedTheme = "light" | "dark";
export type PortalClockFormat = "24h" | "12h";

export interface PortalPreferences {
  language: PortalLanguage;
  theme: PortalThemeChoice;
  clock: PortalClockFormat;
}

export const languages: PortalLanguage[] = ["tr", "en"];
export const themeChoices: PortalThemeChoice[] = ["light", "dark", "system"];
export const clockFormats: PortalClockFormat[] = ["24h", "12h"];

/** What a first-time visitor gets: Turkish, the device theme, a 24-hour clock. */
export const defaultPreferences: PortalPreferences = {
  language: "tr",
  theme: "system",
  clock: "24h",
};

/**
 * What a component gets when it is rendered outside the provider. English so a
 * screen exercised in isolation reads in its source language rather than
 * depending on the dictionary being complete for that screen.
 */
const unprovidedPreferences: PortalPreferences = {
  language: "en",
  theme: "system",
  clock: "24h",
};

/**
 * Preferences are the one thing this portal does keep in the browser. They are
 * not credentials and carry nothing about the organization or its recipients:
 * losing them to another user of the same machine reveals that somebody reads
 * Turkish. Sessions stay in the host-only cookie the BFF sets, and nothing
 * about them is written here.
 */
const storageKey = "giftcard.portal.preferences";

function isLanguage(value: unknown): value is PortalLanguage {
  return languages.includes(value as PortalLanguage);
}

function isThemeChoice(value: unknown): value is PortalThemeChoice {
  return themeChoices.includes(value as PortalThemeChoice);
}

function isClockFormat(value: unknown): value is PortalClockFormat {
  return clockFormats.includes(value as PortalClockFormat);
}

export function readStoredPreferences(): PortalPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultPreferences;
    }

    // Each field is validated on its own so a stale or hand-edited entry
    // degrades to the default for that one setting instead of discarding the
    // whole record.
    const stored = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return {
      language: isLanguage(stored.language)
        ? stored.language
        : defaultPreferences.language,
      theme: isThemeChoice(stored.theme)
        ? stored.theme
        : defaultPreferences.theme,
      clock: isClockFormat(stored.clock)
        ? stored.clock
        : defaultPreferences.clock,
    };
  } catch {
    return defaultPreferences;
  }
}

function writeStoredPreferences(preferences: PortalPreferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Private browsing and full storage both throw here. The choice still
    // applies for this visit; only remembering it fails.
  }
}

const darkQuery = "(prefers-color-scheme: dark)";

function subscribeToDeviceTheme(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const query = window.matchMedia(darkQuery);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function readDeviceTheme(): PortalResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia(darkQuery).matches ? "dark" : "light";
}

export interface PreferencesContextValue extends PortalPreferences {
  /** The theme actually painted, with "system" already resolved. */
  resolvedTheme: PortalResolvedTheme;
  setLanguage: (language: PortalLanguage) => void;
  setTheme: (theme: PortalThemeChoice) => void;
  setClock: (clock: PortalClockFormat) => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  ...unprovidedPreferences,
  resolvedTheme: "light",
  setLanguage: () => {},
  setTheme: () => {},
  setClock: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PortalPreferences>(
    readStoredPreferences,
  );
  const deviceTheme = useSyncExternalStore(
    subscribeToDeviceTheme,
    readDeviceTheme,
    () => "light" as const,
  );
  const resolvedTheme: PortalResolvedTheme =
    preferences.theme === "system" ? deviceTheme : preferences.theme;

  const update = useCallback((change: Partial<PortalPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...change };
      writeStoredPreferences(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    // Native controls — date pickers, selects, scrollbars — read this and
    // nothing else, so it has to be set alongside the attribute the
    // stylesheet reads.
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.lang = preferences.language;
  }, [preferences.language]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      resolvedTheme,
      setLanguage: (language) => {
        update({ language });
      },
      setTheme: (theme) => {
        update({ theme });
      },
      setClock: (clock) => {
        update({ clock });
      },
    }),
    [preferences, resolvedTheme, update],
  );

  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
