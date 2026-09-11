import type { CanvasFormat, EnvironmentId, Staging } from "../types";
import { DEFAULT_KEY_LIGHT } from "./lights";

export const ENVIRONMENTS: { id: EnvironmentId; name: string }[] = [
  { id: "studio", name: "Studio" },
  { id: "city", name: "City" },
  { id: "sunset", name: "Sunset" },
  { id: "dawn", name: "Dawn" },
  { id: "night", name: "Night" },
  { id: "warehouse", name: "Warehouse" },
  { id: "forest", name: "Forest" },
  { id: "apartment", name: "Apartment" },
  { id: "lobby", name: "Lobby" },
  { id: "park", name: "Park" },
];

export const DEFAULT_STAGING: Staging = {
  environment: "studio",
  envIntensity: 1,
  envRotation: 0,
  envAsBackground: false,
  envBlur: 0.6,
  background: "#0e0e10",
  transparent: false,
  lights: [{ ...DEFAULT_KEY_LIGHT }],
  castShadows: false,
  shadowCatcher: true,
  shadows: true,
  floorY: -1.2,
  shadowOpacity: 0.5,
  shadowBlur: 2,
  fov: 35,
  focalLength: 38,
  depthOfField: false,
  focusDistance: 8,
  aperture: 2.8,
  maxBlur: 18,
  blades: 0,
  bladeAngle: 0,
  bokehHighlight: 1,
  sceneScale: 50,
  look: [],
};

export const DEFAULT_CAMERA = {
  position: [0, 0.5, 8.5] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
};

/**
 * Margins the platform's own interface covers, as a fraction of the frame.
 * Anything important should stay inside them.
 */
export type SafeArea = { top: number; bottom: number; left: number; right: number };

export const CANVAS_FORMATS: CanvasFormat[] = [
  // Social
  { id: "square", name: "Square 1:1", width: 1080, height: 1080, group: "Social" },
  { id: "portrait", name: "Portrait 4:5", width: 1080, height: 1350, group: "Social" },
  { id: "story", name: "Story 9:16", width: 1080, height: 1920, group: "Social" },
  { id: "reel", name: "Reel / TikTok 9:16", width: 1080, height: 1920, group: "Social" },
  { id: "landscape", name: "Landscape 16:9", width: 1920, height: 1080, group: "Social" },
  { id: "pinterest", name: "Pinterest 2:3", width: 1000, height: 1500, group: "Social" },
  { id: "linkedin", name: "LinkedIn 1.91:1", width: 1200, height: 628, group: "Social" },
  { id: "thumbnail", name: "Thumbnail 16:9", width: 1280, height: 720, group: "Social" },
  // Web and print
  { id: "og", name: "Open Graph", width: 1200, height: 630, group: "Web" },
  { id: "hero", name: "Web hero 21:9", width: 2560, height: 1080, group: "Web" },
  { id: "a4", name: "A4 Portrait", width: 2480, height: 3508, group: "Print" },
  { id: "poster", name: "Poster 2:3", width: 2000, height: 3000, group: "Print" },
  { id: "custom", name: "Custom", width: 1600, height: 1200, group: "Web" },
];

export const FORMAT_GROUPS = Array.from(new Set(CANVAS_FORMATS.map((f) => f.group)));

/** Vertical video keeps captions and interface chrome off the top and bottom. */
const VERTICAL_SAFE: SafeArea = { top: 0.13, bottom: 0.2, left: 0.05, right: 0.13 };
const MILD_SAFE: SafeArea = { top: 0.06, bottom: 0.06, left: 0.05, right: 0.05 };

export const SAFE_AREAS: Record<string, SafeArea> = {
  story: VERTICAL_SAFE,
  reel: VERTICAL_SAFE,
  portrait: { top: 0.05, bottom: 0.12, left: 0.05, right: 0.05 },
  square: MILD_SAFE,
  pinterest: MILD_SAFE,
  landscape: MILD_SAFE,
  thumbnail: MILD_SAFE,
  linkedin: MILD_SAFE,
  og: MILD_SAFE,
};

export function safeAreaFor(formatId: string): SafeArea | null {
  return SAFE_AREAS[formatId] ?? null;
}

/** Formats most often exported together for one campaign. */
export const DEFAULT_EXPORT_SET = ["square", "portrait", "story"];
