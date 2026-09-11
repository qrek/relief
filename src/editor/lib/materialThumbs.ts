import * as THREE from "three";
import { DEFAULT_MATERIAL } from "../presets/materials";
import type { MaterialParams, MaterialPreset } from "../types";
import { studioTexture } from "./studioEnv";

/**
 * A picture of each material, rendered: a sphere under the softbox studio,
 * so a chrome shows the panel bending across it and a velvet its rim. One at
 * a time between frames, the first time a panel asks, then kept.
 */
const SIZE = 96;
const SCALE = 2;
const GROUND = "#6f6d6a";

type Rig = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; material: THREE.MeshPhysicalMaterial };

let rig: Rig | null = null;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(url: string) => void>>();
const queue: MaterialPreset[] = [];
let scheduled = false;

/** Puts the editor's material fields on a three material, the same way the viewport does. */
export function applyMaterialParams(material: THREE.MeshPhysicalMaterial, params: MaterialParams) {
  material.color.set(params.color);
  material.roughness = params.roughness;
  material.metalness = params.metalness;
  material.clearcoat = params.clearcoat;
  material.clearcoatRoughness = params.clearcoatRoughness;
  material.transmission = params.transmission;
  material.thickness = params.thickness;
  material.ior = params.ior;
  material.iridescence = params.iridescence;
  material.sheen = params.sheen;
  material.sheenColor.set(params.sheenColor);
  material.emissive.set(params.emissive);
  material.emissiveIntensity = params.emissiveIntensity;
  material.opacity = params.opacity;
  material.transparent = params.opacity < 1;
  material.flatShading = params.flatShading;
  material.envMapIntensity = params.envMapIntensity;
  material.needsUpdate = true;
}

function getRig(): Rig {
  if (rig && rig.renderer.getContext().isContextLost()) {
    rig.renderer.dispose();
    rig = null;
    cache.clear();
  }
  if (rig) return rig;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(SCALE);
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GROUND);
  scene.environment = studioTexture(renderer, "studio:softbox");

  // A flat-shaded sphere has facets to show; a smooth one is a smooth sphere.
  const material = new THREE.MeshPhysicalMaterial();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
  scene.add(sphere);

  // A small dark card behind, so a glass has something to refract and a
  // transparent material something to be seen against.
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: "#2b2a28" }));
  card.position.set(0.35, -0.2, -1.6);
  scene.add(card);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0.35, 5.2);
  camera.lookAt(0, 0, 0);

  rig = { renderer, scene, camera, material };
  return rig;
}

function renderOne(preset: MaterialPreset): string {
  const { renderer, scene, camera, material } = getRig();
  applyMaterialParams(material, { ...DEFAULT_MATERIAL, ...preset.params });
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/jpeg", 0.85);
}

function pump() {
  scheduled = false;
  const preset = queue.shift();
  if (!preset) return;
  if (!cache.has(preset.id)) {
    let url = "";
    try {
      url = renderOne(preset);
    } catch (err) {
      console.error(`Material preview failed for ${preset.id}`, err);
    }
    cache.set(preset.id, url);
    for (const fn of listeners.get(preset.id) ?? []) fn(url);
  }
  if (queue.length) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(pump, 16);
}

export function materialThumbnail(preset: MaterialPreset): string {
  return cache.get(preset.id) ?? "";
}

export function subscribeMaterialThumbnail(preset: MaterialPreset, onReady: (url: string) => void): () => void {
  const cached = cache.get(preset.id);
  if (cached !== undefined) {
    onReady(cached);
    return () => {};
  }
  let set = listeners.get(preset.id);
  if (!set) {
    set = new Set();
    listeners.set(preset.id, set);
  }
  set.add(onReady);
  if (!queue.includes(preset)) queue.push(preset);
  schedule();
  return () => {
    set!.delete(onReady);
  };
}
