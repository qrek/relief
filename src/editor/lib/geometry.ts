import * as THREE from "three";
import { ParametricGeometry } from "three/examples/jsm/geometries/ParametricGeometry.js";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Deterministic PRNG so a given seed always rebuilds the same object. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noiseFor(seed: number) {
  return new SimplexNoise({ random: mulberry32(seed) });
}

/** Centres a geometry on its bounding box and scales it so its longest side is `size`. */
export function normalize(geometry: THREE.BufferGeometry, size = 2): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const centre = box.getCenter(new THREE.Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z);
  const extent = box.getSize(new THREE.Vector3());
  const k = size / Math.max(extent.x, extent.y, extent.z, 1e-6);
  geometry.scale(k, k, k);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Normalises several geometries together so their relative proportions survive. */
export function normalizeGroup(geometries: THREE.BufferGeometry[], size = 2) {
  const box = new THREE.Box3();
  for (const g of geometries) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  }
  const centre = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  const k = size / Math.max(extent.x, extent.y, extent.z, 1e-6);
  for (const g of geometries) {
    g.translate(-centre.x, -centre.y, -centre.z);
    g.scale(k, k, k);
    g.computeBoundingBox();
    g.computeBoundingSphere();
  }
  return geometries;
}

/** Splits shared vertices so every triangle gets its own normal: hard, faceted shading. */
export function facet(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = geometry.index ? geometry.toNonIndexed() : geometry;
  if (out !== geometry) geometry.dispose();
  out.computeVertexNormals();
  return out;
}

/** Rotates vertices around Y proportionally to their height. */
export function twistY(geometry: THREE.BufferGeometry, radians: number): THREE.BufferGeometry {
  if (Math.abs(radians) < 1e-4) return geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const minY = box.min.y;
  const height = Math.max(box.max.y - minY, 1e-6);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = ((y - minY) / height - 0.5) * radians;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    pos.setXYZ(i, x * c - z * s, y, x * s + z * c);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Scales the cross-section along Y: k > 0 narrows the top, k < 0 narrows the bottom. */
export function taperY(geometry: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  if (Math.abs(k) < 1e-4) return geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const minY = box.min.y;
  const height = Math.max(box.max.y - minY, 1e-6);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / height;
    const f = Math.max(0.02, 1 - k * t);
    pos.setX(i, pos.getX(i) * f);
    pos.setZ(i, pos.getZ(i) * f);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Pushes every vertex along its normal by 3D simplex noise. */
export function displace(
  geometry: THREE.BufferGeometry,
  amplitude: number,
  frequency: number,
  seed: number,
): THREE.BufferGeometry {
  if (amplitude < 1e-4) return geometry;
  const noise = noiseFor(seed);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const nrm = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  if (!nrm) geometry.computeVertexNormals();
  const normals = geometry.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = noise.noise3d(x * frequency, y * frequency, z * frequency);
    const d = n * amplitude;
    pos.setXYZ(i, x + normals.getX(i) * d, y + normals.getY(i) * d, z + normals.getZ(i) * d);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Flattens everything below `y` onto that plane, as if the object were melting. */
export function flattenBelow(geometry: THREE.BufferGeometry, y: number): THREE.BufferGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < y) pos.setY(i, y);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const signedPow = (x: number, p: number) => Math.sign(x) * Math.abs(x) ** p;

/**
 * Superquadric surface. `e` near 0 gives a cube, 1 gives a sphere, above 1 pinches
 * the form into a star. The single knob covers most of the "inflated" family.
 */
export function superquadric(e1: number, e2: number, segments: number): THREE.BufferGeometry {
  return new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = (v - 0.5) * Math.PI;
      const phi = u * Math.PI * 2;
      const ct = signedPow(Math.cos(theta), e1);
      const st = signedPow(Math.sin(theta), e1);
      target.set(ct * signedPow(Math.cos(phi), e2), st, ct * signedPow(Math.sin(phi), e2));
    },
    segments,
    segments,
  );
}

