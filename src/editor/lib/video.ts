import * as THREE from "three";
import { advance } from "@react-three/fiber";
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
  canEncodeVideo,
  type Quality,
  type VideoCodec,
} from "mediabunny";
import { useRuntime } from "../runtime";
import { sceneClock } from "./clock";
import { hideEditorHelpers } from "./export";
import { motionPeriod } from "../presets/motion";
import { hasKeys } from "./keyframes";
import type { EffectInstance, Project } from "../types";
import { effectById, isAnimated } from "../presets/effects";

export type VideoFormat = "mp4" | "webm";
export type VideoQuality = "low" | "medium" | "high" | "very-high";

export type VideoExportOptions = {
  width: number;
  height: number;
  /** Seconds of footage. */
  duration: number;
  fps: number;
  format: VideoFormat;
  quality: VideoQuality;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

const QUALITIES: Record<VideoQuality, Quality> = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  "very-high": QUALITY_VERY_HIGH,
};

const CODECS: Record<VideoFormat, VideoCodec> = { mp4: "avc", webm: "vp9" };

export const FPS_CHOICES = [24, 25, 30, 60];
export const MAX_VIDEO_SECONDS = 30;
export const MAX_VIDEO_SIDE = 2160;

/** H.264 needs even dimensions, and so do most players. */
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function videoSize(width: number, height: number) {
  const longest = Math.max(width, height, 1);
  const scale = Math.min(1, MAX_VIDEO_SIDE / longest);
  return { width: even(width * scale), height: even(height * scale) };
}

export async function isFormatSupported(format: VideoFormat, width: number, height: number) {
  try {
    return await canEncodeVideo(CODECS[format], { width, height });
  } catch {
    return false;
  }
}

/**
 * Renders the scene frame by frame with the clock pinned to exact times and
 * encodes the result in the browser. Nothing leaves the machine.
 */
export async function renderVideo(opts: VideoExportOptions): Promise<Blob> {
  const { gl, scene, camera } = useRuntime.getState();
  if (!gl || !scene || !camera) throw new Error("Renderer not ready");
  if (typeof VideoEncoder === "undefined") {
    throw new Error("This browser has no VideoEncoder, so video export is unavailable");
  }

  const { width, height } = videoSize(opts.width, opts.height);
  const fps = Math.max(1, Math.round(opts.fps));
  const frameCount = Math.max(1, Math.round(opts.duration * fps));
  const frameDuration = 1 / fps;

  const previousSize = gl.getSize(new THREE.Vector2());
  const previousRatio = gl.getPixelRatio();
  const previousAspect = camera.aspect;
  const hidden = hideEditorHelpers(scene);

  const output = new Output({
    format: opts.format === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(gl.domElement, {
    codec: CODECS[opts.format],
    quality: QUALITIES[opts.quality],
    keyFrameInterval: 2,
    // A window resize mid-export should not abort the render.
    sizeChangeBehavior: "cover",
  });
  output.addVideoTrack(source, { frameRate: fps });

  useRuntime.setState({ exporting: true });
  try {
    gl.setPixelRatio(1);
    gl.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    await output.start();

    for (let i = 0; i < frameCount; i++) {
      if (opts.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      const time = i * frameDuration;
      sceneClock.pin(time);
      // Runs every useFrame callback (motion, effect chains) then renders.
      advance(performance.now());
      await source.add(time, frameDuration);
      opts.onProgress?.((i + 1) / frameCount);
    }

    await output.finalize();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Encoding produced no data");
    return new Blob([buffer], { type: opts.format === "mp4" ? "video/mp4" : "video/webm" });
  } catch (err) {
    try {
      await output.cancel();
    } catch {
      // The output may already be finalized or never started.
    }
    throw err;
  } finally {
    useRuntime.setState({ exporting: false });
    sceneClock.release();
    for (const o of hidden) o.visible = true;
    gl.setPixelRatio(previousRatio);
    gl.setSize(previousSize.x, previousSize.y, false);
    camera.aspect = previousAspect;
    camera.updateProjectionMatrix();
    gl.render(scene, camera);
  }
}

export type LoopSuggestion = {
  duration: number;
  /** False when the moving parts cannot all close inside the maximum clip length. */
  exact: boolean;
};

/** Every cycle length in the scene: object motion and animated effects alike. */
function scenePeriods(project: Project): number[] {
  const periods: number[] = [];
  for (const object of project.objects) {
    const motion = motionPeriod(object.motion);
    if (motion !== null && Number.isFinite(motion) && motion > 0) periods.push(motion);
  }
  // Keyframes and animated effects live in the clip, so the clip is a cycle of its own.
  const onClip = (e: EffectInstance) => {
    const def = effectById(e.effectId);
    return e.enabled && ((def ? isAnimated(def) : false) || hasKeys(e.keys));
  };
  const keyed =
    hasKeys(project.camera.keys) ||
    project.objects.some((o) => hasKeys(o.keys) || (o.kind === "cover" && o.effects.some(onClip))) ||
    project.staging.look.some(onClip);
  if (keyed) periods.push(project.clip.duration);
  return periods;
}

/**
 * The shortest clip in which every cycle closes, so the loop has no visible seam.
 * Returns null when nothing in the scene is moving.
 */
export function suggestedLoopDuration(project: Project): LoopSuggestion | null {
  const periods = scenePeriods(project);
  if (periods.length === 0) return null;

  const longest = Math.max(...periods);
  const round = (n: number) => Math.round(n * 100) / 100;

  // Try whole multiples of the longest cycle until they contain every other one.
  for (let k = 1; k * longest <= MAX_VIDEO_SECONDS; k++) {
    const candidate = k * longest;
    const closes = periods.every((p) => {
      const turns = candidate / p;
      return Math.abs(turns - Math.round(turns)) < 0.02;
    });
    if (closes) return { duration: round(candidate), exact: true };
  }
  return { duration: round(Math.min(longest, MAX_VIDEO_SECONDS)), exact: false };
}

export function videoExtension(format: VideoFormat) {
  return format === "mp4" ? "mp4" : "webm";
}
