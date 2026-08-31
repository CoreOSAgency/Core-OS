import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  AlignmentType,
} from "docx";
import {
  parseMarkdownToBlocks,
  parseInlineRuns,
  stripInlineMarkdown,
} from "./markdownToBlocks";
import { fetchImageForExport, normalizeHex, type ExportImage } from "./imageForExport";

export type DocumentInput = {
  title: string;
  content: string;
  projectName?: string;
  agentName?: string;
  logoUrl?: string;
  accentColor?: string;
};

const NEUTRAL_ACCENT_HEX = "6B7280"; // slate gray - the brand-free default

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

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);

function hexToRgb(hex: string) {
  const n = parseInt(hex, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// A client-facing doc carries the client's logo (or nothing) in the header,
// never CoreOS's mark.
function docxHeader(logo: ExportImage | null): Header {
  const children = logo
    ? [
        new ImageRun({
          type: logo.mime === "image/png" ? "png" : "jpg",
          data: logo.bytes,
          transformation: {
            height: 24,
            width: Math.round((24 * logo.width) / logo.height),
          },
        }),
      ]
    : [];
  return new Header({ children: [new Paragraph({ children })] });
}

function docxFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            color: "999999",
            size: 16,
          }),
        ],
      }),
    ],
  });
}

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
  logoUrl,
  accentColor,
}: DocumentInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accentHex = normalizeHex(accentColor) ?? NEUTRAL_ACCENT_HEX;
  const ACCENT = hexToRgb(accentHex);

  const logo = logoUrl ? await fetchImageForExport(logoUrl) : null;
  const logoImg = logo
    ? logo.mime === "image/png"
      ? await doc.embedPng(logo.bytes).catch(() => null)
      : await doc.embedJpg(logo.bytes).catch(() => null)
    : null;

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

  // Header - the client's logo if the project has one, otherwise nothing.
  if (logoImg) {
    const h = 22;
    const w = (h * logoImg.width) / logoImg.height;
    page.drawImage(logoImg, { x: MARGIN, y: y - h + 6, width: w, height: h });
    y -= 30;
  }
  drawLines(wrapText(cleanPdfText(title), bold, 20, CONTENT_WIDTH), 20, bold, INK, 6);
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
  logoUrl,
  accentColor,
}: DocumentInput): Promise<Buffer> {
  const blocks = parseMarkdownToBlocks(content);
  const accentHex = normalizeHex(accentColor) ?? NEUTRAL_ACCENT_HEX;
  const logo = logoUrl ? await fetchImageForExport(logoUrl) : null;
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, color: "111111" })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: accentHex, space: 8 },
      },
    }),
  );

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
    title,
    sections: [
      {
        headers: { default: docxHeader(logo) },
        footers: { default: docxFooter() },
        children,
      },
    ],
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
