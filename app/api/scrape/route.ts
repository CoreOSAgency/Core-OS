import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext, saveProjectContext } from "@/lib/projects";

// ponytail: colours come from a static HTML/CSS regex scan, not a rendered
// DOM (that would need a headless browser like Puppeteer). Good enough to
// seed brand colours from most sites' inline <style> blocks; upgrade to a
// real render if sites with only external stylesheets need it.
const NEAR_MONO = new Set([
  "#fff", "#ffffff", "#000", "#000000", "#fafafa", "#f5f5f5",
]);

function extractColours(html: string): string[] {
  const matches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const raw of matches) {
    const hex = raw.toLowerCase();
    if (NEAR_MONO.has(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hex]) => hex);
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function saturation(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// Guesses which detected colour plays which brand role: darkest genuinely-dark
// colour is the background, the two most vivid mid-tone colours are primary and
// accent. Rough, but it means a site scan actually populates the brand kit the
// generators read - the user refines it in the Brand Identity panel.
function pickBrandRoles(colours: string[]): {
  primary_color?: string;
  accent_color?: string;
  background_color?: string;
} {
  const dark = colours
    .filter((c) => luminance(c) < 0.16)
    .sort((a, b) => luminance(a) - luminance(b));
  const vivid = colours
    .filter((c) => luminance(c) >= 0.16 && luminance(c) <= 0.9)
    .sort((a, b) => saturation(b) - saturation(a));
  return {
    background_color: dark[0],
    primary_color: vivid[0],
    accent_color: vivid[1] ?? vivid[0],
  };
}

function resolveUrl(maybeUrl: string | undefined, base: string): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawUrl: unknown = body?.url;
  const projectId: unknown = body?.projectId;

  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  // projectId is optional: with it, the extracted fields are saved to that
  // project's context; without it (the onboarding wizard's brand step, before
  // the project exists) the fields are just returned for the user to confirm.
  const persist = typeof projectId === "string" && !!projectId;

  let target: URL;
  try {
    target = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let html: string;
  try {
    const pageRes = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CoreOSBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!pageRes.ok) {
      return NextResponse.json(
        { error: `Site returned ${pageRes.status}` },
        { status: 502 }
      );
    }
    html = await pageRes.text();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch site" },
      { status: 502 }
    );
  }

  const $ = cheerio.load(html);
  const base = target.toString();

  const meta = (name: string) =>
    $(`meta[name="${name}"]`).attr("content") ??
    $(`meta[property="${name}"]`).attr("content");

  const companyName =
    meta("og:site_name") || $("title").first().text().trim() || target.hostname;

  const companyDescription = meta("description") || meta("og:description") || "";

  const tagline =
    $("h1").first().text().trim() || meta("og:title") || $("title").first().text().trim();

  // Prefer an actual logo <img> on the page — it's the real brand mark, a
  // favicon is a fallback for sites that don't tag one.
  const logoCandidate =
    $('img[class*="logo" i], img[id*="logo" i], img[alt*="logo" i]').first().attr("src") ||
    $('link[rel="apple-touch-icon"]').attr("href") ||
    meta("og:image") ||
    $('link[rel="icon"]').attr("href");

  const colours = extractColours(html);
  const extracted: Record<string, string> = {
    company_name: companyName.trim(),
    company_description: companyDescription.trim(),
    tagline: tagline.trim(),
    logo_url: resolveUrl(logoCandidate, base) ?? "",
    brand_colours: colours.join(", "),
    website_url: base,
  };

  if (persist) {
    // Fill primary/accent/background from the scan only where the user hasn't
    // already set them - a manual choice in the Brand Identity panel wins.
    const current = await getProjectContext(supabase, projectId as string);
    const roles = pickBrandRoles(colours);
    for (const [k, v] of Object.entries(roles)) {
      if (v && !current[k]) extracted[k] = v;
    }
    await saveProjectContext(supabase, projectId as string, extracted);
  }

  return NextResponse.json({ extracted });
}
