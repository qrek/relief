import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LookPass } from "./look";
import { defaultEffectColors, defaultEffectParams, type EffectDef } from "../presets/effects";
import type { EffectInstance } from "../types";

/**
 * A picture of what each effect does, made by the effect itself: one small
 * sample scene rendered through the same pass the look uses, so the preview is
 * not an illustration of the effect but the effect. Rendered one at a time
 * between frames, the first time a picker asks, then kept.
 */
const WIDTH = 160;
const HEIGHT = 120;
/** Rendered at twice the size, so a 160 px thumbnail is crisp on any screen. */
const SCALE = 2;
const GROUND = "#7d7b77";

/**
 * A preview is a hundred pixels high, and an effect at its defaults is tuned
 * for a poster: seventy halftone cells across a print are two pixels here and
 * read as nothing. These are the settings each effect is shown with, chosen so
 * the thing it does is the first thing seen. Only the preview uses them.
 */
const PREVIEW_PARAMS: Record<string, Record<string, number>> = {
  grade: { contrast: 1.7, saturation: 1.6, tint: 0.35 },
  posterize: { levels: 3 },
  halftone: { scale: 18, gain: 0.42 },
  cmyk: { scale: 36, fill: 0.7 },
  led: { pitch: 14, gain: 1.6 },
  dither: { scale: 56 },
  riso: { levels: 3, grain: 0.45, offset: 0.014 },
  grain: { amount: 0.4, size: 1.6 },
  sobel: { width: 1.2, gain: 3 },
  vignette: { amount: 0.95, start: 0.15, end: 0.7 },
  hue: { shift: 0.5 },
  crosshatch: { scale: 44, weight: 0.32 },
  scanlines: { count: 44, amount: 0.65 },
  crt: { curve: 0.3, pitch: 2, mask: 0.9 },
  newsprint: { scale: 24 },
  blur: { radius: 7 },
  bloom: { threshold: 0.88, radius: 10, intensity: 0.9 },
  aberration: { amount: 2.8 },
  lens: { amount: 1.2, zoom: 0.75 },
  sharpen: { amount: 3, radius: 2.5 },
  diffusion: { radius: 14, amount: 0.55 },
  "zoom-blur": { amount: 0.32 },
  "motion-blur": { length: 44, angle: 0.5 },
  "tilt-shift": { band: 0.1, radius: 12 },
  anamorphic: { threshold: 0.86, length: 220, intensity: 1.4 },
  pixelate: { size: 13 },
  mosaic: { size: 9 },
  wave: { freq: 12, amp: 1, cross: 1 },
  ripple: { freq: 40, amp: 1, falloff: 0.2 },
  twist: { amount: 3.2, radius: 0.85 },
  liquify: { amount: 0.85, scale: 2.5 },
  glitch: { amount: 0.85, bands: 9, shift: 0.7 },
  streak: { length: 120, threshold: 0.78 },
  squeeze: { amount: 0.8, falloff: 1.5 },
  mirror: { axis: 1 },
  threshold: { level: 0.75 },
  slice: { count: 6, amount: 0.32 },
  cells: { scale: 6 },
  shatter: { scale: 5, amount: 0.28 },
  drops: { scale: 5, amount: 0.22, size: 0.65 },
  worms: { scale: 2, length: 70, amount: 1 },
  "self-displace": { amount: 0.3, blur: 6 },
  sticker: { width: 16 },
  shadow: { distance: 26, opacity: 0.7 },
  "edge-glow": { width: 26, intensity: 2 },
};

type Rig = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  look: LookPass;
  sheet: HTMLCanvasElement;
};

let rig: Rig | null = null;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(url: string) => void>>();
const queue: EffectDef[] = [];
let scheduled = false;

function getRig(): Rig {
  if (rig && rig.renderer.getContext().isContextLost()) {
    rig.look.dispose();
    rig.renderer.dispose();
    rig = null;
    cache.clear();
  }
  if (rig) return rig;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(SCALE);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GROUND);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight("#ffffff", 3);
  key.position.set(2.5, 5, 3.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffffff", 1.4);
  rim.position.set(-4, 2.5, -3);
  scene.add(rim);

  // One rounded cube, big in the frame, three faces showing: a flat top for
  // a highlight to sit on, an edge for an edge effect, a colour for a colour
  // effect, and nothing else to read.
  const cube = new THREE.Mesh(
    new RoundedBoxGeometry(1.7, 1.7, 1.7, 6, 0.3),
    new THREE.MeshPhysicalMaterial({ color: "#ff6a3d", roughness: 0.3, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  );
  cube.rotation.set(0.42, -0.68, 0.08);
  scene.add(cube);

  const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.1, 50);
  camera.position.set(0.25, 0.9, 5.6);
  camera.lookAt(0, -0.05, 0);

  const sheet = document.createElement("canvas");
  sheet.width = WIDTH * SCALE;
  sheet.height = HEIGHT * SCALE;

  rig = { renderer, scene, camera, look: new LookPass(), sheet };
  return rig;
}

function renderOne(def: EffectDef): string {
  const { renderer, scene, camera, look, sheet } = getRig();
  const instance: EffectInstance = {
    id: `preview-${def.id}`,
    effectId: def.id,
    enabled: true,
    params: { ...defaultEffectParams(def), ...PREVIEW_PARAMS[def.id] },
    colors: defaultEffectColors(def),
    keys: {},
  };

  // An alpha effect works on a cutout: the cube is rendered on nothing, so
  // its outline, shadow or glow has an edge to find, then set on the ground.
  const cutout = def.category === "Alpha";
  scene.background = cutout ? null : new THREE.Color(GROUND);

  // A fixed moment, part way round the cycle, so an animated effect shows its
  // motion rather than its resting state. Sizes are in pixels of this buffer.
  look.render(renderer, () => renderer.render(scene, camera), [instance], 0.37, HEIGHT * SCALE);

  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.drawImage(renderer.domElement, 0, 0, sheet.width, sheet.height);
  return sheet.toDataURL("image/jpeg", 0.86);
}

function pump() {
  scheduled = false;
  const def = queue.shift();
  if (!def) return;
  if (!cache.has(def.id)) {
    let url = "";
    try {
      url = renderOne(def);
    } catch (err) {
      console.error(`Effect preview failed for ${def.id}`, err);
    }
    cache.set(def.id, url);
    for (const fn of listeners.get(def.id) ?? []) fn(url);
  }
  if (queue.length) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // One preview at a time, a frame apart, keeps the panel responsive while the
  // set fills in. A timer rather than an animation frame, so a tab in the
  // background still finishes the job.
  setTimeout(pump, 16);
}

/** The preview for an effect, or "" until it has been rendered. */
export function effectThumbnail(def: EffectDef): string {
  return cache.get(def.id) ?? "";
}

/** Asks for a preview and is told when it exists. Returns the unsubscribe. */
export function subscribeEffectThumbnail(def: EffectDef, onReady: (url: string) => void): () => void {
  const cached = cache.get(def.id);
  if (cached !== undefined) {
    onReady(cached);
    return () => {};
  }
  let set = listeners.get(def.id);
  if (!set) {
    set = new Set();
    listeners.set(def.id, set);
  }
  set.add(onReady);
  if (!queue.includes(def)) queue.push(def);
  schedule();
  return () => {
    set!.delete(onReady);
  };
}
