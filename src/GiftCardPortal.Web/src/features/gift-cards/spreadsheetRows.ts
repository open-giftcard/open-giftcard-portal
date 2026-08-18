import type { PortalRecipientContactType } from "../../types";
import { asIsoDate } from "./spreadsheet";

/**
 * Turns a worksheet grid into rows the bulk form already understands.
 *
 * Kept apart from the zip reading so the column rules can be tested against a
 * literal grid, which is where the mistakes people actually make live: a
 * renamed header, a comma decimal, a phone number Excel helpfully turned into
 * a number.
 */

export interface ImportedRow {
  itemReference: string;
  amount: string;
  currency: string;
  validFrom: string;
  expiresAt: string;
  contactType: PortalRecipientContactType;
  recipientContact: string;
  /**
   * Shown in the review so the uploader can confirm they matched people to
   * addresses, then dropped. The platform stores no recipient name (ADR-034)
   * and this must not reach the submitted intent.
   */
  displayName: string;
}

export interface ImportProblem {
  /** 1-based worksheet row, so it matches what Excel shows the uploader. */
  readonly line: number;
  readonly message: string;
}

export interface ImportResult {
  readonly rows: ImportedRow[];
  readonly rejectedRows: Array<ImportedRow & { line: number; message: string }>;
  readonly problems: ImportProblem[];
}

/** Accepted spellings per column, compared case- and space-insensitively. */
const headerAliases: Record<string, readonly string[]> = {
  itemReference: ["item reference", "reference", "item", "employee id", "id"],
  amount: ["amount", "value", "sum"],
  currency: ["currency", "ccy"],
  validFrom: ["valid from", "start", "start date", "valid"],
  expiresAt: ["expires at", "expiry", "expires", "expiry date", "end date"],
  recipientContact: [
    "recipient",
    "contact",
    "email",
    "email address",
    "phone",
    "phone number",
    "recipient contact",
  ],
  displayName: ["name", "full name", "employee", "employee name"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mapHeaders(header: readonly string[]): Map<string, number> {
  const found = new Map<string, number>();
  header.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(headerAliases)) {
      if (!found.has(field) && aliases.includes(normalized)) {
        found.set(field, index);
      }
    }
  });
  return found;
}

/**
 * A spreadsheet amount as the decimal the backend expects. Excel in a Turkish
 * locale writes 1.234,56, so a comma decimal is normalized rather than
 * refused; a value with neither separator is left alone.
 */
export function normalizeAmount(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  if (hasComma && hasDot) {
    // Whichever comes last is the decimal separator.
    return trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");
  }
  if (hasComma) {
    return trimmed.replace(",", ".");
  }
  return trimmed;
}

/**
 * Whether the contact is an email or a phone number, decided from the value
 * rather than asked for as a column. A sheet mixing both in one column is the
 * normal case and the distinction is unambiguous.
 */
export function classifyContact(
  value: string,
): { type: PortalRecipientContactType; contact: string } | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed.includes("@")) {
    return { type: "email", contact: trimmed };
  }
  const digits = trimmed.replace(/[\s()-]/g, "");
  if (/^\+?\d{7,15}$/.test(digits)) {
    return {
      type: "phone",
      contact: digits.startsWith("+") ? digits : `+${digits}`,
    };
  }
  return null;
}

export const requiredColumns = [
  "amount",
  "expiresAt",
  "recipientContact",
] as const;

export function importRows(
  grid: readonly (readonly string[])[],
  mappedColumns?: ReadonlyMap<string, number>,
): ImportResult {
  const problems: ImportProblem[] = [];
  if (grid.length === 0) {
    return {
      rows: [],
      rejectedRows: [],
      problems: [{ line: 0, message: "The worksheet is empty." }],
    };
  }

  const columns = mappedColumns ?? mapHeaders(grid[0]);
  const missing = requiredColumns.filter((field) => !columns.has(field));
  if (missing.length > 0) {
    const names: Record<string, string> = {
      amount: "Amount",
      expiresAt: "Expires at",
      recipientContact: "Recipient",
    };
    return {
      rows: [],
      rejectedRows: [],
      problems: [
        {
          line: 1,
          message: `The header row is missing: ${missing
            .map((field) => names[field])
            .join(", ")}. Rename the columns and retry.`,
        },
      ],
    };
  }

  const cellAt = (row: readonly string[], field: string) => {
    const at = columns.get(field);
    return at === undefined ? "" : (row[at] ?? "").trim();
  };

  const rows: ImportedRow[] = [];
  const seen = new Set<string>();
  for (let index = 1; index < grid.length; index += 1) {
    const line = index + 1;
    const row = grid[index];
    if (row.every((cell) => cell === "")) {
      continue;
    }

    const contact = classifyContact(cellAt(row, "recipientContact"));
    if (contact === null) {
      problems.push({
        line,
        message:
          "The recipient is not an email address or a phone number with a country code.",
      });
      continue;
    }

    const amount = normalizeAmount(cellAt(row, "amount"));
    if (!/^\d+(\.\d{1,4})?$/.test(amount) || Number(amount) <= 0) {
      problems.push({ line, message: "The amount is not a positive number." });
      continue;
    }

    const expiresAt = asIsoDate(cellAt(row, "expiresAt"));
    if (!/^\d{4}-\d{2}-\d{2}/.test(expiresAt)) {
      problems.push({
        line,
        message: "The expiry is not a date. Use a date cell or YYYY-MM-DD.",
      });
      continue;
    }

    // Defaulted rather than demanded: a row number is a fine reference and the
    // uploader should not have to invent one per employee.
    const itemReference = cellAt(row, "itemReference") || `ROW-${line}`;
    if (seen.has(itemReference.toLowerCase())) {
      problems.push({
        line,
        message: `The item reference "${itemReference}" is used more than once.`,
      });
      continue;
    }
    seen.add(itemReference.toLowerCase());

    rows.push({
      itemReference,
      amount,
      currency: (cellAt(row, "currency") || "TRY").toUpperCase(),
      validFrom: asIsoDate(cellAt(row, "validFrom")),
      expiresAt,
      contactType: contact.type,
      recipientContact: contact.contact,
      displayName: cellAt(row, "displayName"),
    });
  }

  const rejectedRows = problems
    .filter((problem) => problem.line > 1)
    .map((problem) => {
      const row = grid[problem.line - 1] ?? [];
      const recipientContact = cellAt(row, "recipientContact");
      return {
        line: problem.line,
        message: problem.message,
        itemReference: cellAt(row, "itemReference") || `ROW-${problem.line}`,
        amount: normalizeAmount(cellAt(row, "amount")),
        currency: (cellAt(row, "currency") || "TRY").toUpperCase(),
        validFrom: asIsoDate(cellAt(row, "validFrom")),
        expiresAt: asIsoDate(cellAt(row, "expiresAt")),
        contactType: recipientContact.includes("@") ? "email" : "phone",
        recipientContact,
        displayName: cellAt(row, "displayName"),
      } satisfies ImportedRow & { line: number; message: string };
    });

  return { rows, rejectedRows, problems };
}

export function totalsByCurrency(
  rows: readonly ImportedRow[],
): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(
      row.currency,
      (totals.get(row.currency) ?? 0) + Number(row.amount),
    );
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}
