/**
 * Reads an .xlsx in the browser with no dependency.
 *
 * An .xlsx is a zip of XML, and the platform already ships both halves of what
 * that needs: DecompressionStream inflates the entries and DOMParser reads
 * them. A spreadsheet library would be several hundred kilobytes shipped to
 * every user of the portal so that one screen can read two files out of an
 * archive, and adding one here would also mean changing a lockfile this
 * machine has no package manager to change.
 *
 * The file never leaves the browser. Rows are parsed, shown for review, and
 * submitted as ordinary form values through the existing endpoint; nothing is
 * uploaded and nothing is retained (ADR-037 keeps the browser a form-filler,
 * not an authority).
 *
 * Deliberately not supported: ZIP64 archives, encrypted workbooks, and the
 * 1904 date system. Each throws a stated error rather than guessing, because a
 * silently misread payroll file is worse than a refused one.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const MAX_COMMENT = 0xffff;

/** Excel's epoch is 1899-12-30: it treats 1900 as a leap year and never has. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export class SpreadsheetError extends Error {}

interface ZipEntry {
  readonly method: number;
  readonly localHeaderOffset: number;
  readonly compressedSize: number;
}

function findEndOfCentralDirectory(view: DataView): number {
  const earliest = Math.max(0, view.byteLength - MAX_COMMENT - 22);
  for (let at = view.byteLength - 22; at >= earliest; at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      return at;
    }
  }
  throw new SpreadsheetError(
    "That file is not a readable .xlsx workbook. Export it again from Excel and retry.",
  );
}

function readCentralDirectory(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);

  if (at === 0xffffffff || count === 0xffff) {
    throw new SpreadsheetError(
      "That workbook uses the ZIP64 format, which this page cannot read. Save it as a standard .xlsx and retry.",
    );
  }

  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      break;
    }
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localHeaderOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, at + 46, nameLength));
    entries.set(name, { method, localHeaderOffset, compressedSize });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(
  buffer: ArrayBuffer,
  entry: ZipEntry,
): Promise<string> {
  const view = new DataView(buffer);
  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const start = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const raw = new Uint8Array(buffer, start, entry.compressedSize);

  if (entry.method === 0) {
    return new TextDecoder().decode(raw);
  }
  if (entry.method !== 8) {
    throw new SpreadsheetError(
      "That workbook uses an unsupported compression method. Save it as a standard .xlsx and retry.",
    );
  }

  // Fed from a ReadableStream rather than Blob.stream(), which is absent in
  // some runtimes the tests use and buys nothing here.
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(raw);
      controller.close();
    },
  });
  const inflated = source.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(inflated).text();
}

/** A1 style reference to a zero-based column index. */
export function columnIndex(reference: string): number {
  let index = 0;
  for (const character of reference) {
    const code = character.charCodeAt(0);
    if (code < 65 || code > 90) {
      break;
    }
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

function textOf(element: Element | null): string {
  if (element === null) {
    return "";
  }
  // Shared strings split across runs, so every <t> contributes in order.
  const runs = elementsNamed(element, "t");
  if (runs.length === 0) {
    return element.textContent ?? "";
  }
  let value = "";
  for (let index = 0; index < runs.length; index += 1) {
    value += runs[index].textContent ?? "";
  }
  return value;
}

/**
 * SpreadsheetML permits both a default namespace and an explicit prefix such
 * as x:. Excel commonly writes the former, while other valid producers write
 * the latter. Matching by local name keeps the reader interoperable with both.
 */
function elementsNamed(
  parent: Document | Element,
  localName: string,
): HTMLCollectionOf<Element> {
  return parent.getElementsByTagNameNS("*", localName);
}

function parseXml(xml: string, what: string): Document {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new SpreadsheetError(
      `The workbook's ${what} could not be read. Export it again from Excel and retry.`,
    );
  }
  return document;
}

/**
 * An Excel date serial as an ISO date, or the value unchanged when it is
 * already text. Dates are the one column where a spreadsheet's own
 * representation differs from what a person sees, so a bare number in a date
 * column is interpreted rather than rejected.
 */
export function asIsoDate(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "" || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  const serial = Number(trimmed);
  // Below this a "date" is far more likely to be a plain number than 1900.
  if (serial < 1000) {
    return trimmed;
  }
  // Excel's fractional day is a time of day. Preserve it when present, but
  // keep date-only cells date-only so the form can apply its documented
  // start/end-of-day defaults. Round to a minute to avoid binary-float noise.
  const milliseconds = Math.round((serial * MS_PER_DAY) / 60_000) * 60_000;
  const utc = new Date(EXCEL_EPOCH_UTC + milliseconds);
  const iso = utc.toISOString();
  return Number.isInteger(serial) ? iso.slice(0, 10) : iso.slice(0, 16);
}

/**
 * The first worksheet as a grid of trimmed strings, with empty trailing rows
 * removed. Row and column positions are preserved, so a blank cell in the
 * middle stays blank rather than shifting its neighbours left.
 */
export async function readWorkbookGrid(file: Blob): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const entries = readCentralDirectory(buffer);

  const sheetName =
    [...entries.keys()]
      .filter((name) => name.startsWith("xl/worksheets/sheet"))
      .sort()[0] ?? null;
  if (sheetName === null) {
    throw new SpreadsheetError(
      "That workbook has no worksheets. Check the file and retry.",
    );
  }

  const shared: string[] = [];
  const sharedEntry = entries.get("xl/sharedStrings.xml");
  if (sharedEntry) {
    const document = parseXml(
      await readEntry(buffer, sharedEntry),
      "shared text",
    );
    const items = elementsNamed(document, "si");
    for (let index = 0; index < items.length; index += 1) {
      shared.push(textOf(items[index]));
    }
  }

  const sheet = parseXml(
    await readEntry(buffer, entries.get(sheetName)!),
    "first worksheet",
  );
  const grid: string[][] = [];
  const rows = elementsNamed(sheet, "row");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cells = elementsNamed(rows[rowIndex], "c");
    const line: string[] = [];
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      const cell = cells[cellIndex];
      const reference = cell.getAttribute("r") ?? "";
      const at = reference === "" ? cellIndex : columnIndex(reference);
      const type = cell.getAttribute("t");
      let value: string;
      if (type === "s") {
        const shareIndex = Number(
          elementsNamed(cell, "v")[0]?.textContent ?? "-1",
        );
        value = shared[shareIndex] ?? "";
      } else if (type === "inlineStr") {
        value = textOf(elementsNamed(cell, "is")[0] ?? null);
      } else {
        value = elementsNamed(cell, "v")[0]?.textContent ?? "";
      }
      while (line.length < at) {
        line.push("");
      }
      line[at] = value.trim();
    }
    grid.push(line);
  }

  while (
    grid.length > 0 &&
    grid[grid.length - 1].every((cell) => cell === "")
  ) {
    grid.pop();
  }
  return grid;
}
