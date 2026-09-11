import type { LightType, SceneLight } from "../types";

const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);

/**
 * A light is placed the way a photographer places one: on a sphere around the
 * subject, by azimuth and height, at a distance. Nothing to drag in three
 * dimensions, and a setup can be read off the panel like a lighting diagram.
 */
export function createLight(type: LightType, partial: Partial<SceneLight> = {}): SceneLight {
  const base: SceneLight = {
    id: id(),
    name: type === "sun" ? "Key" : type === "spot" ? "Spot" : "Point",
    type,
    enabled: true,
    color: "#ffffff",
    intensity: type === "sun" ? 2 : 6,
    azimuth: 35,
    elevation: 45,
    distance: 8,
    angle: 40,
    penumbra: 0.5,
    castShadow: true,
    softness: 3,
  };
  return { ...base, ...partial };
}

/** The single light every scene had before lights became a list. */
export const DEFAULT_KEY_LIGHT: SceneLight = createLight("sun", { id: "key", name: "Key" });

export type LightRig = { id: string; name: string; blurb: string; lights: () => SceneLight[] };

/** Classic setups, as starting points rather than answers. */
export const LIGHT_RIGS: LightRig[] = [
  {
    id: "three-point",
    name: "Three-point studio",
    blurb: "A key from the front left, a softer fill from the right, a rim from behind to lift the edges.",
    lights: () => [
      createLight("sun", { name: "Key", azimuth: -35, elevation: 40, intensity: 2.4 }),
      createLight("sun", { name: "Fill", azimuth: 55, elevation: 20, intensity: 0.8, castShadow: false, color: "#e8f0ff" }),
      createLight("sun", { name: "Rim", azimuth: 160, elevation: 35, intensity: 1.6, castShadow: false }),
    ],
  },
  {
    id: "soft-top",
    name: "Soft top light",
    blurb: "One wide source from above, the look of a softbox over a product table.",
    lights: () => [
      createLight("spot", { name: "Softbox", azimuth: 10, elevation: 72, distance: 9, angle: 70, penumbra: 1, intensity: 9, softness: 8 }),
      createLight("sun", { name: "Bounce", azimuth: 0, elevation: -20, intensity: 0.5, castShadow: false, color: "#fff2e0" }),
    ],
  },
  {
    id: "hard-side",
    name: "Hard side light",
    blurb: "A single low sun from the side, long shadows and strong relief.",
    lights: () => [createLight("sun", { name: "Sun", azimuth: -80, elevation: 18, intensity: 3, softness: 1 })],
  },
  {
    id: "rim-pair",
    name: "Rim pair",
    blurb: "Two lights from behind, one warm and one cool, for a dark scene where only edges catch light.",
    lights: () => [
      createLight("spot", { name: "Warm rim", azimuth: 135, elevation: 30, distance: 8, angle: 50, intensity: 10, color: "#ffb26b", castShadow: false }),
      createLight("spot", { name: "Cool rim", azimuth: -135, elevation: 30, distance: 8, angle: 50, intensity: 10, color: "#6bb8ff", castShadow: false }),
    ],
  },
];
