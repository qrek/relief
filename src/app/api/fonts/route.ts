/**
 * Fetches one Google Fonts variant as a TTF and hands the bytes back.
 *
 * Google decides the file format from the client: a browser gets woff2, which
 * has no outlines opentype.js can read, but a plain client with no web font
 * support gets TrueType. Asking from here, as such a client, is what makes the
 * outlines available for extrusion. No key and no account are involved.
 */
const CSS_ENDPOINT = "https://fonts.googleapis.com/css";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const family = (url.searchParams.get("family") ?? "").trim();
  const variant = (url.searchParams.get("variant") ?? "400").trim();

  if (!/^[A-Za-z0-9 .'+-]{1,64}$/.test(family)) return new Response("Bad family", { status: 400 });
  if (!/^[1-9]00i?$/.test(variant)) return new Response("Bad variant", { status: 400 });

  // Google's classic endpoint spells italics out in full.
  const spec = variant.endsWith("i") ? `${variant.slice(0, -1)}italic` : variant;
  const css = await fetch(`${CSS_ENDPOINT}?family=${encodeURIComponent(family)}:${spec}`, {
    headers: { "User-Agent": "curl/8.0" },
    next: { revalidate: 86400 },
  });
  if (!css.ok) return new Response("Family not found", { status: 404 });

  const match = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(await css.text());
  if (!match) return new Response("No TrueType file for this variant", { status: 404 });

  const ttf = await fetch(match[1], { next: { revalidate: 86400 } });
  if (!ttf.ok) return new Response("Font file unavailable", { status: 502 });

  return new Response(await ttf.arrayBuffer(), {
    headers: {
      "Content-Type": "font/ttf",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
