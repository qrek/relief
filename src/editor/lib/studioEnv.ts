import * as THREE from "three";
import { buildStudioScene, studioById } from "../presets/studios";

/**
 * A studio rig baked into an environment map, once per renderer: the map
 * belongs to the WebGL context that made it, so the viewport and the
 * offscreen thumbnail renderers each keep their own.
 */
const caches = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.Texture>>();

export function studioTexture(renderer: THREE.WebGLRenderer, id: string): THREE.Texture | null {
  const def = studioById(id);
  if (!def) return null;
  let cache = caches.get(renderer);
  if (!cache) {
    cache = new Map();
    caches.set(renderer, cache);
  }
  const hit = cache.get(id);
  if (hit) return hit;

  const scene = buildStudioScene(def);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // A little blur at the source: a real softbox has a diffuser, not a hard edge.
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) (mesh.material as THREE.Material).dispose();
  });
  cache.set(id, target.texture);
  return target.texture;
}
