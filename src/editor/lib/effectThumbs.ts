import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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

type Rig = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  look: LookPass;
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

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // Mid grey, not paper: a glow, a streak or a vignette reads against it and
  // a halftone or a grain still shows.
  scene.background = new THREE.Color("#7a7874");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffffff", 1.2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // A knot: curved, glossy, with hard highlights and deep shadowed folds, so a
  // colour effect, an edge effect and a glow each have something to bite on.
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.9, 0.34, 220, 32),
    new THREE.MeshPhysicalMaterial({ color: "#2b3fd6", roughness: 0.22, metalness: 0.15, clearcoat: 0.6 }),
  );
  knot.rotation.set(0.5, -0.4, 0.2);
  scene.add(knot);

  // A small bright sphere off to the side, the size a highlight would be.
  const bead = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 32, 24),
    new THREE.MeshPhysicalMaterial({
      color: "#ff7a3d",
      emissive: "#ff5a1f",
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.05,
      clearcoat: 1,
    }),
  );
  bead.position.set(1.65, -0.75, 0.6);
  scene.add(bead);

  const camera = new THREE.PerspectiveCamera(32, WIDTH / HEIGHT, 0.1, 50);
  camera.position.set(0.3, 0.5, 5.2);
  camera.lookAt(0.15, -0.05, 0);

  rig = { renderer, scene, camera, look: new LookPass() };
  return rig;
}

function renderOne(def: EffectDef): string {
  const { renderer, scene, camera, look } = getRig();
  const instance: EffectInstance = {
    id: `preview-${def.id}`,
    effectId: def.id,
    enabled: true,
    params: defaultEffectParams(def),
    colors: defaultEffectColors(def),
  };
  // A fixed moment, part way round the cycle, so an animated effect shows its
  // motion rather than its resting state.
  look.render(renderer, () => renderer.render(scene, camera), [instance], 0.37, HEIGHT);
  return renderer.domElement.toDataURL("image/jpeg", 0.85);
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
