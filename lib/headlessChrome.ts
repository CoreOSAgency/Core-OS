// Serverless Chrome launch, shared by the deck PDF export (and the now-idle
// screenshot QA path). puppeteer-core + @sparticuz/chromium is the standard
// pairing for headless Chrome inside a Vercel function.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;

export async function launchHeadlessBrowser(): Promise<Browser> {
  const chromiumMod = await import("@sparticuz/chromium");
  const chromium = (chromiumMod.default ?? chromiumMod) as {
    args: string[];
    executablePath: () => Promise<string>;
    setGraphicsMode?: boolean;
  };
  const puppeteer = await import("puppeteer-core");

  if (typeof chromium.setGraphicsMode !== "undefined") chromium.setGraphicsMode = false;

  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
