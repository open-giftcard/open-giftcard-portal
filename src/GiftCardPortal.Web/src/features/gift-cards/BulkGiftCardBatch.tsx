import { newIdentifier } from "../../identifiers";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from "react-aria-components";
import { useFormatters } from "../../i18n/formatters";
import { useTranslation, type Translator } from "../../i18n/translate";
import type {
  PortalBulkGiftCardBatch,
  PortalRecipientContactType,
} from "../../types";
import { SpreadsheetError, readWorkbookGrid } from "./spreadsheet";
import {
  classifyContact,
  importRows,
  mapHeaders,
  normalizeAmount,
  requiredColumns,
  totalsByCurrency,
} from "./spreadsheetRows";
import { defaultCurrency } from "../../config";

interface BulkBatchDraftRow {
  key: string;
  itemReference: string;
  amount: string;
  currency: string;
  validFrom: string;
  expiresAt: string;
  isTransferable: boolean;
  isDivisible: boolean;
  recipientContact: string;
  /** Undefined once the row would be accepted. Recomputed across the batch. */
  issue?: string;
}

/**
 * The gift card fields a worksheet column can be mapped onto.
 *
 * Translated here rather than by handing a stored English label to the
 * translator later: a dynamic key is invisible to the dictionary's drift test,
 * and one of these labels had already gone untranslated that way without
 * anything noticing.
 */
function importFields(t: Translator) {
  return [
    { key: "itemReference", label: t("Item reference"), required: false },
    { key: "amount", label: t("Amount"), required: true },
    { key: "currency", label: t("Currency"), required: false },
    { key: "validFrom", label: t("Valid from"), required: false },
    { key: "expiresAt", label: t("Expiry date"), required: true },
    { key: "recipientContact", label: t("Recipient"), required: true },
    { key: "displayName", label: t("Name"), required: false },
  ] as const;
}

type ImportStage = "upload" | "mapping" | "repair";

const maximumRows = 2000;

export interface BulkGiftCardBatchIntent {
  batchReference: string;
  operationId: string;
  items: Array<{
    itemReference: string;
    amount: string;
    currency: string;
    validFromUtc?: string;
    expiresAtUtc: string;
    isTransferable: boolean;
    isDivisible: boolean;
    contactType: PortalRecipientContactType;
    recipientContact: string;
  }>;
}

interface BulkGiftCardBatchProps {
  organizationName: string;
  canCreate: boolean;
  canView: boolean;
  availableCorporateCredit?: Array<{ currency: string; amount: number }>;
  result?: PortalBulkGiftCardBatch;
  isCreating: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  isRetrying: boolean;
  createError?: string;
  refreshError?: string;
  retryError?: string;
  onCreate: (intent: BulkGiftCardBatchIntent) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetryFailed: () => void;
  onStartNew: () => void;
}

function datePart(value: string): string {
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function timePart(value: string): string {
  return value.match(/[T ](\d{2}:\d{2})/)?.[1] ?? "";
}

function withDate(value: string, date: string): string {
  if (!date) {
    return "";
  }
  const time = timePart(value);
  return time ? `${date}T${time}` : date;
}

function withTime(value: string, time: string): string {
  const date = datePart(value);
  if (!date || !time) {
    return date;
  }
  return `${date}T${time}`;
}

function localDateTimeToIso(
  value: string,
  defaultTime: "00:00" | "23:59",
): string | undefined {
  if (!value) {
    return undefined;
  }

  const localValue = timePart(value)
    ? value.replace(" ", "T")
    : `${datePart(value)}T${defaultTime}`;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function newRow(): BulkBatchDraftRow {
  return {
    key: newIdentifier(),
    itemReference: "",
    amount: "",
    currency: defaultCurrency,
    validFrom: "",
    expiresAt: "",
    isTransferable: false,
    isDivisible: false,
    recipientContact: "",
  };
}

/**
 * A row nobody has filled in yet. "Add item" produces one, and so does closing
 * the file picker without a file, so it cannot be an error the moment it
 * appears: it is dropped on submit instead of blocking it.
 */
function isBlankRow(row: BulkBatchDraftRow): boolean {
  return (
    !row.itemReference.trim() &&
    !row.amount.trim() &&
    !row.expiresAt &&
    !row.validFrom &&
    !row.recipientContact.trim()
  );
}

function rowProblem(
  row: BulkBatchDraftRow,
  duplicateReferences: ReadonlySet<string>,
  t: Translator,
): string | undefined {
  if (isBlankRow(row)) {
    return t("This row is empty and will be ignored.");
  }
  if (!row.itemReference.trim()) {
    return t("Enter an item reference.");
  }
  if (duplicateReferences.has(row.itemReference.trim().toLowerCase())) {
    return t("Another row already uses this item reference.");
  }
  const amount = normalizeAmount(row.amount);
  if (!/^\d+(\.\d{1,4})?$/.test(amount) || Number(amount) <= 0) {
    return t("Enter a positive amount.");
  }
  if (!/^[A-Za-z]{3}$/.test(row.currency.trim())) {
    return t("Enter a three-letter currency code.");
  }
  if (!classifyContact(row.recipientContact)) {
    return t("Enter a valid email address or international phone number.");
  }
  if (!localDateTimeToIso(row.expiresAt, "23:59")) {
    return t("Enter a valid expiry date.");
  }
  if (row.validFrom && !localDateTimeToIso(row.validFrom, "00:00")) {
    return t("Enter a valid valid-from date or leave it blank.");
  }
  return undefined;
}

/**
 * Recomputes every row's problem together, because one of them — a repeated
 * item reference — is a property of the batch rather than of a row. Editing one
 * cell can therefore clear the marker on a row the reader never touched, which
 * is exactly what a spreadsheet does.
 */
function withProblems(
  rows: readonly BulkBatchDraftRow[],
  t: Translator,
): BulkBatchDraftRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const reference = row.itemReference.trim().toLowerCase();
    if (reference) {
      counts.set(reference, (counts.get(reference) ?? 0) + 1);
    }
  }
  const duplicates = new Set(
    [...counts]
      .filter(([, count]) => count > 1)
      .map(([reference]) => reference),
  );

  return rows.map((row) => {
    const issue = rowProblem(row, duplicates, t);
    return row.issue === issue ? row : { ...row, issue };
  });
}

