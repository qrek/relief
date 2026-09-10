import * as THREE from "three";
import { assetUrl, getAsset } from "./assets";
import type { Artwork } from "../types";

const SURFACE = 1024;

const images = new Map<string, Promise<HTMLImageElement>>();

/** Loads a media asset as a plain image, cached, so it can be printed onto a surface. */
export function loadArtworkImage(assetId: string): Promise<HTMLImageElement> {
  let entry = images.get(assetId);
  if (!entry) {
    entry = (async () => {
      const asset = await getAsset(assetId);
      if (!asset) throw new Error("Artwork not found in your library");
      const url = await assetUrl(assetId);
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This artwork could not be decoded"));
        image.src = url;
      });
    })().catch((err) => {
      images.delete(assetId);
      throw err;
    });
    images.set(assetId, entry);
  }
  return entry;
}

export function forgetArtwork(assetId: string) {
  images.delete(assetId);
}

/**
 * Prints the artwork onto a square of the material's own colour and returns it
 * as a texture. Compositing here rather than using an alpha map keeps the
 * surface opaque, which is what a printed label actually looks like.
 */
export function buildArtworkTexture(
  image: HTMLImageElement,
  baseColor: string,
  artwork: Artwork,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SURFACE;
  canvas.height = SURFACE;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, SURFACE, SURFACE);

  const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
  ctx.save();
  ctx.translate(SURFACE / 2, SURFACE / 2);
  ctx.rotate(artwork.rotation);
  if (artwork.tile) {
    // Pattern mode: the artwork covers the tile edge to edge.
    ctx.drawImage(image, -SURFACE * 0.75, -SURFACE * 0.75, SURFACE * 1.5, (SURFACE * 1.5) / aspect);
  } else {
    const drawHeight = SURFACE * Math.max(0.02, artwork.scale) * 0.5;
    ctx.drawImage(image, (-drawHeight * aspect) / 2, -drawHeight / 2, drawHeight * aspect, drawHeight);
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The tile's border is flat material colour, so repeating never shows a seam.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(0.1, artwork.repeat), 1);
  // Offsetting the lookup turns the label around the object rather than moving
  // it inside its tile, which is what "around a can" has to mean.
  texture.offset.set(artwork.offsetX, artwork.offsetY);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** A stable key so the texture is only rebuilt when something visible changes. */
export function artworkKey(artwork: Artwork, baseColor: string): string {
  return [
    artwork.assetId,
    baseColor,
    artwork.repeat,
    artwork.scale,
    artwork.offsetX,
    artwork.offsetY,
    artwork.rotation,
    artwork.tile,
  ].join("|");
}
