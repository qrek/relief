export type FontEntry = { id: string; name: string; url: string; category: string };

export const FONTS: FontEntry[] = [
  { id: "inter", name: "Inter", url: "/fonts/Inter.ttf", category: "Sans" },
  { id: "instrument-sans", name: "Instrument Sans", url: "/fonts/InstrumentSans.ttf", category: "Sans" },
  { id: "outfit", name: "Outfit", url: "/fonts/Outfit.ttf", category: "Sans" },
  { id: "urbanist", name: "Urbanist", url: "/fonts/Urbanist.ttf", category: "Sans" },
  { id: "syne", name: "Syne", url: "/fonts/Syne.ttf", category: "Sans" },
  { id: "bricolage", name: "Bricolage Grotesque", url: "/fonts/BricolageGrotesque.ttf", category: "Sans" },
  { id: "staatliches", name: "Staatliches", url: "/fonts/Staatliches.ttf", category: "Display" },
  { id: "bangers", name: "Bangers", url: "/fonts/Bangers.ttf", category: "Display" },
  { id: "instrument-serif", name: "Instrument Serif", url: "/fonts/InstrumentSerif.ttf", category: "Serif" },
  { id: "old-standard", name: "Old Standard TT", url: "/fonts/OldStandard.ttf", category: "Serif" },
  { id: "pinyon-script", name: "Pinyon Script", url: "/fonts/PinyonScript.ttf", category: "Script" },
  { id: "silkscreen", name: "Silkscreen", url: "/fonts/Silkscreen.ttf", category: "Pixel" },
  { id: "pixelify", name: "Pixelify Sans", url: "/fonts/PixelifySans.ttf", category: "Pixel" },
];

export const DEFAULT_FONT_ID = "bricolage";

export function fontById(id: string): FontEntry {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}
