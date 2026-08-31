import { NextResponse } from "next/server";
import { getDeckByShareToken } from "@/lib/decks";
import { launchHeadlessBrowser } from "@/lib/headlessChrome";
import { slugifyFilename } from "@/lib/documentGenerators";

export const runtime = "nodejs";
export const maxDuration = 60;

// PDF export = the deck's own public viewer route, rendered by headless Chrome
// in print mode and captured with page.pdf(). Same render the viewer shows,
// one slide per page - not a third representation.
export async function GET(
  request: Request,
  { params }: { params: { shareToken: string } },
) {
  const deck = await getDeckByShareToken(params.shareToken);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const viewerUrl = `${origin}/decks/${params.shareToken}?print=1`;

  let browser;
  try {
    browser = await launchHeadlessBrowser();
    const page = await browser.newPage();
    await page.goto(viewerUrl, { waitUntil: "networkidle0", timeout: 30_000 });
    await page
      .waitForFunction("window.__deckReady === true", { timeout: 5_000 })
      .catch(() => {});
    const pdf = await page.pdf({
      width: "960px",
      height: "540px",
      printBackground: true,
      pageRanges: "",
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slugifyFilename(deck.title)}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF export failed" },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
