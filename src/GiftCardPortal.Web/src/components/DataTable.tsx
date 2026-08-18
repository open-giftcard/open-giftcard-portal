import type { ReactNode } from "react";
import { useTranslation } from "../i18n/translate";

/**
 * One column of a data table.
 *
 * `numeric` is not styling for its own sake: money and counts are right
 * aligned with tabular figures so a column of amounts can be scanned for the
 * outlier, which is the whole reason a finance surface is a table rather than
 * a list of cards.
 */
export type DataTableColumn<TRow> = {
  readonly key: string;
  readonly header: string;
  readonly render: (row: TRow) => ReactNode;
  readonly numeric?: boolean;
  /** Kept out of the narrow-screen stack, for values that only add noise there. */
  readonly secondary?: boolean;
};

export type DataTableProps<TRow> = {
  /** Describes the table to a screen reader. Required, not decorative. */
  readonly caption: string;
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly rows: readonly TRow[];
  readonly rowKey: (row: TRow) => string;
  /** Rendered in its own trailing column when present. */
  readonly rowAction?: (row: TRow) => ReactNode;
  readonly emptyMessage?: string;
};

/**
 * A real table for tabular data.
 *
 * The portal previously rendered every record as a card with a definition
 * list. That loses column alignment, so comparing amounts across rows becomes
 * a memory exercise instead of a glance, and it costs roughly a screen of
 * vertical space per record.
 *
 * Below 60rem the table restyles itself into stacked blocks through CSS alone,
 * using each cell's `data-label`. The markup stays a table in both cases, so
 * the row and column relationships a screen reader depends on survive the
 * narrow layout rather than being thrown away with it.
 */
export function DataTable<TRow>({
  caption,
  columns,
  rows,
  rowKey,
  rowAction,
  emptyMessage,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();
  const actionsHeader = t("Actions");

  if (rows.length === 0) {
    return (
      <p className="data-table__empty" role="status">
        {emptyMessage ?? t("No records match the current filters.")}
      </p>
    );
  }

  return (
    <div className="data-table__scroll">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.numeric ? "data-table__numeric" : undefined}
              >
                {column.header}
              </th>
            ))}
            {rowAction ? (
              <th scope="col">
                <span className="visually-hidden">{actionsHeader}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  className={
                    [
                      column.numeric ? "data-table__numeric" : "",
                      column.secondary ? "data-table__secondary" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                >
                  {column.render(row)}
                </td>
              ))}
              {rowAction ? (
                <td data-label={actionsHeader} className="data-table__action">
                  {rowAction(row)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
