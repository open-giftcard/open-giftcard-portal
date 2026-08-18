import { SpreadsheetError, readWorkbookGrid } from "./spreadsheet";

/** The mirror of what the reader does, so the fixture needs no dependency. */
async function deflateRaw(raw: BufferSource): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(raw);
      controller.close();
    },
  });
  const compressed = source.pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/**
 * Builds a real zip rather than mocking one. The reader walks a central
 * directory and local headers by byte offset, which is precisely the kind of
 * code that passes review and fails on a real file, so the test feeds it the
 * same bytes Excel would.
 */
async function zip(files: { name: string; body: string; deflate: boolean }[]) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const raw = encoder.encode(file.body);
    const stored = file.deflate ? await deflateRaw(raw) : raw;
    const method = file.deflate ? 8 : 0;

    const local = new Uint8Array(30 + name.length + stored.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, method, true);
    localView.setUint32(18, stored.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(stored, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, method, true);
    centralView.setUint32(20, stored.length, true);
    centralView.setUint32(24, raw.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob(
    [...locals, ...centrals, end].map((part) => part.buffer as ArrayBuffer),
  );
}

const sharedStrings = `<?xml version="1.0"?>
<sst><si><t>Name</t></si><si><t>Email</t></si><si><t>Amount</t></si>
<si><t>Ada Lovelace</t></si><si><t>ada@example.com</t></si>
<si><r><t>Grace</t></r><r><t> Hopper</t></r></si></sst>`;

const sheet = `<?xml version="1.0"?>
<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>250.5</v></c></row>
<row r="3"><c r="A3" t="s"><v>5</v></c><c r="C3"><v>300</v></c></row>
</sheetData></worksheet>`;

describe("readWorkbookGrid", () => {
  it("reads a deflated workbook the way Excel writes one", async () => {
    const grid = await readWorkbookGrid(
      await zip([
        { name: "xl/sharedStrings.xml", body: sharedStrings, deflate: true },
        { name: "xl/worksheets/sheet1.xml", body: sheet, deflate: true },
      ]),
    );

    expect(grid[0]).toEqual(["Name", "Email", "Amount"]);
    expect(grid[1]).toEqual(["Ada Lovelace", "ada@example.com", "250.5"]);
    // A shared string split across runs is one value, and the gap at B3 stays
    // a gap instead of shifting the amount left into the email column.
    expect(grid[2]).toEqual(["Grace Hopper", "", "300"]);
  });

  it("reads a stored workbook too", async () => {
    const grid = await readWorkbookGrid(
      await zip([
        { name: "xl/sharedStrings.xml", body: sharedStrings, deflate: false },
        { name: "xl/worksheets/sheet1.xml", body: sheet, deflate: false },
      ]),
    );

    expect(grid[1][1]).toBe("ada@example.com");
  });

  it("works without a shared string table, which small exports omit", async () => {
    const inline = `<?xml version="1.0"?>
      <worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>Amount</t></is></c></row>
      <row r="2"><c r="A2"><v>42</v></c></row>
      </sheetData></worksheet>`;

    const grid = await readWorkbookGrid(
      await zip([
        { name: "xl/worksheets/sheet1.xml", body: inline, deflate: true },
      ]),
    );

    expect(grid).toEqual([["Amount"], ["42"]]);
  });

  it("refuses a file that is not a zip, rather than reading nonsense", async () => {
    const notAWorkbook = new Blob(["this is a csv, actually"]);

    await expect(readWorkbookGrid(notAWorkbook)).rejects.toBeInstanceOf(
      SpreadsheetError,
    );
  });

  it("refuses a zip with no worksheet", async () => {
    const archive = await zip([
      { name: "docProps/app.xml", body: "<Properties/>", deflate: true },
    ]);

    await expect(readWorkbookGrid(archive)).rejects.toThrow(/no worksheets/);
  });
});
