"use client";

import { useEffect, useMemo } from "react";
import type { ShapeObject } from "../../types";
import { buildShapeGeometry } from "../../lib/svg";
import { ObjectMaterial } from "./ObjectMaterial";

export function ShapeMesh({ obj }: { obj: ShapeObject }) {
  const geometry = useMemo(
    () =>
      buildShapeGeometry(obj.svg, {
        size: obj.size,
        depth: obj.depth,
        bevelEnabled: obj.bevelEnabled,
        bevelThickness: obj.bevelThickness,
        bevelSize: obj.bevelSize,
        bevelSegments: obj.bevelSegments,
        curveSegments: obj.curveSegments,
      }),
    [
      obj.svg,
      obj.size,
      obj.depth,
      obj.bevelEnabled,
      obj.bevelThickness,
      obj.bevelSize,
      obj.bevelSegments,
      obj.curveSegments,
    ],
  );

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <ObjectMaterial params={obj.material} />
    </mesh>
  );
}
