import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { defaultParams, type ObjectPreset } from "../presets/objects";

const SIZE = 132;

type Rig = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  material: THREE.MeshPhysicalMaterial;
};

let rig: Rig | null = null;
const cache = new Map<string, string>();

/** A small offscreen renderer, created once, used only for library previews. */
function getRig(): Rig {
  // Fast Refresh and multiple contexts can lose this one; rebuild it when that happens.
  if (rig && rig.renderer.getContext().isContextLost()) {
    rig.renderer.dispose();
    rig = null;
    cache.clear();
  }
  if (rig) return rig;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(2);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const material = new THREE.MeshPhysicalMaterial({
    color: "#d8d8dc",
    roughness: 0.28,
    metalness: 0.1,
    clearcoat: 0.4,
  });

  rig = { renderer, scene, camera, material };
  return rig;
}

/** Renders one preset with its default parameters and returns a PNG data URL. */
export function thumbnailFor(preset: ObjectPreset): string {
  const cached = cache.get(preset.id);
  if (cached) return cached;

  const { renderer, scene, camera, material } = getRig();
  const group = new THREE.Group();
  let parts: { geometry: THREE.BufferGeometry }[] = [];

  try {
    parts = preset.build(defaultParams(preset));
    for (const part of parts) group.add(new THREE.Mesh(part.geometry, material));
    scene.add(group);

    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const distance = (sphere.radius * 1.25) / Math.sin((camera.fov * Math.PI) / 360);
    camera.position.set(distance * 0.55, distance * 0.42, distance * 0.78);
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    cache.set(preset.id, url);
    return url;
  } catch (err) {
    console.error(`Thumbnail failed for ${preset.id}`, err);
    cache.set(preset.id, "");
    return "";
  } finally {
    scene.remove(group);
    for (const part of parts) part.geometry.dispose();
  }
}
