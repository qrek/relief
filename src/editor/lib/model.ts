import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { assetUrl, getAsset } from "./assets";
import { normalizeGroup } from "./geometry";

export type LoadedPart = {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  /** The material the file shipped with, kept so "original materials" can be restored. */
  sourceMaterial: THREE.Material | null;
};

export type LoadedModel = {
  parts: LoadedPart[];
  /** True when the file also contained animation clips we do not play yet. */
  hasAnimations: boolean;
};

let gltfLoader: GLTFLoader | null = null;

/**
 * Most GLBs in the wild are compressed: Draco from Blender, Sketchfab and the
 * generators, meshopt from the web toolchains. Without the decoders the loader
 * throws and the object stays empty, which is how "import does not work" looks
 * from the outside. The Draco decoder is served from public/draco, copied from
 * three's own examples.
 */
function gltfLoaderWithDecoders(): GLTFLoader {
  if (gltfLoader) return gltfLoader;
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(draco);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  return gltfLoader;
}

async function parseFile(url: string, format: string): Promise<{ root: THREE.Object3D; hasAnimations: boolean }> {
  switch (format) {
    case "glb":
    case "gltf": {
      const gltf = await gltfLoaderWithDecoders().loadAsync(url);
      return { root: gltf.scene, hasAnimations: (gltf.animations?.length ?? 0) > 0 };
    }
    case "fbx": {
      const root = await new FBXLoader().loadAsync(url);
      return { root, hasAnimations: (root.animations?.length ?? 0) > 0 };
    }
    case "obj": {
      const root = await new OBJLoader().loadAsync(url);
      return { root, hasAnimations: false };
    }
    default:
      throw new Error(`Unsupported model format: .${format}`);
  }
}

/**
 * Flattens a loaded file into parts whose geometries are baked into world space and
 * normalised together so the whole model fits a two-unit box.
 */
async function build(assetId: string): Promise<LoadedModel> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("Model not found in your library");
  const url = await assetUrl(assetId);
  const { root, hasAnimations } = await parseFile(url, asset.format);

  root.updateMatrixWorld(true);
  const parts: LoadedPart[] = [];
  const used = new Set<string>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;

    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    // Attributes beyond these confuse our own material pipeline.
    for (const key of Object.keys(geometry.attributes)) {
      if (!["position", "normal", "uv"].includes(key)) geometry.deleteAttribute(key);
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();

    let id = (mesh.name || "part").replace(/[^\w-]+/g, "_");
    let n = 1;
    while (used.has(id)) id = `${mesh.name || "part"}_${n++}`;
    used.add(id);

    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    parts.push({
      id,
      name: mesh.name || `Part ${parts.length + 1}`,
      geometry,
      sourceMaterial: source ?? null,
    });
  });

  if (parts.length === 0) throw new Error("No meshes found in this file");
  normalizeGroup(parts.map((p) => p.geometry));
  return { parts, hasAnimations };
}

const cache = new Map<string, Promise<LoadedModel>>();

export function loadModel(assetId: string): Promise<LoadedModel> {
  let entry = cache.get(assetId);
  if (!entry) {
    entry = build(assetId).catch((err) => {
      cache.delete(assetId);
      throw err;
    });
    cache.set(assetId, entry);
  }
  return entry;
}

export function forgetModel(assetId: string) {
  cache.delete(assetId);
}
