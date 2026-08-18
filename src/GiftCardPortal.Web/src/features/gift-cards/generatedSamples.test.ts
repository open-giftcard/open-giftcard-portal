/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbookGrid } from "./spreadsheet";
import { importRows, totalsByCurrency } from "./spreadsheetRows";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

describe.each([
  ["recipients-dated-100.xlsx", 100, 33000],
  ["recipients-dated-500.xlsx", 500, 165000],
])("generated bulk sample %s", (fileName, expectedRows, expectedTotal) => {
  it("round-trips through the portal importer with populated dates", async () => {
    const bytes = await readFile(resolve(repoRoot, "tests/fixtures/spreadsheets", fileName));
    const workbook = new File([bytes], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const imported = importRows(await readWorkbookGrid(workbook));

    expect(imported.problems).toEqual([]);
    expect(imported.rows).toHaveLength(expectedRows);
    expect(imported.rows.every((row) => Number(row.amount) >= 200)).toBe(true);
    expect(
      imported.rows.every((row) => /^2026-08-\d{2}$/.test(row.validFrom)),
    ).toBe(true);
    expect(
      imported.rows.every((row) => /^2027-08-\d{2}$/.test(row.expiresAt)),
    ).toBe(true);
    expect(totalsByCurrency(imported.rows)).toEqual([
      { currency: "TRY", amount: expectedTotal },
    ]);
  });
});
