import type { FontData } from "three/examples/jsm/loaders/FontLoader.js";
import { FONTS, type FontEntry } from "../presets/fonts";
import catalogue from "../presets/google-fonts.json";
import { getAsset, listAssets, putAsset, tx, type AssetMeta, type StoredAsset } from "./assets";
import { loadTypeface, ttfToTypeface } from "./ttf";

/**
 * A font id is a small address. Bundled fonts keep their plain id. A file the
 * designer imported is `asset:<id>`. A Google family is `google:<Family>:<variant>`,
 * with the variant in Google's own notation: 400, 700, 400i.
 */
export type FontSource = "bundled" | "asset" | "google";

export type GoogleFamily = {
  family: string;
  category: string;
  variants: string[];
  popularity: number;
};

export const GOOGLE_FONTS = catalogue as GoogleFamily[];

export const FONT_EXTENSIONS = ["ttf", "otf"];
export const MAX_FONT_BYTES = 12 * 1024 * 1024;

export function googleFontId(family: string, variant: string): string {
  return `google:${family}:${variant}`;
}

export function assetFontId(assetId: string): string {
  return `asset:${assetId}`;
}

export function fontSource(id: string): FontSource {
  if (id.startsWith("asset:")) return "asset";
  if (id.startsWith("google:")) return "google";
  return "bundled";
}

/** Variant label the way a type menu would print it. */
export function variantLabel(variant: string): string {
  const italic = variant.endsWith("i");
  const weight = parseInt(variant, 10);
  const names: Record<number, string> = {
    100: "Thin",
    200: "Extra light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semibold",
    700: "Bold",
    800: "Extra bold",
    900: "Black",
  };
  const base = names[weight] ?? String(weight);
  return italic ? `${base} italic` : base;
}

/**
 * Names of imported fonts, kept in memory once listed so the panels can print
 * a name without waiting on the database. Filled by `listImportedFonts`.
 */
const importedNames = new Map<string, string>();

export type FontDescription = { id: string; name: string; category: string; source: FontSource };

export function describeFont(id: string): FontDescription {
  const source = fontSource(id);
  if (source === "google") {
    const [, family, variant] = id.split(":");
    const entry = GOOGLE_FONTS.find((f) => f.family === family);
    return {
      id,
      name: variant && variant !== "400" ? `${family} ${variantLabel(variant)}` : family,
      category: entry?.category ?? "Google",
      source,
    };
  }
  if (source === "asset") {
    const assetId = id.slice("asset:".length);
    return { id, name: importedNames.get(assetId) ?? "Imported font", category: "Yours", source };
  }
  const entry: FontEntry = FONTS.find((f) => f.id === id) ?? FONTS[0];
  return { id: entry.id, name: entry.name, category: entry.category, source };
}

export async function listImportedFonts(): Promise<AssetMeta[]> {
  const fonts = (await listAssets("font")).filter((a) => !a.data?.startsWith("google:"));
  for (const f of fonts) importedNames.set(f.id, f.name);
  return fonts;
}

export async function importFontFile(file: File): Promise<AssetMeta> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!FONT_EXTENSIONS.includes(ext)) throw new Error("Use a .ttf or .otf file");
  if (file.size > MAX_FONT_BYTES) throw new Error("That font file is too large");
  // Parse once up front, so a broken file is refused here rather than at render time.
  ttfToTypeface(await file.arrayBuffer());
  const meta = await putAsset(file, "font");
  importedNames.set(meta.id, meta.name);
  return meta;
}

/** A Google font, once fetched, is kept as a font asset carrying its id in `data`. */
async function findCachedGoogleFont(id: string): Promise<StoredAsset | undefined> {
  const all = await tx<StoredAsset[]>("readonly", (s) => s.getAll());
  return all.find((a) => a.kind === "font" && a.data === id);
}

async function fetchGoogleFont(id: string): Promise<ArrayBuffer> {
  const cached = await findCachedGoogleFont(id);
  if (cached) return cached.blob.arrayBuffer();

  const [, family, variant] = id.split(":");
  const res = await fetch(`/api/fonts?family=${encodeURIComponent(family)}&variant=${encodeURIComponent(variant ?? "400")}`);
  if (!res.ok) throw new Error(`Could not fetch ${family} from Google Fonts`);
  const buffer = await res.arrayBuffer();

  const asset: StoredAsset = {
    id: `gf-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${variant ?? "400"}`,
    kind: "font",
    name: describeFont(id).name,
    format: "ttf",
    mime: "font/ttf",
    size: buffer.byteLength,
    createdAt: Date.now(),
    blob: new Blob([buffer], { type: "font/ttf" }),
    data: id,
  };
  await tx("readwrite", (s) => s.put(asset));
  return buffer;
}

const cache = new Map<string, Promise<FontData>>();

/** The typeface for any font id, converted once and kept for the session. */
export function loadFont(id: string): Promise<FontData> {
  let entry = cache.get(id);
  if (entry) return entry;

  const source = fontSource(id);
  if (source === "bundled") {
    const bundled = FONTS.find((f) => f.id === id) ?? FONTS[0];
    entry = loadTypeface(bundled.url);
  } else if (source === "asset") {
    entry = getAsset(id.slice("asset:".length)).then(async (asset) => {
      if (!asset) throw new Error("That imported font is no longer in the library");
      importedNames.set(asset.id, asset.name);
      return ttfToTypeface(await asset.blob.arrayBuffer());
    });
  } else {
    entry = fetchGoogleFont(id).then(ttfToTypeface);
  }

  cache.set(id, entry);
  // A failed load must not poison the cache: the next attempt should retry.
  entry.catch(() => cache.delete(id));
  return entry;
}
