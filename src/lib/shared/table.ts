export interface TableColumn<T> {
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  shrinkPriority?: number;
  wrap?: boolean;
  maxLines?: number;
  align?: "left" | "right";
  value: (row: T) => string | number | null | undefined;
}

export interface TableRenderOptions {
  maxWidth?: number;
}

const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
];

const intlWithSegmenter = Intl as typeof Intl & {
  Segmenter?: new (
    locales?: string | string[],
    options?: { granularity?: "grapheme" | "word" | "sentence" },
  ) => { segment: (input: string) => Iterable<{ segment: string }> };
};

function splitGraphemes(value: string): string[] {
  if (typeof intlWithSegmenter.Segmenter !== "function") {
    return Array.from(value);
  }
  const segmenter = new intlWithSegmenter.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value), (entry) => entry.segment);
}

function isWideCodePoint(codePoint: number): boolean {
  return WIDE_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function graphemeWidth(grapheme: string): number {
  if (!grapheme || /^\p{Mark}+$/u.test(grapheme)) {
    return 0;
  }
  if (/\p{Extended_Pictographic}/u.test(grapheme)) {
    return 2;
  }
  for (const symbol of Array.from(grapheme)) {
    const codePoint = symbol.codePointAt(0);
    if (codePoint !== undefined && isWideCodePoint(codePoint)) {
      return 2;
    }
  }
  return 1;
}

function displayWidth(value: string): number {
  return splitGraphemes(value).reduce((sum, grapheme) => sum + graphemeWidth(grapheme), 0);
}

function normalizeValue(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function truncateToWidth(value: string, maxWidth: number): string {
  if (displayWidth(value) <= maxWidth) {
    return value;
  }
  if (maxWidth <= 3) {
    return ".".repeat(maxWidth);
  }
  const targetWidth = maxWidth - 3;
  let currentWidth = 0;
  const parts: string[] = [];
  for (const grapheme of splitGraphemes(value)) {
    const width = graphemeWidth(grapheme);
    if (currentWidth + width > targetWidth) {
      break;
    }
    parts.push(grapheme);
    currentWidth += width;
  }
  return `${parts.join("")}...`;
}

function padToWidth(value: string, width: number, align: "left" | "right"): string {
  const clipped = truncateToWidth(value, width);
  const padding = Math.max(0, width - displayWidth(clipped));
  return align === "right"
    ? `${" ".repeat(padding)}${clipped}`
    : `${clipped}${" ".repeat(padding)}`;
}

function wrapToWidth(value: string, width: number): string[] {
  if (value.length === 0) {
    return [""];
  }
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;
  for (const grapheme of splitGraphemes(value)) {
    const nextWidth = graphemeWidth(grapheme);
    if (currentWidth > 0 && currentWidth + nextWidth > width) {
      lines.push(current);
      current = grapheme;
      currentWidth = nextWidth;
      continue;
    }
    current += grapheme;
    currentWidth += nextWidth;
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function renderCellLines(
  value: string | number | null | undefined,
  column: TableColumn<unknown>,
): string[] {
  const width = column.width ?? 1;
  const align = column.align ?? "left";
  if (!column.wrap) {
    return [padToWidth(normalizeValue(value), width, align)];
  }
  const wrapped = wrapToWidth(normalizeValue(value), width);
  const maxLines = Math.max(1, column.maxLines ?? wrapped.length);
  let lines = wrapped.slice(0, maxLines);
  if (wrapped.length > maxLines) {
    lines[maxLines - 1] =
      width <= 3 ? ".".repeat(width) : `${truncateToWidth(lines[maxLines - 1], width - 3)}...`;
  }
  return lines.map((line) => padToWidth(line, width, align));
}

function tableWidth(columns: TableColumn<unknown>[]): number {
  return columns.reduce((sum, column) => sum + (column.width ?? 1), 0) + columns.length * 3 + 1;
}

function renderBorder(
  columns: TableColumn<unknown>[],
  left: string,
  join: string,
  right: string,
): string {
  return left + columns.map((column) => "─".repeat((column.width ?? 1) + 2)).join(join) + right;
}

function shrinkToFit(columns: TableColumn<unknown>[], maxWidth: number): void {
  if (tableWidth(columns) <= maxWidth) {
    return;
  }
  const sortedIndexes = columns
    .map((column, index) => ({ index, priority: column.shrinkPriority ?? 0 }))
    .sort((a, b) => b.priority - a.priority)
    .map((entry) => entry.index);
  while (tableWidth(columns) > maxWidth) {
    let shrunk = false;
    for (const index of sortedIndexes) {
      const column = columns[index];
      const minWidth =
        column.minWidth ?? Math.max(4, Math.min(column.width ?? 4, displayWidth(column.header)));
      const currentWidth = column.width ?? minWidth;
      if (currentWidth <= minWidth) {
        continue;
      }
      column.width = currentWidth - 1;
      shrunk = true;
      if (tableWidth(columns) <= maxWidth) {
        return;
      }
    }
    if (!shrunk) {
      return;
    }
  }
}

function resolveColumnWidths<T>(columns: TableColumn<T>[], rows: T[]): TableColumn<unknown>[] {
  return columns.map((column) => {
    if (typeof column.width === "number" && Number.isFinite(column.width)) {
      return { ...column } as TableColumn<unknown>;
    }
    const minWidth = Math.max(1, column.minWidth ?? displayWidth(column.header));
    const maxWidth = Math.max(minWidth, column.maxWidth ?? Number.MAX_SAFE_INTEGER);
    let width = displayWidth(column.header);
    for (const row of rows) {
      width = Math.max(width, displayWidth(normalizeValue(column.value(row))));
      if (width >= maxWidth) {
        width = maxWidth;
        break;
      }
    }
    return {
      ...column,
      width: Math.max(minWidth, Math.min(maxWidth, width)),
    } as TableColumn<unknown>;
  });
}

export function renderTable<T>(
  columns: TableColumn<T>[],
  rows: T[],
  options: TableRenderOptions = {},
): string[] {
  const unknownColumns = resolveColumnWidths(columns, rows);
  if (
    typeof options.maxWidth === "number" &&
    Number.isFinite(options.maxWidth) &&
    options.maxWidth >= 20
  ) {
    shrinkToFit(unknownColumns, Math.floor(options.maxWidth));
  }
  const lines: string[] = [];
  lines.push(renderBorder(unknownColumns, "┌", "┬", "┐"));
  lines.push(
    `│ ${unknownColumns.map((column) => padToWidth(column.header, column.width ?? 1, "left")).join(" │ ")} │`,
  );
  lines.push(renderBorder(unknownColumns, "├", "┼", "┤"));
  for (const row of rows) {
    const renderedCells = unknownColumns.map((column) =>
      renderCellLines(column.value(row), column),
    );
    const rowHeight = renderedCells.reduce((max, cellLines) => Math.max(max, cellLines.length), 1);
    for (let lineIndex = 0; lineIndex < rowHeight; lineIndex += 1) {
      lines.push(
        `│ ${unknownColumns
          .map(
            (column, columnIndex) =>
              renderedCells[columnIndex][lineIndex] ?? " ".repeat(column.width ?? 1),
          )
          .join(" │ ")} │`,
      );
    }
  }
  lines.push(renderBorder(unknownColumns, "└", "┴", "┘"));
  return lines;
}