export function BulkGiftCardBatch({
  organizationName,
  canCreate,
  canView,
  availableCorporateCredit,
  result,
  isCreating,
  isRefreshing,
  isLoadingMore,
  isRetrying,
  createError,
  refreshError,
  retryError,
  onCreate,
  onRefresh,
  onLoadMore,
  onRetryFailed,
  onStartNew,
}: BulkGiftCardBatchProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [batchReference, setBatchReference] = useState("");
  // Through withProblems even when there is nothing to check yet, so the one
  // starting row is marked as the empty row it is rather than as ready.
  const [rows, setRows] = useState<BulkBatchDraftRow[]>(() =>
    withProblems([newRow()], t),
  );
  const [intent, setIntent] = useState<BulkGiftCardBatchIntent>();
  const [validationError, setValidationError] = useState<string>();
  const [importSummary, setImportSummary] = useState<{
    fileName: string;
    imported: number;
    needRepair: number;
    names: string[];
  }>();
  const [importError, setImportError] = useState<string>();
  const [isImporting, setIsImporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>("upload");
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    grid: string[][];
  }>();
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>(
    {},
  );
  /**
   * The spreadsheet and the confirmation list page independently. They used to
   * share one counter, so paging through 400 imported rows and then confirming
   * opened the confirmation on page 17 of 4.
   */
  const [repairPage, setRepairPage] = useState(0);
  const [reviewPage, setReviewPage] = useState(0);
  const [showProblemsOnly, setShowProblemsOnly] = useState(false);
  const [repairPageSize, setRepairPageSize] = useState(25);
  const reviewPageSize = 25;

  /**
   * Reads the workbook in the browser and fills the form with it. Nothing is
   * uploaded: the rows become ordinary form values and go through the same
   * review and the same endpoint as rows typed by hand, so the backend still
   * revalidates every field and the browser stays a form-filler.
   */
  async function importWorkbook(file: File) {
    setIsImporting(true);
    setImportError(undefined);
    setImportSummary(undefined);
    // Bounded so a file this reader cannot finish says so instead of spinning
    // forever. A workbook of the permitted size is read in milliseconds, so
    // reaching this at all means something is wrong.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const grid = await Promise.race([
        readWorkbookGrid(file),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(
              new SpreadsheetError(
                t(
                  "Reading {file} took too long and was stopped. Re-save it from Excel as .xlsx and try again.",
                  { file: file.name },
                ),
              ),
            );
          }, 20_000);
        }),
      ]);
      if (grid.length <= 1) {
        setImportError(
          t("That worksheet has a header but no recipient rows to import."),
        );
        return;
      }

      if (grid.length - 1 > maximumRows) {
        setImportError(
          t(
            "That file has {rows} rows and this batch takes at most {maximum}. Split the file and upload it in parts.",
            {
              rows: formatters.number(grid.length - 1),
              maximum: formatters.number(maximumRows),
            },
          ),
        );
        return;
      }

      const detected = mapHeaders(grid[0]);
      setColumnMapping(Object.fromEntries(detected.entries()));
      setPendingImport({ fileName: file.name, grid });
      setImportStage("mapping");
    } catch (error) {
      // An unexpected failure reports what it actually was. A single generic
      // sentence is friendlier and leaves nobody able to say why the file was
      // refused, which is worse when it happens in front of an audience.
      setImportError(
        error instanceof SpreadsheetError
          ? error.message
          : t("That file could not be read as a spreadsheet. {detail}", {
              detail: error instanceof Error ? error.message : String(error),
            }),
      );
    } finally {
      // The loser of the race would otherwise reject after the reader has
      // already won, with nobody left to catch it.
      clearTimeout(timeout);
      setIsImporting(false);
    }
  }

  function applyColumnMapping() {
    if (!pendingImport) {
      return;
    }
    const mapped = new Map(
      Object.entries(columnMapping).filter(([, column]) => column >= 0),
    );
    const missing = requiredColumns.filter((field) => !mapped.has(field));
    if (missing.length > 0) {
      setImportError(
        t("Map Amount, Expiry date, and Recipient before continuing."),
      );
      return;
    }
    const selectedColumns = [...mapped.values()];
    if (new Set(selectedColumns).size !== selectedColumns.length) {
      setImportError(
        t("Each spreadsheet column can map to only one gift card field."),
      );
      return;
    }
    const imported = importRows(pendingImport.grid, mapped);
    if (imported.rows.length === 0 && imported.rejectedRows.length === 0) {
      setImportError(
        imported.problems[0]?.message ?? t("That worksheet had no valid rows."),
      );
      return;
    }

    // Rows the reader can repair here and rows that passed cleanly both land in
    // the sheet, so the sheet is the whole file rather than the part of it that
    // happened to be clean. The ones needing work follow the clean ones, which
    // is also the order "only show rows with problems" leaves them in.
    const editableRows = [...imported.rows, ...imported.rejectedRows];
    setRows(
      withProblems(
        editableRows.map((row) => ({
          key: newIdentifier(),
          itemReference: row.itemReference,
          amount: row.amount,
          currency: row.currency,
          validFrom: row.validFrom,
          expiresAt: row.expiresAt,
          isTransferable: false,
          isDivisible: false,
          recipientContact: row.recipientContact,
        })),
        t,
      ),
    );
    setIntent(undefined);
    setValidationError(undefined);
    setImportError(undefined);
    setRepairPage(0);
    setShowProblemsOnly(false);
    setImportSummary({
      fileName: pendingImport.fileName,
      imported: editableRows.length,
      needRepair: imported.rejectedRows.length,
      // Names are shown so the uploader can confirm they matched people to
      // addresses, and are dropped here. The platform stores no recipient
      // name (ADR-034) and none is submitted.
      names: editableRows.map((row) => row.displayName).filter(Boolean),
    });
    setImportStage("repair");
  }

  useEffect(() => {
    if (result) {
      setIsOpen(true);
      setBatchReference("");
      setRows(withProblems([newRow()], t));
      setIntent(undefined);
      setValidationError(undefined);
    }
  }, [result]);

  // Row problems are sentences held in state, so switching language mid-repair
  // would otherwise leave the marked rows explaining themselves in the language
  // the reader has just left.
  useEffect(() => {
    setRows((current) => withProblems(current, t));
  }, [t]);

  function updateRow(
    key: string,
    update: Partial<Omit<BulkBatchDraftRow, "key">>,
  ) {
    setRows((current) =>
      withProblems(
        current.map((row) => (row.key === key ? { ...row, ...update } : row)),
        t,
      ),
    );
  }

  function reviewBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // A row nobody filled in is dropped rather than treated as a mistake, so
    // an accidental "Add item" does not have to be undone before submitting.
    const submittedRows = rows.filter((row) => !isBlankRow(row));
    if (submittedRows.length === 0) {
      setValidationError(t("Add at least one row before reviewing the batch."));
      return;
    }
    if (submittedRows.length > maximumRows) {
      setValidationError(
        t("This batch takes at most {maximum} rows.", {
          maximum: formatters.number(maximumRows),
        }),
      );
      return;
    }
    if (submittedRows.some((row) => row.issue)) {
      setValidationError(
        t("Repair every highlighted spreadsheet row before continuing."),
      );
      setShowProblemsOnly(true);
      setRepairPage(0);
      return;
    }
    if (!batchReference.trim()) {
      setValidationError(t("Enter a batch reference."));
      return;
    }

    const items = submittedRows.map((row) => {
      const contact = classifyContact(row.recipientContact);
      return {
        itemReference: row.itemReference.trim(),
        amount: normalizeAmount(row.amount),
        currency: row.currency.trim().toUpperCase(),
        validFromUtc: localDateTimeToIso(row.validFrom, "00:00"),
        expiresAtUtc: localDateTimeToIso(row.expiresAt, "23:59") ?? "",
        isTransferable: row.isTransferable,
        isDivisible: row.isDivisible,
        contactType: contact?.type ?? "email",
        recipientContact: contact?.contact ?? row.recipientContact.trim(),
      };
    });

    // The same comparison the finance screen shows, applied to whatever is in
    // the sheet. It used to run only for imported batches, so a hand-typed
    // batch could be queued straight past the visible credit.
    if (availableCorporateCredit) {
      const submittedTotals = new Map<string, number>();
      for (const item of items) {
        submittedTotals.set(
          item.currency,
          (submittedTotals.get(item.currency) ?? 0) + Number(item.amount),
        );
      }
      const shortages = [...submittedTotals].flatMap(([currency, amount]) => {
        const available =
          availableCorporateCredit.find(
            (credit) => credit.currency === currency,
          )?.amount ?? 0;
        return amount <= available
          ? []
          : [
              t("{currency} {requested} requested but {available} available", {
                currency,
                requested: amount.toFixed(2),
                available: available.toFixed(2),
              }),
            ];
      });
      if (shortages.length > 0) {
        setValidationError(
          t(
            "The batch exceeds the currently available corporate credit: {shortages}. Refresh Finance or reduce the batch before submitting.",
            { shortages: shortages.join("; ") },
          ),
        );
        return;
      }
    }

    setValidationError(undefined);
    setReviewPage(0);
    setIntent({
      batchReference: batchReference.trim(),
      operationId: newIdentifier(),
      items,
    });
  }

  const problemCount = rows.filter(
    (row) => row.issue && !isBlankRow(row),
  ).length;
  const readyCount = rows.filter(
    (row) => !row.issue && !isBlankRow(row),
  ).length;
  const visibleRows = showProblemsOnly
    ? rows.filter((row) => Boolean(row.issue) && !isBlankRow(row))
    : rows;
  // Removing rows, repairing them, or narrowing to problems can all leave the
  // reader on a page that no longer exists.
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / repairPageSize));
  const currentRepairPage = Math.min(repairPage, pageCount - 1);
  const pageRows = visibleRows.slice(
    currentRepairPage * repairPageSize,
    (currentRepairPage + 1) * repairPageSize,
  );
  const draftTotals = useMemo(
    () =>
      totalsByCurrency(
        rows
          .filter((row) => !row.issue && !isBlankRow(row))
          .map((row) => ({
            itemReference: row.itemReference,
            amount: normalizeAmount(row.amount),
            currency: row.currency.trim().toUpperCase(),
            validFrom: row.validFrom,
            expiresAt: row.expiresAt,
            contactType: "email" as const,
            recipientContact: row.recipientContact,
            displayName: "",
          })),
      ),
    [rows],
  );

  function resetImportDraft() {
    setImportStage("upload");
    setPendingImport(undefined);
    setColumnMapping({});
    setImportSummary(undefined);
    setImportError(undefined);
    setValidationError(undefined);
    setRows(withProblems([newRow()], t));
    setBatchReference("");
    setIntent(undefined);
    setRepairPage(0);
    setReviewPage(0);
    setShowProblemsOnly(false);
    setRepairPageSize(25);
  }

  function closeImport() {
    if (!result) {
      resetImportDraft();
    }
    setIsOpen(false);
  }

  const showsSheet =
    !result && canCreate && !intent && importStage === "repair";
  const stepIndex = intent
    ? 3
    : ["upload", "mapping", "repair"].indexOf(importStage);

  return (
    <section className="bulk-batch" aria-labelledby="bulk-batch-title">
      <div className="section-heading">
        <div>
          <p className="card-kicker">{t("Asynchronous issue and delivery")}</p>
          <h2 id="bulk-batch-title" className="section-title">
            {t("Bulk gift card batch")}
          </h2>
          <p className="supporting-copy supporting-copy--wide">
            {t(
              "Submit up to {maximum} reviewed rows for {organization}. The backend processes each row independently, keeps per-row outcomes, and lets you retry only the failed rows after the batch completes.",
              {
                maximum: formatters.number(maximumRows),
                organization: organizationName,
              },
            )}
          </p>
        </div>
      </div>

      {canCreate || result ? (
        <Button
          className="button button--primary"
          onPress={() => {
            setIsOpen(true);
          }}
        >
          {result ? t("Open batch progress") : t("Batch upload")}
        </Button>
      ) : null}
      {!canCreate && !result ? (
        <p className="permission-note">
          {t(
            "Creating a batch requires both gift-card issue and distribution permission. The backend enforces both permissions for every request.",
          )}
        </p>
      ) : null}

      <ModalOverlay
        className="bulk-import-overlay"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsOpen(true);
          } else {
            closeImport();
          }
        }}
        isDismissable={!isCreating}
      >
        <Modal className="bulk-import-modal">
          <Dialog
            className="bulk-import-dialog"
            aria-label={t("Bulk gift card upload")}
          >
            <header className="bulk-import-dialog__header">
              <div>
                <p className="card-kicker">
                  {t("Asynchronous issue and delivery")}
                </p>
                <h2>{t("Bulk gift card upload")}</h2>
              </div>
              <Button
                className="text-button bulk-import-dialog__close"
                isDisabled={isCreating}
                onPress={closeImport}
                aria-label={t("Close batch upload")}
              >
                {t("Close")}
              </Button>
            </header>
            <div
              className={
                showsSheet
                  ? "bulk-import-dialog__body bulk-import-dialog__body--wide"
                  : "bulk-import-dialog__body"
              }
            >
              {result ? (
                <div className="bulk-batch-result">
                  <div className="bulk-batch-result__heading">
                    <div>
                      <p className="card-kicker">{t("Backend batch result")}</p>
                      <h3>{result.batchReference}</h3>
                      <p>
                        {t("{succeeded} succeeded · {failed} failed", {
                          succeeded: result.succeededItems,
                          failed: result.failedItems,
                        })}
                        {result.completedAtUtc ? (
                          <>
                            {" · "}
                            {t("completed")}{" "}
                            <time dateTime={result.completedAtUtc}>
                              {formatters.dateTime(result.completedAtUtc)}
                            </time>
                          </>
                        ) : (
                          <>
                            {" · "}
                            {t("{count} pending", {
                              count:
                                result.totalItems -
                                result.succeededItems -
                                result.failedItems,
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="status-chip">{result.status}</span>
                  </div>
                  {refreshError ? (
                    <p className="error-banner" role="alert">
                      {refreshError}
                    </p>
                  ) : null}
                  {retryError ? (
                    <p className="error-banner" role="alert">
                      {retryError}
                    </p>
                  ) : null}
                  {result.items.length === 0 ? (
                    <p role="status">
                      {result.status === "Completed"
                        ? t("No row outcomes were returned.")
                        : t(
                            "The batch was accepted. Row outcomes will appear as processing begins.",
                          )}
                    </p>
                  ) : null}
                  <ol className="bulk-batch-results">
                    {result.items.map((item) => (
                      <li key={`${item.position}-${item.itemReference}`}>
                        <div className="bulk-result-item__heading">
                          <div>
                            <span>
                              {t("Item {position}", {
                                position: item.position,
                              })}
                            </span>
                            <h4>{item.itemReference}</h4>
                          </div>
                          <span className="status-chip">{item.status}</span>
                        </div>
                        <dl>
                          <div>
                            <dt>{t("Card")}</dt>
                            <dd>
                              {item.giftCardPublicReference ?? t("Not issued")}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("Recipient")}</dt>
                            <dd>
                              {item.contactType} · {item.maskedRecipientContact}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("Amount")}</dt>
                            <dd>
                              {formatters.money(item.amount, item.currency)}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("Card state")}</dt>
                            <dd>{item.giftCardState ?? t("Not issued")}</dd>
                          </div>
                          <div>
                            <dt>{t("Delivery")}</dt>
                            <dd>
                              {item.distributedAtUtc ? (
                                <time dateTime={item.distributedAtUtc}>
                                  {formatters.dateTime(item.distributedAtUtc)}
                                </time>
                              ) : (
                                (item.invitationState ?? t("Not delivered"))
                              )}
                            </dd>
                          </div>
                          {item.failureCode || item.failureMessage ? (
                            <div>
                              <dt>{t("Failure")}</dt>
                              <dd>
                                {item.failureCode
                                  ? `${item.failureCode}: `
                                  : ""}
                                {item.failureMessage ?? t("This row failed.")}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    ))}
                  </ol>
                  <p className="privacy-note">
                    {t(
                      "Results preserve backend order and show only masked recipients. Outcome pages are loaded directly from this batch; the portal does not store recipient files or expose a batch listing.",
                    )}
                  </p>
                  <div className="action-row">
                    {canView ? (
                      <Button
                        className="button button--secondary"
                        isDisabled={isRefreshing}
                        onPress={onRefresh}
                      >
                        {isRefreshing
                          ? t("Refreshing…")
                          : t("Refresh batch result")}
                      </Button>
                    ) : null}
                    {canView && result.nextCursor ? (
                      <Button
                        className="button button--secondary"
                        isDisabled={isLoadingMore}
                        onPress={onLoadMore}
                      >
                        {isLoadingMore
                          ? t("Loading more…")
                          : t("Load more outcomes")}
                      </Button>
                    ) : null}
                    {canCreate &&
                    result.status === "Completed" &&
                    result.failedItems > 0 ? (
                      <Button
                        className="button button--secondary"
                        isDisabled={isRetrying}
                        onPress={onRetryFailed}
                      >
                        {isRetrying
                          ? t("Starting retry…")
                          : t("Retry failed rows")}
                      </Button>
                    ) : null}
                    {canCreate ? (
                      <Button
                        className="button button--primary"
                        onPress={() => {
                          resetImportDraft();
                          onStartNew();
                        }}
                      >
                        {t("Start another batch")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : !canCreate ? (
                <p className="permission-note">
                  {t(
                    "Creating a batch requires both gift-card issue and distribution permission. The backend enforces both permissions for every request.",
                  )}
                </p>
              ) : (
                <>
                  <nav
                    className="bulk-import-steps"
                    aria-label={t("Bulk upload progress")}
                  >
                    <ol>
                      {(
                        [
                          ["upload", t("Upload")],
                          ["mapping", t("Mapping")],
                          ["repair", t("Repair and review")],
                          ["import", t("Import")],
                        ] as const
                      ).map(([key, label], index) => (
                        <li
                          key={key}
                          className={
                            index < stepIndex
                              ? "is-complete"
                              : index === stepIndex
                                ? "is-current"
                                : ""
                          }
                          aria-current={
                            index === stepIndex ? "step" : undefined
                          }
                        >
                          {index <= stepIndex && index < 3 ? (
                            <Button
                              className="bulk-import-steps__button"
                              onPress={() => {
                                setImportStage(key as ImportStage);
                                setIntent(undefined);
                                setRepairPage(0);
                              }}
                              aria-label={t("Go to {step}", { step: label })}
                            >
                              <span aria-hidden="true">
                                {index < stepIndex ? "✓" : index + 1}
                              </span>
                              {label}
                            </Button>
                          ) : (
                            <>
                              <span aria-hidden="true">{index + 1}</span>
                              {label}
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  </nav>

                  {intent ? (
                    <div
                      className="bulk-batch-review"
                      role="region"
                      aria-label={t("Review bulk gift card batch")}
                    >
                      <p className="card-kicker">
                        {t("Review asynchronous batch")}
                      </p>
                      <h3>{intent.batchReference}</h3>
                      <p className="ownership-warning">
                        {intent.items.length === 1
                          ? t(
                              "Confirming queues the single row below. It settles on its own, so a failure here leaves nothing else to undo.",
                            )
                          : t(
                              "Confirming queues all {count} rows. Each row settles independently, so successful cards remain issued when another row fails.",
                              { count: intent.items.length },
                            )}
                      </p>
                      <ol>
                        {intent.items
                          .slice(
                            reviewPage * reviewPageSize,
                            (reviewPage + 1) * reviewPageSize,
                          )
                          .map((item, pageIndex) => {
                            const index =
                              reviewPage * reviewPageSize + pageIndex;
                            return (
                              <li key={`${item.itemReference}-${index}`}>
                                <h4>
                                  {index + 1}. {item.itemReference}
                                </h4>
                                <dl>
                                  <div>
                                    <dt>{t("Amount")}</dt>
                                    <dd>
                                      {item.currency} {item.amount}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>{t("Recipient")}</dt>
                                    <dd>
                                      {item.contactType === "email"
                                        ? t("Email")
                                        : t("Phone")}{" "}
                                      · {item.recipientContact}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>{t("Valid from")}</dt>
                                    <dd>
                                      {item.validFromUtc
                                        ? formatters.dateTime(item.validFromUtc)
                                        : t("Backend posting time")}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>{t("Expires")}</dt>
                                    <dd>
                                      {formatters.dateTime(item.expiresAtUtc)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>{t("Capabilities")}</dt>
                                    <dd>
                                      {item.isTransferable
                                        ? t("Transferable")
                                        : t("Not transferable")}
                                      {" · "}
                                      {item.isDivisible
                                        ? t("Divisible")
                                        : t("Not divisible")}
                                    </dd>
                                  </div>
                                </dl>
                              </li>
                            );
                          })}
                      </ol>
                      {intent.items.length > reviewPageSize ? (
                        <nav
                          className="pagination"
                          aria-label={t("Batch confirmation pages")}
                        >
                          <Button
                            className="button button--secondary"
                            isDisabled={reviewPage === 0}
                            onPress={() =>
                              setReviewPage((page) => Math.max(0, page - 1))
                            }
                          >
                            {t("Previous")}
                          </Button>
                          <p>
                            {t("Rows {from}–{to} of {total}", {
                              from: reviewPage * reviewPageSize + 1,
                              to: Math.min(
                                (reviewPage + 1) * reviewPageSize,
                                intent.items.length,
                              ),
                              total: intent.items.length,
                            })}
                          </p>
                          <Button
                            className="button button--secondary"
                            isDisabled={
                              (reviewPage + 1) * reviewPageSize >=
                              intent.items.length
                            }
                            onPress={() => setReviewPage((page) => page + 1)}
                          >
                            {t("Next")}
                          </Button>
                        </nav>
                      ) : null}
                      <p className="privacy-note">
                        {t(
                          "Full contacts are shown only for this review and are cleared from the interface after the backend returns its masked result.",
                        )}
                      </p>
                      {createError ? (
                        <p className="error-banner" role="alert">
                          {createError}
                        </p>
                      ) : null}
                      <div className="action-row">
                        <Button
                          className="button button--primary"
                          isDisabled={isCreating}
                          onPress={() => {
                            onCreate(intent);
                          }}
                        >
                          {isCreating
                            ? t("Queueing batch…")
                            : t("Queue entire batch")}
                        </Button>
                        <Button
                          className="button button--secondary"
                          isDisabled={isCreating}
                          onPress={() => {
                            setIntent(undefined);
                          }}
                        >
                          {t("Back to the spreadsheet")}
                        </Button>
                      </div>
                    </div>
                  ) : importStage === "upload" ? (
                    <section
                      className="spreadsheet-import"
                      aria-labelledby="spreadsheet-import-title"
                    >
                      <h3 id="spreadsheet-import-title">
                        {t("Start from a spreadsheet")}
                      </h3>
                      <p className="supporting-copy">
                        {t(
                          "Upload the .xlsx you already keep. It is read in this browser and never sent anywhere; the rows fill the sheet on the next step, where you review them before anything is issued.",
                        )}
                      </p>
                      <div className="bulk-import-rules">
                        <h4>{t("Before you upload")}</h4>
                        <ul>
                          <li>{t("Use an unencrypted .xlsx workbook.")}</li>
                          <li>
                            {t("The first row must contain column headings.")}
                          </li>
                          <li>
                            {t(
                              "Required columns are Amount, Expiry date, and Recipient (email or international phone number).",
                            )}
                          </li>
                          <li>
                            {t("Use no more than {maximum} recipient rows.", {
                              maximum: formatters.number(maximumRows),
                            })}
                          </li>
                          <li>
                            {t(
                              "Date-only values are accepted. Validity starts at 00:00 and expiry ends at 23:59 unless a time is supplied.",
                            )}
                          </li>
                          <li>
                            {t(
                              "A Name column is shown for checking and is discarded; the platform stores no recipient name.",
                            )}
                          </li>
                        </ul>
                      </div>
                      <div className="field spreadsheet-import__file">
                        <label
                          className="field__label"
                          htmlFor="bulk-import-file"
                        >
                          {t("Spreadsheet of recipients")}
                        </label>
                        <input
                          id="bulk-import-file"
                          className="field__input"
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          disabled={isImporting}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            // Cleared so choosing the same file again re-reads
                            // it, which is what someone does after correcting a
                            // row in Excel.
                            event.target.value = "";
                            if (file) {
                              void importWorkbook(file);
                            }
                          }}
                        />
                      </div>
                      {isImporting ? (
                        <p role="status">{t("Reading the workbook…")}</p>
                      ) : null}
                      {importError ? (
                        <p className="error-banner" role="alert">
                          {importError}
                        </p>
                      ) : null}
                      <p className="supporting-copy">
                        {t(
                          "For a single gift card, close this window and use the manual issuance form. You can also enter a small batch by hand.",
                        )}
                      </p>
                      <Button
                        className="button button--secondary"
                        onPress={() => {
                          setImportStage("repair");
                        }}
                      >
                        {t("Enter batch rows manually")}
                      </Button>
                    </section>
                  ) : importStage === "mapping" && pendingImport ? (
                    <section
                      className="bulk-import-mapping"
                      aria-labelledby="mapping-title"
                    >
                      <p className="card-kicker">{t("Step 2")}</p>
                      <h3 id="mapping-title">{t("Confirm column mapping")}</h3>
                      <p className="supporting-copy">
                        {t(
                          "We matched familiar headings automatically. Confirm each field before validating {rows} rows. Optional fields may be left unused.",
                          { rows: pendingImport.grid.length - 1 },
                        )}
                      </p>
                      <div className="data-table__scroll">
                        <table className="data-table bulk-mapping-table">
                          <thead>
                            <tr>
                              <th scope="col">{t("Gift card field")}</th>
                              <th scope="col">{t("Spreadsheet column")}</th>
                              <th scope="col">{t("Sample value")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importFields(t).map((field) => {
                              const column = columnMapping[field.key] ?? -1;
                              const label = field.label;
                              return (
                                <tr key={field.key}>
                                  <th scope="row">
                                    {field.required
                                      ? t("{field} (required)", {
                                          field: label,
                                        })
                                      : label}
                                  </th>
                                  <td>
                                    <select
                                      className="field__input"
                                      aria-label={t("Column for {field}", {
                                        field: label,
                                      })}
                                      value={column}
                                      onChange={(event) => {
                                        setColumnMapping((current) => ({
                                          ...current,
                                          [field.key]: Number(
                                            event.target.value,
                                          ),
                                        }));
                                      }}
                                    >
                                      <option value={-1}>
                                        {t("Not used")}
                                      </option>
                                      {pendingImport.grid[0].map(
                                        (header, index) => (
                                          <option
                                            key={`${header}-${index}`}
                                            value={index}
                                          >
                                            {header ||
                                              t("Column {number}", {
                                                number: index + 1,
                                              })}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </td>
                                  <td>
                                    {column >= 0
                                      ? pendingImport.grid[1]?.[column] || "—"
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {importError ? (
                        <p className="error-banner" role="alert">
                          {importError}
                        </p>
                      ) : null}
                      <div className="action-row">
                        <Button
                          className="button button--secondary"
                          onPress={() => {
                            setImportStage("upload");
                          }}
                        >
                          {t("Back")}
                        </Button>
                        <Button
                          className="button button--primary"
                          onPress={applyColumnMapping}
                        >
                          {t("Validate rows")}
                        </Button>
                      </div>
                    </section>
                  ) : importStage === "repair" ? (
                    <form
                      className="bulk-batch-form"
                      onSubmit={reviewBatch}
                      autoComplete="off"
                      noValidate
                    >
                      {importSummary ? (
                        <div className="spreadsheet-import__summary">
                          <p>
                            {t(
                              "{count} rows read from {file}. They are in the sheet below and nothing has been issued yet.",
                              {
                                count: importSummary.imported,
                                file: importSummary.fileName,
                              },
                            )}
                            {importSummary.needRepair > 0
                              ? ` ${t(
                                  "{count} of them need a correction, marked in the sheet.",
                                  { count: importSummary.needRepair },
                                )}`
                              : ` ${t("Every row passed the file checks.")}`}
                          </p>
                          {importSummary.names.length > 0 ? (
                            <details>
                              <summary>
                                {t("Names read from the file ({count})", {
                                  count: importSummary.names.length,
                                })}
                              </summary>
                              <p className="supporting-copy">
                                {t(
                                  "Shown so you can confirm the right people were matched to the right addresses. Names are not submitted and not stored.",
                                )}
                              </p>
                              <ul>
                                {importSummary.names.map((name, index) => (
                                  <li key={`${name}-${index}`}>{name}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      ) : null}

                      <TextField
                        className="field"
                        isRequired
                        value={batchReference}
                        onChange={setBatchReference}
                      >
                        <Label className="field__label">
                          {t("Batch reference")}
                        </Label>
                        <Input
                          className="field__input"
                          placeholder={t(
                            "Campaign, payroll, or order reference",
                          )}
                        />
                      </TextField>

                      <div
                        className={`bulk-repair-status${problemCount > 0 ? " is-problem" : ""}`}
                        role="status"
                      >
                        <span aria-hidden="true">
                          {problemCount > 0 ? "!" : "✓"}
                        </span>
                        <span>
                          {problemCount > 0
                            ? problemCount === 1
                              ? t("1 row needs a correction before import.")
                              : t(
                                  "{count} rows need a correction before import.",
                                  { count: problemCount },
                                )
                            : readyCount === 0
                              ? t("Add a row to get started.")
                              : readyCount === 1
                                ? t("1 row is ready to import.")
                                : t("{count} rows are ready to import.", {
                                    count: readyCount,
                                  })}
                          {draftTotals.length > 0 ? (
                            <span className="bulk-repair-status__totals">
                              {draftTotals.map((total) => {
                                const available = availableCorporateCredit
                                  ? (availableCorporateCredit.find(
                                      (credit) =>
                                        credit.currency === total.currency,
                                    )?.amount ?? 0)
                                  : undefined;
                                const requested = formatters.money(
                                  total.amount,
                                  total.currency,
                                );
                                if (available === undefined) {
                                  return (
                                    <span key={total.currency}>
                                      {t("{requested} to issue", {
                                        requested,
                                      })}
                                    </span>
                                  );
                                }
                                const short = total.amount > available;
                                return (
                                  <span
                                    key={total.currency}
                                    className={
                                      short ? "is-short" : "is-covered"
                                    }
                                  >
                                    {short
                                      ? t(
                                          "{requested} to issue, over the {available} available",
                                          {
                                            requested,
                                            available: formatters.money(
                                              available,
                                              total.currency,
                                            ),
                                          },
                                        )
                                      : t(
                                          "{requested} to issue, of {available} available",
                                          {
                                            requested,
                                            available: formatters.money(
                                              available,
                                              total.currency,
                                            ),
                                          },
                                        )}
                                  </span>
                                );
                              })}
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <div className="bulk-repair-toolbar">
                        <div className="bulk-repair-toolbar__group">
                          <label className="bulk-page-size">
                            {t("Rows per page")}
                            <select
                              value={repairPageSize}
                              onChange={(event) => {
                                setRepairPageSize(Number(event.target.value));
                                setRepairPage(0);
                              }}
                            >
                              <option value="10">10</option>
                              <option value="25">25</option>
                              <option value="50">50</option>
                              <option value="100">100</option>
                            </select>
                          </label>
                          <Checkbox
                            className="card-checkbox"
                            isSelected={showProblemsOnly}
                            onChange={(selected) => {
                              setShowProblemsOnly(selected);
                              setRepairPage(0);
                            }}
                          >
                            <span
                              className="card-checkbox__box"
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            {t("Only show rows with problems")}
                          </Checkbox>
                        </div>
                        <Button
                          className="button button--secondary"
                          isDisabled={rows.length >= maximumRows}
                          onPress={() => {
                            setRows((current) =>
                              withProblems([...current, newRow()], t),
                            );
                            setShowProblemsOnly(false);
                            setRepairPage(
                              Math.floor(rows.length / repairPageSize),
                            );
                          }}
                        >
                          {t("Add item")}
                        </Button>
                      </div>

                      <div className="bulk-sheet">
                        <div className="bulk-sheet-header" aria-hidden="true">
                          <span>{t("OK")}</span>
                          <span>#</span>
                          <span>{t("Item reference")}</span>
                          <span>{t("Amount")}</span>
                          <span>{t("Currency")}</span>
                          <span>{t("Valid from")}</span>
                          <span>{t("Time")}</span>
                          <span>{t("Expires")}</span>
                          <span>{t("Time")}</span>
                          <span>{t("Recipient")}</span>
                          <span>{t("Capabilities")}</span>
                          <span>
                            <span className="visually-hidden">
                              {t("Remove")}
                            </span>
                          </span>
                        </div>
                        <div className="bulk-batch-rows">
                          {pageRows.length === 0 ? (
                            <div className="bulk-sheet-empty">
                              <p>
                                {showProblemsOnly
                                  ? t("No rows with problems.")
                                  : t("No rows yet.")}
                              </p>
                              {/* Repairing the last marked row otherwise
                                  leaves the reader looking at an empty sheet
                                  with no hint that the batch is fine. */}
                              {showProblemsOnly ? (
                                <Button
                                  className="button button--secondary"
                                  onPress={() => {
                                    setShowProblemsOnly(false);
                                    setRepairPage(0);
                                  }}
                                >
                                  {t("Show all rows")}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          {pageRows.map((row, pageIndex) => {
                            const index =
                              currentRepairPage * repairPageSize + pageIndex;
                            // The channel is read from the value rather than
                            // asked for: a sheet mixing addresses and numbers
                            // in one column is the normal case, and the backend
                            // is told whatever the value actually is.
                            const contact = classifyContact(
                              row.recipientContact,
                            );
                            const blank = isBlankRow(row);
                            const rowNumber = index + 1;
                            return (
                              <fieldset
                                className={`bulk-batch-row${
                                  row.issue
                                    ? blank
                                      ? " is-blank"
                                      : " is-problem"
                                    : ""
                                }`}
                                key={row.key}
                              >
                                <legend>
                                  {t("Item {number}", { number: rowNumber })}
                                </legend>
                                <div className="bulk-batch-row__fields">
                                  <span
                                    className={`bulk-row-status${
                                      row.issue
                                        ? blank
                                          ? " is-blank"
                                          : " is-problem"
                                        : ""
                                    }`}
                                    aria-hidden="true"
                                  >
                                    {row.issue ? (blank ? "·" : "!") : "✓"}
                                  </span>
                                  <span className="bulk-row-number">
                                    {rowNumber}
                                  </span>
                                  <TextField
                                    className="field"
                                    isRequired
                                    value={row.itemReference}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        itemReference: value,
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t("Item reference")}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      placeholder="BENEFIT-001"
                                    />
                                  </TextField>
                                  <TextField
                                    className="field"
                                    isRequired
                                    value={row.amount}
                                    onChange={(value) => {
                                      updateRow(row.key, { amount: value });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t("Amount")}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      inputMode="decimal"
                                      placeholder="250.00"
                                    />
                                  </TextField>
                                  <TextField
                                    className="field"
                                    isRequired
                                    value={row.currency}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        currency: value.toUpperCase(),
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t("Currency")}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      maxLength={3}
                                    />
                                  </TextField>
                                  <TextField
                                    className="field"
                                    value={datePart(row.validFrom)}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        validFrom: withDate(
                                          row.validFrom,
                                          value,
                                        ),
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t("Valid from date (optional)")}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      type="date"
                                    />
                                  </TextField>
                                  <TextField
                                    className="field"
                                    value={timePart(row.validFrom)}
                                    isDisabled={!datePart(row.validFrom)}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        validFrom: withTime(
                                          row.validFrom,
                                          value,
                                        ),
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t(
                                        "Valid from time (optional; defaults to 00:00)",
                                      )}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      type="time"
                                    />
                                  </TextField>
                                  <TextField
                                    className="field"
                                    isRequired
                                    value={datePart(row.expiresAt)}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        expiresAt: withDate(
                                          row.expiresAt,
                                          value,
                                        ),
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t("Expiry date")}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      type="date"
                                    />
                                  </TextField>
                                  <TextField
                                    className="field"
                                    value={timePart(row.expiresAt)}
                                    isDisabled={!datePart(row.expiresAt)}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        expiresAt: withTime(
                                          row.expiresAt,
                                          value,
                                        ),
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {t(
                                        "Expiry time (optional; defaults to 23:59)",
                                      )}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      type="time"
                                    />
                                  </TextField>
                                  <TextField
                                    className="field bulk-row-recipient"
                                    isRequired
                                    value={row.recipientContact}
                                    onChange={(value) => {
                                      updateRow(row.key, {
                                        recipientContact: value,
                                      });
                                    }}
                                  >
                                    <Label className="field__label">
                                      {contact?.type === "phone"
                                        ? t("Recipient phone (E.164)")
                                        : t("Recipient email")}
                                    </Label>
                                    <Input
                                      className="field__input"
                                      inputMode={
                                        contact?.type === "phone"
                                          ? "tel"
                                          : "email"
                                      }
                                      placeholder="recipient@example.com"
                                    />
                                    {contact ? (
                                      <span
                                        className="bulk-row-channel"
                                        aria-hidden="true"
                                      >
                                        {contact.type === "phone"
                                          ? t("SMS")
                                          : t("Email")}
                                      </span>
                                    ) : null}
                                  </TextField>
                                  <fieldset className="card-capabilities bulk-row-capabilities">
                                    <legend>{t("Card capabilities")}</legend>
                                    <Checkbox
                                      className="card-checkbox"
                                      isSelected={row.isTransferable}
                                      onChange={(value) => {
                                        updateRow(row.key, {
                                          isTransferable: value,
                                        });
                                      }}
                                    >
                                      <span
                                        className="card-checkbox__box"
                                        aria-hidden="true"
                                      >
                                        ✓
                                      </span>
                                      {t("Transferable")}
                                    </Checkbox>
                                    <Checkbox
                                      className="card-checkbox"
                                      isSelected={row.isDivisible}
                                      onChange={(value) => {
                                        updateRow(row.key, {
                                          isDivisible: value,
                                        });
                                      }}
                                    >
                                      <span
                                        className="card-checkbox__box"
                                        aria-hidden="true"
                                      >
                                        ✓
                                      </span>
                                      {t("Divisible")}
                                    </Checkbox>
                                  </fieldset>
                                  <Button
                                    className="bulk-batch-row__remove"
                                    isDisabled={rows.length <= 1}
                                    aria-label={t("Remove row {number}", {
                                      number: rowNumber,
                                    })}
                                    onPress={() => {
                                      setRows((current) =>
                                        withProblems(
                                          current.filter(
                                            (candidate) =>
                                              candidate.key !== row.key,
                                          ),
                                          t,
                                        ),
                                      );
                                    }}
                                  >
                                    <span aria-hidden="true">✕</span>
                                  </Button>
                                  {row.issue ? (
                                    <p className="bulk-row-error">
                                      {row.issue}
                                    </p>
                                  ) : null}
                                </div>
                              </fieldset>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bulk-sheet-footer">
                        <p>
                          {visibleRows.length === 0
                            ? t("Showing no rows")
                            : t("Showing {from}–{to} of {total} rows", {
                                from: currentRepairPage * repairPageSize + 1,
                                to: Math.min(
                                  (currentRepairPage + 1) * repairPageSize,
                                  visibleRows.length,
                                ),
                                total: visibleRows.length,
                              })}
                        </p>
                        <nav aria-label={t("Imported row pages")}>
                          <Button
                            className="button button--secondary"
                            isDisabled={currentRepairPage === 0}
                            onPress={() =>
                              setRepairPage(Math.max(0, currentRepairPage - 1))
                            }
                          >
                            {t("Previous")}
                          </Button>
                          <p>
                            {t("Page {page} of {pages}", {
                              page: currentRepairPage + 1,
                              pages: pageCount,
                            })}
                          </p>
                          <Button
                            className="button button--secondary"
                            isDisabled={currentRepairPage + 1 >= pageCount}
                            onPress={() => setRepairPage(currentRepairPage + 1)}
                          >
                            {t("Next")}
                          </Button>
                        </nav>
                      </div>

                      {validationError ? (
                        <p className="error-banner" role="alert">
                          {validationError}
                        </p>
                      ) : null}
                      <p className="privacy-note">
                        {t(
                          "Contacts remain only in this form and its review. XLSX files are read locally in the browser; CSV is out of scope, and no recipient file or display name is uploaded or retained.",
                        )}
                      </p>
                      <div className="action-row">
                        <Button
                          className="button button--primary"
                          type="submit"
                        >
                          {t("Review entire batch")}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </>
              )}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </section>
  );
}
