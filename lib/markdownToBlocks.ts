// Turns the agent's markdown reply into structured blocks that the PDF,
// DOCX, and (later) PPTX generators can each render in their own way,
// instead of each parsing markdown itself.

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type InlineRun = { text: string; bold: boolean };

// Splits "some **bold** text" into runs so renderers that support rich text
// (docx) can render real bold, without needing a full markdown parser.
export function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false });
  }
  return runs.length > 0 ? runs : [{ text, bold: false }];
}

// Plain-text fallback for renderers (pdf-lib) that don't do inline styling.
export function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(line) && line.includes("-");
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseMarkdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      i++;
      continue;
    }

    if (isTableRow(line) && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "bullet", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "numbered", items });
      continue;
    }

    // Paragraph: collect contiguous non-blank, non-special lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") });
    }
  }

  return blocks;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// "Label: value, Label2: value2" — the shape agents fall into for lead
// lists etc. when they don't reach for an actual markdown table.
function parseListItemFields(item: string): Record<string, string> | null {
  const pattern = /([A-Za-z][A-Za-z0-9 ]{1,30}):\s*([^,]+?)(?:,\s*(?=[A-Za-z][A-Za-z0-9 ]{1,30}:)|$)/g;
  const fields: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(item))) {
    fields[match[1].trim()] = match[2].trim();
  }
  return Object.keys(fields).length >= 2 ? fields : null;
}

// Pulls tabular data out of a reply for the spreadsheet export: a real
// markdown table first, falling back to a bullet/numbered list where every
// item shares the same "Label: value" fields.
export function extractTableData(markdown: string): Record<string, string>[] | null {
  const blocks = parseMarkdownToBlocks(markdown);

  const table = blocks.find((b) => b.type === "table" && b.rows.length > 0);
  if (table && table.type === "table") {
    return table.rows.map((row) =>
      Object.fromEntries(table.headers.map((h, i) => [h || `Column ${i + 1}`, row[i] ?? ""]))
    );
  }

  const list = blocks.find(
    (b) => (b.type === "bullet" || b.type === "numbered") && b.items.length >= 3
  );
  if (list && (list.type === "bullet" || list.type === "numbered")) {
    const parsed = list.items.map(parseListItemFields);
    if (parsed.every((p): p is Record<string, string> => p !== null)) {
      const keyCount = Object.keys(parsed[0]).length;
      if (parsed.every((p) => Object.keys(p).length === keyCount)) return parsed;
    }
  }

  return null;
}

export type Slide = { heading: string; bullets: string[] };

// Headings become slide breaks; everything under a heading (paragraphs,
// list items, table rows) becomes that slide's bullets.
export function parseMarkdownToSlides(markdown: string): Slide[] {
  const blocks = parseMarkdownToBlocks(markdown);
  const slides: Slide[] = [];
  let current: Slide | null = null;

  const ensureCurrent = () => {
    if (!current) current = { heading: "Overview", bullets: [] };
    return current;
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      if (current) slides.push(current);
      current = { heading: stripInlineMarkdown(block.text), bullets: [] };
    } else if (block.type === "bullet" || block.type === "numbered") {
      ensureCurrent().bullets.push(...block.items.map(stripInlineMarkdown));
    } else if (block.type === "paragraph") {
      ensureCurrent().bullets.push(stripInlineMarkdown(block.text));
    } else if (block.type === "table") {
      ensureCurrent().bullets.push(...block.rows.map((r) => r.join(" — ")));
    }
  }
  if (current) slides.push(current);

  return slides.length > 0
    ? slides
    : [{ heading: "Overview", bullets: [stripInlineMarkdown(markdown).slice(0, 400)] }];
}

// Two or more headings reads as real slide structure, not just one aside
// with a header stuck on it.
export function hasSlideStructure(text: string): boolean {
  return (text.match(/^#{1,3}\s/gm) ?? []).length >= 2;
}

export function hasStructuredContent(text: string): boolean {
  const lines = text.split("\n");
  const listLines = lines.filter((l) => /^\s*([-*]|\d+\.)\s+/.test(l)).length;
  return (
    /^#{1,3}\s/m.test(text) || // headers
    listLines >= 3 || // a real list, not one stray "- " in prose
    /^\s*\|.*\|\s*$/m.test(text) // a table
  );
}
