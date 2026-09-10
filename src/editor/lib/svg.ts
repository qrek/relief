import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { BevelParams } from "../types";

const loader = new SVGLoader();

export type ShapeGeometryParams = BevelParams & { depth: number; size: number };

/**
 * Turns SVG markup into a centred, normalised extruded geometry.
 * Returns null when the SVG has no fillable shapes.
 */
export function buildShapeGeometry(
  svg: string,
  params: ShapeGeometryParams,
): THREE.BufferGeometry | null {
  const data = loader.parse(svg);
  const shapes: THREE.Shape[] = [];
  for (const path of data.paths) {
    const style = path.userData?.style as { fill?: string } | undefined;
    if (style?.fill === "none") continue;
    shapes.push(...SVGLoader.createShapes(path));
  }
  if (shapes.length === 0) return null;

  const bevelScale = params.bevelEnabled ? 1 : 0;
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 1,
    bevelEnabled: params.bevelEnabled,
    bevelThickness: params.bevelThickness * bevelScale,
    bevelSize: params.bevelSize * bevelScale,
    bevelSegments: params.bevelSegments,
    curveSegments: params.curveSegments,
  });

  // SVG space is y-down: rotate around X to flip it while keeping winding.
  geometry.rotateX(Math.PI);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const w = box.max.x - box.min.x;
  const h = box.max.y - box.min.y;
  const s = params.size / Math.max(w, h, 1e-6);
  geometry.scale(s, s, 1);
  // Depth is expressed in world units, independent of the XY normalisation.
  geometry.computeBoundingBox();
  const b2 = geometry.boundingBox!;
  const d = b2.max.z - b2.min.z;
  if (d > 0) geometry.scale(1, 1, params.depth / d);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}
