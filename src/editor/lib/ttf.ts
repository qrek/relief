import opentype from "opentype.js";
import type { FontData } from "three/examples/jsm/loaders/FontLoader.js";

/**
 * Converts a TTF/OTF file into the typeface.json structure three.js uses for
 * extruded text. Ported from three's TTFLoader, but with a bundled opentype.js
 * instead of a CDN import.
 */
export function ttfToTypeface(buffer: ArrayBuffer): FontData {
  const font = opentype.parse(buffer);
  const round = Math.round;
  const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
  const glyphs: Record<string, { ha: number; x_min: number; x_max: number; o: string }> = {};

  for (let i = 0; i < font.glyphs.length; i++) {
    const glyph = font.glyphs.get(i);
    if (!glyph) continue;
    const codes = glyph.unicodes?.length ? glyph.unicodes : glyph.unicode !== undefined ? [glyph.unicode] : [];
    if (codes.length === 0) continue;
    // glyph.path holds raw font units (y-up), unlike getPath() which rescales and flips.
    const path = glyph.path;

    const token = {
      ha: round((glyph.advanceWidth ?? 0) * scale),
      x_min: round((glyph.xMin ?? 0) * scale),
      x_max: round((glyph.xMax ?? 0) * scale),
      o: "",
    };

    for (const command of path.commands) {
      const type = command.type.toLowerCase() === "c" ? "b" : command.type.toLowerCase();
      token.o += type + " ";
      if ("x" in command && "y" in command) {
        token.o += round(command.x * scale) + " " + round(command.y * scale) + " ";
      }
      if ("x1" in command && "y1" in command) {
        token.o += round(command.x1 * scale) + " " + round(command.y1 * scale) + " ";
      }
      if ("x2" in command && "y2" in command) {
        token.o += round(command.x2 * scale) + " " + round(command.y2 * scale) + " ";
      }
    }

    for (const code of codes) glyphs[String.fromCodePoint(code)] = token;
  }

  return {
    glyphs,
    familyName: font.getEnglishName("fullName"),
    ascender: round(font.ascender * scale),
    descender: round(font.descender * scale),
    underlinePosition: font.tables.post?.underlinePosition ?? -100,
    underlineThickness: font.tables.post?.underlineThickness ?? 50,
    boundingBox: {
      xMin: font.tables.head.xMin,
      xMax: font.tables.head.xMax,
      yMin: font.tables.head.yMin,
      yMax: font.tables.head.yMax,
    },
    resolution: 1000,
    original_font_information: font.tables.name,
  } as FontData;
}

const cache = new Map<string, Promise<FontData>>();

export function loadTypeface(url: string): Promise<FontData> {
  let entry = cache.get(url);
  if (!entry) {
    entry = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Font load failed: ${url}`);
        return r.arrayBuffer();
      })
      .then(ttfToTypeface);
    cache.set(url, entry);
  }
  return entry;
}
