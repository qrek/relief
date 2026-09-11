import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { getAsset, listAssets, putAsset, type AssetMeta } from "./assets";

export const HDRI_EXTENSIONS = ["hdr", "exr", "jpg", "jpeg", "png"];
export const MAX_HDRI_BYTES = 80 * 1024 * 1024;

export function isImportedEnvironment(id: string): boolean {
  return id.startsWith("asset:");
}

export async function listImportedEnvironments(): Promise<AssetMeta[]> {
  return listAssets("hdri");
}

export async function importEnvironmentFile(file: File): Promise<AssetMeta> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!HDRI_EXTENSIONS.includes(ext)) throw new Error("Use a .hdr or .exr file, or an equirectangular image");
  if (file.size > MAX_HDRI_BYTES) throw new Error("That environment file is too large");
  return putAsset(file, "hdri");
}

const cache = new Map<string, Promise<THREE.Texture>>();

/**
 * An imported environment as an equirectangular texture. Radiance and OpenEXR
 * files keep their range, so a sun in the map still reads as a sun on chrome;
 * an ordinary image is accepted too, and simply gives softer light.
 */
export function loadEnvironment(id: string): Promise<THREE.Texture> {
  let entry = cache.get(id);
  if (entry) return entry;

  entry = (async () => {
    const asset = await getAsset(id.slice("asset:".length));
    if (!asset) throw new Error("That environment is no longer in the library");
    const buffer = await asset.blob.arrayBuffer();
    const format = asset.format.toLowerCase();

    let texture: THREE.Texture;
    if (format === "hdr") {
      const data = new RGBELoader().parse(buffer);
      texture = new THREE.DataTexture(data.data, data.width, data.height, THREE.RGBAFormat, data.type);
      texture.needsUpdate = true;
    } else if (format === "exr") {
      const data = new EXRLoader().parse(buffer);
      texture = new THREE.DataTexture(data.data, data.width, data.height, data.format, data.type);
      texture.needsUpdate = true;
    } else {
      const bitmap = await createImageBitmap(asset.blob);
      texture = new THREE.CanvasTexture(bitmap);
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  })();

  cache.set(id, entry);
  entry.catch(() => cache.delete(id));
  return entry;
}
