import * as THREE from "three";
import { zipSync } from "fflate";
import { useRuntime } from "../runtime";
import { renderImage, type ImageExportOptions, exportFileName } from "./export";
import { renderVideo, type VideoExportOptions } from "./video";
import { CANVAS_FORMATS } from "../presets/scene";
import type { CanvasFormat, Project } from "../types";

export type ExportFile = { name: string; blob: Blob };

/** How the camera behaves when the same scene is rendered at another shape. */
export type Framing = "keep" | "fit";

export type BatchProgress = {
  /** Index of the format being rendered, from zero. */
  index: number;
  total: number;
  formatName: string;
  /** Progress inside the current format, for video. */
  inner: number;
};

const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();
const _direction = new THREE.Vector3();

/**
 * Measures what the camera should keep in frame: only the project's own objects.
 * Contact shadows, the environment and gizmos are not content, and a backdrop
 * follows the camera so it would swamp the bounds.
 */
function sceneBounds(): THREE.Sphere | null {
  const { objects } = useRuntime.getState();
  _box.makeEmpty();
  let found = false;

  for (const group of Object.values(objects)) {
    if (!group.visible) continue;
    let backdrop = false;
    group.traverse((o) => {
      if (o.userData?.isBackdrop) backdrop = true;
    });
    if (backdrop) continue;

    const bounds = new THREE.Box3().setFromObject(group);
    if (bounds.isEmpty() || !Number.isFinite(bounds.min.x)) continue;
    _box.union(bounds);
    found = true;
  }

  if (!found || _box.isEmpty()) return null;
  return _box.getBoundingSphere(_sphere.clone());
}

/**
 * Pulls the camera back along its current axis until the scene fits the given
 * aspect. Returns a function that puts the camera back where it was.
 */
export function frameForAspect(aspect: number, padding = 1.12): () => void {
  const { camera } = useRuntime.getState();
  if (!camera) return () => {};

  const previous = camera.position.clone();
  const bounds = sceneBounds();
  if (!bounds || bounds.radius <= 0) return () => camera.position.copy(previous);

  const halfVertical = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  const limiting = Math.min(halfVertical, halfHorizontal);
  const distance = (bounds.radius * padding) / Math.max(0.05, Math.sin(limiting));

  _direction.copy(camera.position).sub(bounds.center);
  if (_direction.lengthSq() < 1e-6) _direction.set(0, 0, 1);
  _direction.normalize().multiplyScalar(distance);
  camera.position.copy(bounds.center).add(_direction);

  return () => camera.position.copy(previous);
}

export function formatById(id: string): CanvasFormat | undefined {
  return CANVAS_FORMATS.find((f) => f.id === id);
}

/** Resolves a format id to concrete pixels, honouring the project's custom size. */
export function resolveFormat(project: Project, id: string): CanvasFormat | null {
  const format = formatById(id);
  if (!format) return null;
  return format.id === "custom" ? { ...format, ...project.customFormat } : format;
}

function fileName(project: Project, format: CanvasFormat, width: number, height: number, ext: string) {
  const base = exportFileName(project.name.replace(/[^\w-]+/g, "_") || "export");
  return `${base}_${format.id}_${width}x${height}.${ext}`;
}

export async function exportImageSet(
  project: Project,
  formatIds: string[],
  options: Omit<ImageExportOptions, "width" | "height"> & { scale: number; framing: Framing; extension: string },
  onProgress?: (p: BatchProgress) => void,
  signal?: AbortSignal,
): Promise<ExportFile[]> {
  const files: ExportFile[] = [];
  for (let i = 0; i < formatIds.length; i++) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    const format = resolveFormat(project, formatIds[i]);
    if (!format) continue;
    const width = Math.round(format.width * options.scale);
    const height = Math.round(format.height * options.scale);
    onProgress?.({ index: i, total: formatIds.length, formatName: format.name, inner: 0 });

    const restore = options.framing === "fit" ? frameForAspect(width / height) : () => {};
    try {
      const blob = await renderImage({ ...options, width, height });
      files.push({ name: fileName(project, format, width, height, options.extension), blob });
    } finally {
      restore();
    }
  }
  return files;
}

export async function exportVideoSet(
  project: Project,
  formatIds: string[],
  options: Omit<VideoExportOptions, "width" | "height" | "onProgress" | "signal"> & {
    scale: number;
    framing: Framing;
    extension: string;
  },
  onProgress?: (p: BatchProgress) => void,
  signal?: AbortSignal,
): Promise<ExportFile[]> {
  const files: ExportFile[] = [];
  for (let i = 0; i < formatIds.length; i++) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    const format = resolveFormat(project, formatIds[i]);
    if (!format) continue;
    const width = Math.round(format.width * options.scale);
    const height = Math.round(format.height * options.scale);

    const restore = options.framing === "fit" ? frameForAspect(width / height) : () => {};
    try {
      const blob = await renderVideo({
        ...options,
        width,
        height,
        signal,
        onProgress: (inner) => onProgress?.({ index: i, total: formatIds.length, formatName: format.name, inner }),
      });
      files.push({ name: fileName(project, format, width, height, options.extension), blob });
    } finally {
      restore();
    }
  }
  return files;
}

/** Packs several renders into one archive so the browser only downloads once. */
export async function zipFiles(files: ExportFile[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  // Images and video are already compressed, so storing is faster and just as small.
  const packed = zipSync(entries, { level: 0 });
  return new Blob([packed as unknown as BlobPart], { type: "application/zip" });
}
