import { useMemo } from "react";
import {
  usePreferences,
  type PortalClockFormat,
  type PortalLanguage,
} from "../preferences/preferences";

/**
 * Dates read in the reader's language, money keeps the grouping the finance
 * screens were built against, and the clock follows the explicit preference
 * rather than whatever the locale happens to imply. A Turkish reader who works
 * against an American parent company can ask for a 12-hour clock and still see
 * Turkish month names.
 *
 * Two families, and which one a screen reaches for is not a style choice.
 *
 * The plain ones render in the reader's own zone, which is what somebody wants
 * when they are looking at when a card expires or when a delivery went out.
 *
 * The `utc*` ones pin to UTC and are for rows the backend both records and
 * filters in UTC. Those screens label their date filters "(UTC)", so rendering
 * their rows in local time would put a row outside the range that selected it
 * — and would give two investigators reading the same audit record two
 * different timestamps. The reader's language and clock still apply; only the
 * zone is fixed. Any column formatted this way carries "(UTC)" in its heading.
 */
function dateLocale(language: PortalLanguage): string {
  return language === "tr" ? "tr-TR" : "en-GB";
}

function numberLocale(language: PortalLanguage): string {
  return language === "tr" ? "tr-TR" : "en-US";
}

export interface PortalFormatters {
  /** Date and time in the reader's zone, e.g. "12 Aug 2026, 14:05". */
  dateTime: (value: string | number | Date) => string;
  /** Date only in the reader's zone, e.g. "12 Aug 2026". */
  date: (value: string | number | Date) => string;
  /** Time only in the reader's zone, e.g. "14:05". */
  time: (value: string | number | Date) => string;
  /** Date and time pinned to UTC, for a column headed "(UTC)". */
  utcDateTime: (value: string | number | Date) => string;
  /** Date only pinned to UTC, for a column headed "(UTC)". */
  utcDate: (value: string | number | Date) => string;
  /** UTC to the second, for audit evidence ordered within a minute. */
  utcTimestamp: (value: string | number | Date) => string;
  /** An amount with its ISO code, e.g. "TRY 250.00". */
  money: (amount: number, currency: string) => string;
  /** A plain grouped number, e.g. "2,000". */
  number: (value: number) => string;
}

export function createFormatters(
  language: PortalLanguage,
  clock: PortalClockFormat,
): PortalFormatters {
  const dates = dateLocale(language);
  const numbers = numberLocale(language);
  const hour12 = clock === "12h";

  const dateTimeFormat = new Intl.DateTimeFormat(dates, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12,
  });
  const dateFormat = new Intl.DateTimeFormat(dates, { dateStyle: "medium" });
  const timeFormat = new Intl.DateTimeFormat(dates, {
    timeStyle: "short",
    hour12,
  });
  const utcDateTimeFormat = new Intl.DateTimeFormat(dates, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
    hour12,
  });
  const utcDateFormat = new Intl.DateTimeFormat(dates, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const utcTimestampFormat = new Intl.DateTimeFormat(dates, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
    hour12,
  });
  const numberFormat = new Intl.NumberFormat(numbers);
  const decimalFormat = new Intl.NumberFormat(numbers, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function toDate(value: string | number | Date): Date | undefined {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  function using(format: Intl.DateTimeFormat) {
    return (value: string | number | Date) => {
      const date = toDate(value);
      return date ? format.format(date) : "—";
    };
  }

  return {
    dateTime: using(dateTimeFormat),
    date: using(dateFormat),
    time: using(timeFormat),
    utcDateTime: using(utcDateTimeFormat),
    utcDate: using(utcDateFormat),
    utcTimestamp: using(utcTimestampFormat),
    money: (amount, currency) => {
      try {
        return new Intl.NumberFormat(numbers, {
          style: "currency",
          currency,
          currencyDisplay: "code",
        }).format(amount);
      } catch {
        // An unknown or malformed ISO code reaches this, and the amount still
        // has to be readable next to whatever the backend called the currency.
        return `${currency} ${decimalFormat.format(amount)}`;
      }
    },
    number: (value) => numberFormat.format(value),
  };
}

export function useFormatters(): PortalFormatters {
  const { language, clock } = usePreferences();
  return useMemo(() => createFormatters(language, clock), [language, clock]);
}
