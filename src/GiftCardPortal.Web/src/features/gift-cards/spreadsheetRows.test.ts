import {
  classifyContact,
  importRows,
  mapHeaders,
  normalizeAmount,
  totalsByCurrency,
} from "./spreadsheetRows";
import { asIsoDate, columnIndex } from "./spreadsheet";

const header = [
  "Name",
  "Email",
  "Amount",
  "Currency",
  "Expiry date",
  "Employee ID",
];

function sheet(...rows: string[][]) {
  return [header, ...rows];
}

describe("header mapping", () => {
  it("accepts the spellings a real payroll sheet uses", () => {
    const columns = mapHeaders(header);

    expect(columns.get("displayName")).toBe(0);
    expect(columns.get("recipientContact")).toBe(1);
    expect(columns.get("amount")).toBe(2);
    expect(columns.get("currency")).toBe(3);
    expect(columns.get("expiresAt")).toBe(4);
    expect(columns.get("itemReference")).toBe(5);
  });

  it("refuses the file when a required column is absent, naming it", () => {
    const result = importRows([
      ["Name", "Email"],
      ["Ada", "ada@example.com"],
    ]);

    expect(result.rows).toHaveLength(0);
    expect(result.problems[0].message).toContain("Amount");
    expect(result.problems[0].message).toContain("Expires at");
  });
});

describe("cell values", () => {
  it("reads a comma decimal, which is what Excel writes in a Turkish locale", () => {
    expect(normalizeAmount("1.234,56")).toBe("1234.56");
    expect(normalizeAmount("250,50")).toBe("250.50");
    expect(normalizeAmount("1,234.56")).toBe("1234.56");
    expect(normalizeAmount("500")).toBe("500");
  });

  it("converts an Excel date serial but leaves real text alone", () => {
    // 45658 is 2025-01-01 on Excel's 1899-12-30 epoch.
    expect(asIsoDate("45658")).toBe("2025-01-01");
    expect(asIsoDate("45658.5")).toBe("2025-01-01T12:00");
    expect(asIsoDate("2027-07-01")).toBe("2027-07-01");
    // A small number in a date column is far more likely to be a number.
    expect(asIsoDate("12")).toBe("12");
  });

  it("tells an email from a phone number without asking for a column", () => {
    expect(classifyContact("ada@example.com")).toEqual({
      type: "email",
      contact: "ada@example.com",
    });
    expect(classifyContact("+90 555 111 2233")).toEqual({
      type: "phone",
      contact: "+905551112233",
    });
    // A bare national number gets the plus it needs for E.164.
    expect(classifyContact("905551112233")?.contact).toBe("+905551112233");
    expect(classifyContact("not a contact")).toBeNull();
    expect(classifyContact("")).toBeNull();
  });

  it("maps spreadsheet columns beyond Z", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AA1")).toBe(26);
    expect(columnIndex("AB12")).toBe(27);
  });
});

describe("importing rows", () => {
  it("imports a clean sheet and defaults what it may", () => {
    const result = importRows(
      sheet(
        [
          "Ada Lovelace",
          "ada@example.com",
          "250,00",
          "",
          "2027-07-01",
          "EMP-1",
        ],
        ["Grace Hopper", "+905551112233", "300", "try", "45658", ""],
      ),
    );

    expect(result.problems).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      itemReference: "EMP-1",
      amount: "250.00",
      currency: "TRY",
      contactType: "email",
      recipientContact: "ada@example.com",
      displayName: "Ada Lovelace",
    });
    expect(result.rows[1]).toMatchObject({
      // No employee id in the sheet, so the worksheet line stands in.
      itemReference: "ROW-3",
      currency: "TRY",
      contactType: "phone",
      recipientContact: "+905551112233",
      expiresAt: "2025-01-01",
    });
  });

  it("reports the worksheet line so the uploader can find the bad row", () => {
    const result = importRows(
      sheet(
        ["Ada", "ada@example.com", "250", "TRY", "2027-07-01", "EMP-1"],
        ["Broken", "not-a-contact", "250", "TRY", "2027-07-01", "EMP-2"],
        ["Zero", "zero@example.com", "0", "TRY", "2027-07-01", "EMP-3"],
        ["NoDate", "nd@example.com", "10", "TRY", "soon", "EMP-4"],
      ),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rejectedRows).toHaveLength(3);
    expect(result.rejectedRows[0]).toEqual(
      expect.objectContaining({
        line: 3,
        itemReference: "EMP-2",
        recipientContact: "not-a-contact",
      }),
    );
    // Line 3 is the second data row: 1-based and counting the header, which is
    // what Excel shows down its own gutter.
    expect(result.problems.map((problem) => problem.line)).toEqual([3, 4, 5]);
    expect(result.problems[0].message).toContain("recipient");
    expect(result.problems[1].message).toContain("positive number");
    expect(result.problems[2].message).toContain("date");
  });

  it("rejects a duplicate item reference rather than issuing twice", () => {
    const result = importRows(
      sheet(
        ["Ada", "ada@example.com", "250", "TRY", "2027-07-01", "EMP-1"],
        ["Also Ada", "ada2@example.com", "250", "TRY", "2027-07-01", "emp-1"],
      ),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.problems[0].message).toContain("more than once");
  });

  it("skips blank rows instead of calling them broken", () => {
    const result = importRows(
      sheet(
        ["Ada", "ada@example.com", "250", "TRY", "2027-07-01", "EMP-1"],
        ["", "", "", "", "", ""],
      ),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.problems).toEqual([]);
  });

  it("totals per currency so the file can be checked against the balance", () => {
    const result = importRows(
      sheet(
        ["A", "a@example.com", "250,50", "TRY", "2027-07-01", "1"],
        ["B", "b@example.com", "100", "TRY", "2027-07-01", "2"],
        ["C", "c@example.com", "40", "EUR", "2027-07-01", "3"],
      ),
    );

    expect(totalsByCurrency(result.rows)).toEqual([
      { currency: "EUR", amount: 40 },
      { currency: "TRY", amount: 350.5 },
    ]);
  });
});
