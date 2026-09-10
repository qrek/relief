import * as THREE from "three";
import { assetUrl, getAsset, putAsset, type AssetMeta } from "./assets";

export type LoadedMedia = {
  texture: THREE.Texture;
  width: number;
  height: number;
  aspect: number;
  video: HTMLVideoElement | null;
};

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];
export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];
export const MAX_MEDIA_BYTES = 80 * 1024 * 1024;

export function mediaTypeOf(format: string): "image" | "video" | null {
  const f = format.toLowerCase();
  if (IMAGE_EXTENSIONS.includes(f)) return "image";
  if (VIDEO_EXTENSIONS.includes(f)) return "video";
  return null;
}

function loadImage(url: string): Promise<LoadedMedia> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      resolve({
        texture,
        width: image.naturalWidth,
        height: image.naturalHeight,
        aspect: image.naturalWidth / Math.max(1, image.naturalHeight),
        video: null,
      });
    };
    image.onerror = () => reject(new Error("This image could not be decoded"));
    image.src = url;
  });
}

function loadVideo(url: string): Promise<LoadedMedia> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.onloadeddata = () => {
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      // Autoplay is allowed because the element is muted.
      void video.play().catch(() => undefined);
      resolve({
        texture,
        width: video.videoWidth,
        height: video.videoHeight,
        aspect: video.videoWidth / Math.max(1, video.videoHeight),
        video,
      });
    };
    video.onerror = () => reject(new Error("This video could not be decoded"));
  });
}

async function build(assetId: string): Promise<LoadedMedia> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("Media not found in your library");
  const kind = mediaTypeOf(asset.format);
  if (!kind) throw new Error(`Unsupported media format: .${asset.format}`);
  const url = await assetUrl(assetId);
  return kind === "video" ? loadVideo(url) : loadImage(url);
}

const cache = new Map<string, Promise<LoadedMedia>>();

export function loadMedia(assetId: string): Promise<LoadedMedia> {
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

export function forgetMedia(assetId: string) {
  const entry = cache.get(assetId);
  cache.delete(assetId);
  void entry?.then((m) => {
    m.video?.pause();
    m.texture.dispose();
  }).catch(() => undefined);
}

/** Stores a canvas capture in the media library so it behaves like any upload. */
export async function storeCapture(blob: Blob, name: string): Promise<AssetMeta> {
  const file = new File([blob], `${name}.png`, { type: "image/png" });
  return putAsset(file, "media");
}
