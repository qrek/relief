import * as THREE from "three";
import { advance } from "@react-three/fiber";
import { useRuntime } from "../runtime";

export type ImageExportOptions = {
  width: number;
  height: number;
  type: "image/png" | "image/jpeg" | "image/webp";
  quality: number;
  transparent: boolean;
  /** Used by "capture from canvas" so a cover never photographs itself. */
  excludeCovers?: boolean;
};

export function maxExportSize(): number {
  const gl = useRuntime.getState().gl;
  if (!gl) return 4096;
  return Math.min(gl.capabilities.maxTextureSize, 16384);
}

/** Flags three sets on the gizmo; which one is present depends on the three version. */
const HELPER_FLAGS = [
  "isTransformControls",
  "isTransformControlsRoot",
  "isTransformControlsGizmo",
  "isTransformControlsPlane",
] as const;

/**
 * An overlay is drawn crisp over the finished frame in the viewport: the gizmo,
 * the light markers, the camera. Anything else flagged `excludeFromExport`
 * (the floor grid) is part of the picture on screen, blurred and printed
 * with it, and simply left out of an export.
 */
function isEditorHelper(o: THREE.Object3D): boolean {
  const marked = o as unknown as Record<string, unknown>;
  return HELPER_FLAGS.some((f) => marked[f] === true) || o.userData?.overlay === true;
}

function isExcludedFromExport(o: THREE.Object3D): boolean {
  return isEditorHelper(o) || o.userData?.excludeFromExport === true;
}

/** Editing aids that belong on screen but never in an exported frame. */
export function hideEditorHelpers(
  scene: THREE.Scene,
  alsoHideCovers = false,
  { overlaysOnly = false }: { overlaysOnly?: boolean } = {},
): THREE.Object3D[] {
  const hidden: THREE.Object3D[] = [];
  const hides = overlaysOnly ? isEditorHelper : isExcludedFromExport;
  scene.traverse((o) => {
    if (!o.visible) return;
    if (hides(o) || (alsoHideCovers && o.userData?.isCover === true)) {
      o.visible = false;
      hidden.push(o);
    }
  });
  return hidden;
}

const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

/**
 * Writes the picture's depth into the canvas, and nothing else, so the aids
 * drawn over a finished frame still sit behind whatever is in front of them:
 * a floor grid runs under the subject instead of across it. Call it while the
 * aids are hidden, after the frame has been finished.
 */
export function writePictureDepth(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const override = scene.overrideMaterial;
  const background = scene.background;
  const autoClear = renderer.autoClear;
  scene.overrideMaterial = depthOnly;
  scene.background = null;
  renderer.autoClear = false;
  renderer.setRenderTarget(null);
  renderer.clearDepth();
  renderer.render(scene, camera);
  scene.overrideMaterial = override;
  scene.background = background;
  renderer.autoClear = autoClear;
}

/**
 * Draws the editing aids over a frame that has already been finished on the
 * canvas. When the frame goes through depth of field or a look, the aids were
 * kept out of it, so they are neither blurred nor halftoned; this puts them
 * back on top, crisp, where a designer needs to see them.
 */
export function drawHelpersOnTop(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let any = false;
  scene.traverse((o) => {
    if (o.visible && isEditorHelper(o)) any = true;
  });
  if (!any) return;

  // Every top-level branch without an aid in it is switched off for this draw.
  const muted: THREE.Object3D[] = [];
  for (const child of scene.children) {
    if (!child.visible) continue;
    let holds = false;
    child.traverse((o) => {
      if (isEditorHelper(o)) holds = true;
    });
    if (!holds) {
      child.visible = false;
      muted.push(child);
    }
  }

  const background = scene.background;
  const autoClear = renderer.autoClear;
  scene.background = null;
  renderer.autoClear = false;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  renderer.autoClear = autoClear;
  scene.background = background;
  for (const o of muted) o.visible = true;
}

/**
 * Renders the scene at an arbitrary resolution and returns the encoded image.
 * The live canvas is resized for a single frame and restored afterwards.
 */
export async function renderImage(opts: ImageExportOptions): Promise<Blob> {
  const { gl, scene, camera } = useRuntime.getState();
  if (!gl || !scene || !camera) throw new Error("Renderer not ready");

  const prevSize = gl.getSize(new THREE.Vector2());
  const prevRatio = gl.getPixelRatio();
  const prevBackground = scene.background;
  const prevAlpha = gl.getClearAlpha();
  const prevAspect = camera.aspect;
  const hidden = hideEditorHelpers(scene, opts.excludeCovers === true);
  // Whatever view is up on screen, the file is the picture through the camera.
  useRuntime.setState({ exporting: true });

  try {
    gl.setPixelRatio(1);
    gl.setSize(opts.width, opts.height, false);
    camera.aspect = opts.width / opts.height;
    camera.updateProjectionMatrix();
    if (opts.transparent) {
      scene.background = null;
      gl.setClearAlpha(0);
    }
    // Going through the frame loop rather than gl.render lets motion, effect
    // chains and camera-locked backdrops settle on the export camera first.
    advance(performance.now());
    const dataUrl = gl.domElement.toDataURL(opts.type, opts.quality);
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    useRuntime.setState({ exporting: false });
    for (const o of hidden) o.visible = true;
    scene.background = prevBackground;
    gl.setClearAlpha(prevAlpha);
    gl.setPixelRatio(prevRatio);
    gl.setSize(prevSize.x, prevSize.y, false);
    camera.aspect = prevAspect;
    camera.updateProjectionMatrix();
    gl.render(scene, camera);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyBlobToClipboard(blob: Blob) {
  if (!("ClipboardItem" in window)) throw new Error("Clipboard images not supported");
  // Browsers only accept PNG on the clipboard.
  const png =
    blob.type === "image/png"
      ? blob
      : await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            c.getContext("2d")!.drawImage(img, 0, 0);
            c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

export function extensionFor(type: ImageExportOptions["type"]) {
  return type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
}
