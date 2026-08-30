import * as XLSX from "xlsx";

export function generateXlsx(title: string, data: Record<string, unknown>[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  // Sheet names are capped at 31 chars and can't contain : \ / ? * [ ] —
  // titles come from agent replies (e.g. "Q1/Q2 Plan"), which routinely do.
  const sheetName = (title || "Sheet1").replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet1";
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
