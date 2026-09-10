"use client";

import { use, useEffect, useMemo } from "react";
import type * as THREE from "three";
import type { MaterialParams } from "../../types";
import { artworkKey, buildArtworkTexture, loadArtworkImage } from "../../lib/artwork";

export function ObjectMaterial({ params }: { params: MaterialParams }) {
  const assetId = params.artwork?.assetId ?? null;
  return assetId ? (
    <PrintedMaterial params={params} assetId={assetId} />
  ) : (
    <PlainMaterial params={params} map={null} />
  );
}

/** Suspends while the artwork loads, then prints it onto the material colour. */
function PrintedMaterial({ params, assetId }: { params: MaterialParams; assetId: string }) {
  const image = use(loadArtworkImage(assetId));
  const key = artworkKey(params.artwork, params.color);

  const texture = useMemo(
    () => buildArtworkTexture(image, params.color, params.artwork),
    // The key covers every field the texture is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, key],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return <PlainMaterial params={params} map={texture} />;
}

function PlainMaterial({ params, map }: { params: MaterialParams; map: THREE.Texture | null }) {
  return (
    <meshPhysicalMaterial
      key={`${params.flatShading}-${map ? "printed" : "plain"}`}
      map={map}
      // The artwork already carries the colour, so tinting it again would darken it.
      color={map ? "#ffffff" : params.color}
      roughness={params.roughness}
      metalness={params.metalness}
      clearcoat={params.clearcoat}
      clearcoatRoughness={params.clearcoatRoughness}
      transmission={params.transmission}
      thickness={params.thickness}
      ior={params.ior}
      iridescence={params.iridescence}
      sheen={params.sheen}
      sheenColor={params.sheenColor}
      emissive={params.emissive}
      emissiveIntensity={params.emissiveIntensity}
      opacity={params.opacity}
      transparent={params.opacity < 1}
      flatShading={params.flatShading}
      envMapIntensity={params.envMapIntensity}
    />
  );
}