/** THREE.Curve has a protected constructor, so paths are built on this blank subclass. */
class BlankCurve extends THREE.Curve<THREE.Vector3> {
  // Declared so the inherited protected constructor becomes public.
  constructor() {
    super();
  }
}

/** A curve whose `getPoint` the caller assigns, used for helices, spirals and waves. */
export const emptyCurve = (): THREE.Curve<THREE.Vector3> => new BlankCurve();

/** Sweeps a thin rectangle along a 3D curve: the base of every ribbon and spring. */
export function ribbonAlong(
  curve: THREE.Curve<THREE.Vector3>,
  width: number,
  thickness: number,
  steps: number,
): THREE.BufferGeometry {
  const profile = new THREE.Shape();
  const w = width / 2;
  const t = thickness / 2;
  profile.moveTo(-w, -t);
  profile.lineTo(w, -t);
  profile.lineTo(w, t);
  profile.lineTo(-w, t);
  profile.closePath();
  return new THREE.ExtrudeGeometry(profile, { extrudePath: curve, steps, bevelEnabled: false });
}

/** A closed polygon shape with `points` spikes, used for stars and flowers. */
export function starShape(points: number, innerRatio: number, radius = 1): THREE.Shape {
  const shape = new THREE.Shape();
  const n = Math.max(3, Math.round(points));
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * innerRatio;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function crossShape(arm: number, thickness: number): THREE.Shape {
  const a = arm;
  const t = thickness;
  const shape = new THREE.Shape();
  shape.moveTo(-t, -a);
  shape.lineTo(t, -a);
  shape.lineTo(t, -t);
  shape.lineTo(a, -t);
  shape.lineTo(a, t);
  shape.lineTo(t, t);
  shape.lineTo(t, a);
  shape.lineTo(-t, a);
  shape.lineTo(-t, t);
  shape.lineTo(-a, t);
  shape.lineTo(-a, -t);
  shape.lineTo(-t, -t);
  shape.closePath();
  return shape;
}

export function heartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1);
  shape.bezierCurveTo(-1.4, 0.1, -0.9, 1.15, 0, 0.55);
  shape.bezierCurveTo(0.9, 1.15, 1.4, 0.1, 0, -1);
  return shape;
}

/** Rounds a 2D shape's corners by inflating and deflating its outline. */
export function archShape(width: number, height: number, thickness: number): THREE.Shape {
  const w = width / 2;
  const inner = Math.max(0.05, w - thickness);
  const shape = new THREE.Shape();
  shape.moveTo(-w, -height);
  shape.lineTo(-w, 0);
  shape.absarc(0, 0, w, Math.PI, 0, true);
  shape.lineTo(w, -height);
  shape.lineTo(inner, -height);
  shape.lineTo(inner, 0);
  shape.absarc(0, 0, inner, 0, Math.PI, false);
  shape.lineTo(-inner, -height);
  shape.closePath();
  return shape;
}

export function merge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const cleaned = geometries.map((g) => {
    const c = g.clone();
    // mergeGeometries needs identical attribute sets.
    for (const key of Object.keys(c.attributes)) {
      if (key !== "position" && key !== "normal" && key !== "uv") c.deleteAttribute(key);
    }
    if (!c.attributes.uv) {
      c.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    }
    return c.index ? c.toNonIndexed() : c;
  });
  const merged = mergeGeometries(cleaned, false);
  for (const c of cleaned) c.dispose();
  for (const g of geometries) g.dispose();
  if (!merged) throw new Error("Geometry merge failed");
  merged.computeVertexNormals();
  return merged;
}

/** Builds a lathe from a profile given as [radius, y] pairs. */
export function lathe(profile: [number, number][], segments: number, faceted: boolean) {
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(points, Math.max(3, Math.round(segments)));
  return faceted ? facet(geometry) : geometry;
}

export function transformed(
  geometry: THREE.BufferGeometry,
  { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  },
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(m);
  return geometry;
}
