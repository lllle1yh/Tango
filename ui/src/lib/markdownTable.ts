// 搬自 T3 的 markdown-clipboard：把消息里的表格复制成 Markdown / CSV / HTML。
// 公式在 Tango 里就是一串文本，所以取单元格文字即可。

export type TableCopyFormat = "markdown" | "csv" | "html";

function rowsOf(table: Element): Element[] {
  return [...table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr")];
}

function cellsOf(row: Element): Element[] {
  return [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD");
}

function csvCell(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\s+/g, " ").trim().replaceAll("|", "\\|");
}

export function serializeTableToMarkdown(table: Element): string {
  const rows = rowsOf(table).map((row) => cellsOf(row).map((cell) => escapeMarkdownCell(cell.textContent ?? "")));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((cells) => cells.length));
  const pad = (cells: string[]) => [...cells, ...Array(width - cells.length).fill("")];
  const header = pad(rows[0]!);
  const body = rows.slice(1).map(pad);
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((cells) => `| ${cells.join(" | ")} |`),
  ].join("\n");
}

export function serializeTableToCsv(table: Element): string {
  return rowsOf(table)
    .map((row) => cellsOf(row).map((cell) => csvCell(cell.textContent ?? "")))
    .filter((cells) => cells.length > 0)
    .map((cells) => cells.join(","))
    .join("\n");
}

export function serializeTableToHtml(table: Element): string {
  // 行内样式：邮件与富文本编辑器会丢掉样式表，深色主题下复制的表格也要在白底上能读。
  const style = "border-collapse:collapse";
  const cellStyle = "border:1px solid #d4d4d8;padding:4px 8px;text-align:left";
  const headStyle = `${cellStyle};background:#f4f4f5;font-weight:600`;
  const sections: string[] = [];
  const head = table.querySelector(":scope > thead");
  if (head) {
    sections.push(
      `<thead>${rowsOf(head).map((row) => `<tr>${cellsOf(row).map((cell) => `<th style="${headStyle}">${inlineHtml(cell)}</th>`).join("")}</tr>`).join("")}</thead>`,
    );
  }
  const loose = rowsOf(table).filter((row) => !head?.contains(row));
  if (loose.length) {
    sections.push(
      `<tbody>${loose.map((row) => `<tr>${cellsOf(row).map((cell) => `<td style="${cellStyle}">${inlineHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    );
  }
  return `<table style="${style}">${sections.join("")}</table>`;
}

function inlineHtml(element: Element): string {
  const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escape((element.textContent ?? "").replace(/\s+/g, " ").trim());
}

export function serializeTable(table: Element, format: TableCopyFormat): string {
  if (format === "csv") return serializeTableToCsv(table);
  if (format === "html") return serializeTableToHtml(table);
  return serializeTableToMarkdown(table);
}
