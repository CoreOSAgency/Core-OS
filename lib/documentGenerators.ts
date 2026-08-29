import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import {
  parseMarkdownToBlocks,
  parseInlineRuns,
  stripInlineMarkdown,
} from "./markdownToBlocks";

export type DocumentInput = {
  title: string;
  content: string;
  projectName?: string;
  agentName?: string;
};

// pdf-lib's standard fonts only encode WinAnsi (~Latin-1 + a few extras) —
// they throw on anything outside that (emoji, ⚠, arrows, etc.), which
// Gemini's replies routinely include. Word/docx has no such limit, so this
// is PDF-only. Every non-Latin-1 character — including each UTF-16
// surrogate half of an emoji — is outside \x00-\xFF, so this one pass
// strips emoji and other unencodable symbols without needing the `u` flag.
function sanitizeForPdf(text: string): string {
  return text.replace(/[^\x00-\xFF]/g, "");
}

function cleanPdfText(text: string): string {
  return sanitizeForPdf(stripInlineMarkdown(text));
}

// CoreOS brand accent (emerald-500, same as the app UI) as 0–1 RGB.
const ACCENT = rgb(0x10 / 255, 0xb9 / 255, 0x81 / 255);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function generatePdf({
  title,
  content,
  projectName,
  agentName,
}: DocumentInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage();
  }

  function drawLines(
    lines: string[],
    size: number,
    useFont: PDFFont,
    color = INK,
    lineGap = 4,
    indent = 0
  ) {
    for (const line of lines) {
      ensureSpace(size + lineGap);
      page.drawText(line, { x: MARGIN + indent, y, size, font: useFont, color });
      y -= size + lineGap;
    }
  }

  // Header
  page.drawText("CoreOS", { x: MARGIN, y, size: 10, font: bold, color: ACCENT });
  y -= 26;
  drawLines(wrapText(cleanPdfText(title), bold, 20, CONTENT_WIDTH), 20, bold, INK, 6);
  const subtitle = [agentName && `by ${agentName}`, projectName]
    .filter(Boolean)
    .join(" — ");
  if (subtitle) {
    y -= 2;
    drawLines([subtitle], 10, font, MUTED, 4);
  }
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: ACCENT,
  });
  y -= 20;

  for (const block of parseMarkdownToBlocks(content)) {
    if (block.type === "heading") {
      const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
      ensureSpace(size + 14);
      y -= 6;
      drawLines(
        wrapText(cleanPdfText(block.text), bold, size, CONTENT_WIDTH),
        size,
        bold,
        INK,
        5
      );
      y -= 2;
    } else if (block.type === "paragraph") {
      drawLines(
        wrapText(cleanPdfText(block.text), font, 11, CONTENT_WIDTH),
        11,
        font,
        INK,
        5
      );
      y -= 8;
    } else if (block.type === "bullet" || block.type === "numbered") {
      block.items.forEach((item, idx) => {
        const prefix = block.type === "bullet" ? "•  " : `${idx + 1}.  `;
        const lines = wrapText(
          cleanPdfText(item),
          font,
          11,
          CONTENT_WIDTH - 16
        );
        lines.forEach((line, i) => {
          ensureSpace(11 + 5);
          page.drawText(i === 0 ? prefix + line : line, {
            x: MARGIN + 16,
            y,
            size: 11,
            font,
            color: INK,
          });
          y -= 16;
        });
      });
      y -= 6;
    } else if (block.type === "table") {
      const colWidth = CONTENT_WIDTH / block.headers.length;
      ensureSpace(20);
      block.headers.forEach((h, ci) => {
        page.drawText(cleanPdfText(h), {
          x: MARGIN + ci * colWidth,
          y,
          size: 10,
          font: bold,
          color: INK,
        });
      });
      y -= 6;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: MUTED,
      });
      y -= 14;
      for (const row of block.rows) {
        ensureSpace(16);
        row.forEach((cell, ci) => {
          page.drawText(cleanPdfText(cell), {
            x: MARGIN + ci * colWidth,
            y,
            size: 10,
            font,
            color: INK,
          });
        });
        y -= 16;
      }
      y -= 8;
    }
  }

  return doc.save();
}

export async function generateDocx({
  title,
  content,
  projectName,
  agentName,
}: DocumentInput): Promise<Buffer> {
  const blocks = parseMarkdownToBlocks(content);
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  );
  const subtitle = [agentName && `by ${agentName}`, projectName]
    .filter(Boolean)
    .join(" — ");
  if (subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: subtitle, italics: true, color: "666666" })],
        spacing: { after: 200 },
      })
    );
  }

  const headingLevel = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;

  for (const block of blocks) {
    if (block.type === "heading") {
      children.push(
        new Paragraph({ text: block.text, heading: headingLevel[block.level] })
      );
    } else if (block.type === "paragraph") {
      children.push(
        new Paragraph({
          children: parseInlineRuns(block.text).map(
            (r) => new TextRun({ text: r.text, bold: r.bold })
          ),
          spacing: { after: 160 },
        })
      );
    } else if (block.type === "bullet") {
      for (const item of block.items) {
        children.push(
          new Paragraph({
            children: parseInlineRuns(item).map(
              (r) => new TextRun({ text: r.text, bold: r.bold })
            ),
            bullet: { level: 0 },
          })
        );
      }
    } else if (block.type === "numbered") {
      block.items.forEach((item, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. ` }),
              ...parseInlineRuns(item).map(
                (r) => new TextRun({ text: r.text, bold: r.bold })
              ),
            ],
          })
        );
      });
    } else if (block.type === "table") {
      const headerRow = new TableRow({
        children: block.headers.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            })
        ),
      });
      const rows = block.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({ children: [new Paragraph({ text: cell })] })
            ),
          })
      );
      children.push(
        new Table({
          rows: [headerRow, ...rows],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({
    creator: agentName ?? "CoreOS",
    title,
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

export function slugifyFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "document"
  );
}
