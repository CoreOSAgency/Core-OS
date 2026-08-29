import * as XLSX from "xlsx";

export function generateXlsx(title: string, data: Record<string, unknown>[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  // Sheet names are capped at 31 chars by the xlsx format.
  XLSX.utils.book_append_sheet(workbook, worksheet, (title || "Sheet1").slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
