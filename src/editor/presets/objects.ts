import * as THREE from "three";
import {
  archShape,
  crossShape,
  displace,
  emptyCurve,
  facet,
  flattenBelow,
  heartShape,
  lathe,
  merge,
  mulberry32,
  normalize,
  normalizeGroup,
  ribbonAlong,
  starShape,
  superquadric,
  taperY,
  transformed,
  twistY,
} from "../lib/geometry";

export type ParamDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

export type GeneratedPart = {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
};

export type ObjectPreset = {
  id: string;
  name: string;
  collection: string;
  params: ParamDef[];
  build: (p: Record<string, number>) => GeneratedPart[];
};

const P = {
  detail: (def = 48, min = 6, max = 128): ParamDef => ({
    key: "detail",
    label: "Detail",
    min,
    max,
    step: 1,
    default: def,
  }),
  round: (def = 0.25): ParamDef => ({ key: "round", label: "Roundness", min: 0, max: 0.5, step: 0.01, default: def }),
  twist: (def = 0): ParamDef => ({ key: "twist", label: "Twist", min: -360, max: 360, step: 1, default: def }),
  taper: (def = 0): ParamDef => ({ key: "taper", label: "Taper", min: -1, max: 1, step: 0.01, default: def }),
  height: (def = 1.6, max = 4): ParamDef => ({ key: "height", label: "Height", min: 0.2, max, step: 0.01, default: def }),
  tube: (def = 0.3): ParamDef => ({ key: "tube", label: "Thickness", min: 0.03, max: 0.6, step: 0.01, default: def }),
  sides: (def = 6, min = 3, max = 16): ParamDef => ({ key: "sides", label: "Sides", min, max, step: 1, default: def }),
  count: (def = 3, min = 2, max = 8): ParamDef => ({ key: "count", label: "Count", min, max, step: 1, default: def }),
  seed: (def = 1): ParamDef => ({ key: "seed", label: "Seed", min: 1, max: 200, step: 1, default: def }),
  amount: (label: string, def: number, min = 0, max = 1): ParamDef => ({
    key: "amount",
    label,
    min,
    max,
    step: 0.01,
    default: def,
  }),
  inflate: (def = 0.6): ParamDef => ({ key: "inflate", label: "Inflate", min: 0.05, max: 1, step: 0.01, default: def }),
};

/** Wraps a single geometry as the sole part of an object. */
const solo = (name: string, geometry: THREE.BufferGeometry): GeneratedPart[] => [
  { id: "body", name, geometry: normalize(geometry) },
];

const deg = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Simple
// ---------------------------------------------------------------------------

const simple: ObjectPreset[] = [
  {
    id: "cube",
    name: "Cube",
    collection: "Simple",
    params: [P.round(0.12), P.twist(), P.detail(8, 2, 16)],
    build: (p) => {
      const g = new THREE.BoxGeometry(1, 1, 1, 24, 24, 24);
      const rounded = p.round > 0.005 ? roundBox(1, 1, 1, p.round, Math.round(p.detail)) : g;
      if (rounded !== g) g.dispose();
      return solo("Cube", twistY(rounded, deg(p.twist)));
    },
  },
  {
    id: "sphere",
    name: "Sphere",
    collection: "Simple",
    params: [P.detail(64), P.amount("Squash", 0, -0.6, 0.6)],
    build: (p) => {
      const d = Math.round(p.detail);
      const g = new THREE.SphereGeometry(1, d, Math.max(4, Math.round(d / 2)));
      g.scale(1, 1 - p.amount, 1);
      return solo("Sphere", g);
    },
  },
  {
    id: "cylinder",
    name: "Cylinder",
    collection: "Simple",
    params: [P.detail(64, 3, 128), P.height(2), P.taper(), P.twist()],
    build: (p) => {
      const g = new THREE.CylinderGeometry(1, 1, p.height, Math.round(p.detail), 24);
      return solo("Cylinder", twistY(taperY(g, p.taper), deg(p.twist)));
    },
  },
  {
    id: "cone",
    name: "Cone",
    collection: "Simple",
    params: [P.detail(64, 3, 128), P.height(2), P.twist()],
    build: (p) => solo("Cone", twistY(new THREE.ConeGeometry(1, p.height, Math.round(p.detail), 16), deg(p.twist))),
  },
  {
    id: "capsule",
    name: "Capsule",
    collection: "Simple",
    params: [P.detail(48, 6, 96), P.height(1.6)],
    build: (p) => solo("Capsule", new THREE.CapsuleGeometry(0.7, p.height, 16, Math.round(p.detail))),
  },
  {
    id: "torus",
    name: "Torus",
    collection: "Simple",
    params: [P.tube(0.35), P.detail(96, 12, 200), P.twist()],
    build: (p) =>
      solo("Torus", twistY(new THREE.TorusGeometry(1, p.tube, 32, Math.round(p.detail)), deg(p.twist))),
  },
  {
    id: "pyramid",
    name: "Pyramid",
    collection: "Simple",
    params: [P.sides(4, 3, 12), P.height(1.8)],
    build: (p) => solo("Pyramid", facet(new THREE.ConeGeometry(1, p.height, Math.round(p.sides), 1))),
  },
  {
    id: "icosahedron",
    name: "Icosahedron",
    collection: "Simple",
    params: [{ key: "detail", label: "Subdivide", min: 0, max: 4, step: 1, default: 0 }],
    build: (p) => solo("Icosahedron", facet(new THREE.IcosahedronGeometry(1, Math.round(p.detail)))),
  },
  {
    id: "octahedron",
    name: "Octahedron",
    collection: "Simple",
    params: [{ key: "detail", label: "Subdivide", min: 0, max: 4, step: 1, default: 0 }],
    build: (p) => solo("Octahedron", facet(new THREE.OctahedronGeometry(1, Math.round(p.detail)))),
  },
  {
    id: "dodecahedron",
    name: "Dodecahedron",
    collection: "Simple",
    params: [{ key: "detail", label: "Subdivide", min: 0, max: 4, step: 1, default: 0 }],
    build: (p) => solo("Dodecahedron", facet(new THREE.DodecahedronGeometry(1, Math.round(p.detail)))),
  },
  {
    id: "disc",
    name: "Disc",
    collection: "Simple",
    params: [P.detail(96, 6, 200), { key: "height", label: "Thickness", min: 0.05, max: 1.2, step: 0.01, default: 0.3 }],
    build: (p) => solo("Disc", new THREE.CylinderGeometry(1, 1, p.height, Math.round(p.detail), 1)),
  },
  {
    id: "pipe",
    name: "Pipe",
    collection: "Simple",
    params: [P.detail(96, 6, 200), P.height(2), P.tube(0.25)],
    build: (p) => {
      const outer = new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2, false);
      const hole = new THREE.Path().absarc(0, 0, Math.max(0.05, 1 - p.tube), 0, Math.PI * 2, true);
      outer.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(outer, {
        depth: p.height,
        bevelEnabled: false,
        curveSegments: Math.round(p.detail / 2),
      });
      g.rotateX(-Math.PI / 2);
      return solo("Pipe", g);
    },
  },
];

/**
 * A rounded box built from a superquadric rather than RoundedBoxGeometry, so the
 * roundness slider runs continuously from a hard cube into the Inflated family.
 */
function roundBox(w: number, h: number, d: number, radius: number, segments: number) {
  const e = THREE.MathUtils.mapLinear(radius, 0, 0.5, 0.06, 1);
  const sq = superquadric(e, e, Math.max(12, segments * 6));
  sq.scale(w / 2, h / 2, d / 2);
  return sq;
}

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------

const loops: ObjectPreset[] = [
  {
    id: "torus-knot",
    name: "Torus Knot",
    collection: "Loops",
    params: [
      { key: "p", label: "Winds", min: 1, max: 8, step: 1, default: 2 },
      { key: "q", label: "Turns", min: 1, max: 9, step: 1, default: 3 },
      P.tube(0.28),
      P.detail(160, 32, 400),
    ],
    build: (p) =>
      solo(
        "Knot",
        new THREE.TorusKnotGeometry(1, p.tube, Math.round(p.detail), 24, Math.round(p.p), Math.round(p.q)),
      ),
  },
  {
    id: "trefoil",
    name: "Trefoil",
    collection: "Loops",
    params: [P.tube(0.24), P.detail(200, 48, 400)],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) => {
        const a = t * Math.PI * 2;
        return target.set(
          Math.sin(a) + 2 * Math.sin(2 * a),
          Math.cos(a) - 2 * Math.cos(2 * a),
          -Math.sin(3 * a),
        );
      };
      return solo("Trefoil", new THREE.TubeGeometry(curve, Math.round(p.detail), p.tube * 1.6, 20, true));
    },
  },
  {
    id: "chain",
    name: "Chain",
    collection: "Loops",
    params: [P.count(4, 2, 8), P.tube(0.22), P.detail(80, 16, 160)],
    build: (p) => {
      const n = Math.round(p.count);
      const parts: GeneratedPart[] = [];
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const g = new THREE.TorusGeometry(1, p.tube, 18, Math.round(p.detail));
        transformed(g, {
          position: [0, i * (2 - p.tube * 2.2), 0],
          rotation: [0, i % 2 === 0 ? 0 : Math.PI / 2, 0],
        });
        geos.push(g);
        parts.push({ id: `link-${i}`, name: `Link ${i + 1}`, geometry: g });
      }
      normalizeGroup(geos);
      return parts;
    },
  },
  {
    id: "spring",
    name: "Spring",
    collection: "Loops",
    params: [
      { key: "turns", label: "Turns", min: 1, max: 12, step: 0.5, default: 4 },
      P.tube(0.16),
      P.height(2.4),
      P.detail(240, 48, 500),
    ],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) => {
        const a = t * Math.PI * 2 * p.turns;
        return target.set(Math.cos(a), (t - 0.5) * p.height * 2, Math.sin(a));
      };
      return solo("Spring", new THREE.TubeGeometry(curve, Math.round(p.detail), p.tube, 16, false));
    },
  },
  {
    id: "helix-ribbon",
    name: "Helix Ribbon",
    collection: "Loops",
    params: [
      { key: "turns", label: "Turns", min: 0.5, max: 8, step: 0.25, default: 2.5 },
      { key: "width", label: "Width", min: 0.1, max: 1.2, step: 0.01, default: 0.5 },
      P.height(2.4),
      P.detail(200, 48, 400),
    ],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) => {
        const a = t * Math.PI * 2 * p.turns;
        return target.set(Math.cos(a), (t - 0.5) * p.height * 2, Math.sin(a));
      };
      return solo("Ribbon", ribbonAlong(curve, p.width, 0.06, Math.round(p.detail)));
    },
  },
  {
    id: "ring-stack",
    name: "Ring Stack",
    collection: "Loops",
    params: [P.count(3, 2, 6), P.tube(0.16), P.detail(96, 16, 200)],
    build: (p) => {
      const n = Math.round(p.count);
      const parts: GeneratedPart[] = [];
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const r = 1 - (i / n) * 0.45;
        const g = new THREE.TorusGeometry(r, p.tube, 18, Math.round(p.detail));
        transformed(g, { position: [0, i * p.tube * 2.4, 0], rotation: [-Math.PI / 2, 0, 0] });
        geos.push(g);
        parts.push({ id: `ring-${i}`, name: `Ring ${i + 1}`, geometry: g });
      }
      normalizeGroup(geos);
      return parts;
    },
  },
  {
    id: "mobius",
    name: "Möbius",
    collection: "Loops",
    params: [
      { key: "width", label: "Width", min: 0.1, max: 1, step: 0.01, default: 0.45 },
      P.detail(220, 48, 400),
    ],
    build: (p) => {
      const steps = Math.round(p.detail);
      const positions: number[] = [];
      const half = p.width / 2;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        for (const s of [-half, half]) {
          const r = 1 + s * Math.cos(t / 2);
          positions.push(r * Math.cos(t), s * Math.sin(t / 2), r * Math.sin(t));
        }
      }
      const indices: number[] = [];
      for (let i = 0; i < steps; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return solo("Möbius", g);
    },
  },
  {
    id: "spiral",
    name: "Spiral",
    collection: "Loops",
    params: [
      { key: "turns", label: "Turns", min: 1, max: 8, step: 0.25, default: 3 },
      P.tube(0.12),
      P.detail(240, 48, 500),
    ],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) => {
        const a = t * Math.PI * 2 * p.turns;
        const r = 0.15 + t * 1.1;
        return target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      };
      return solo("Spiral", new THREE.TubeGeometry(curve, Math.round(p.detail), p.tube, 16, false));
    },
  },
];

// ---------------------------------------------------------------------------
// Inflated
// ---------------------------------------------------------------------------

const inflated: ObjectPreset[] = [
  {
    id: "puffy-cube",
    name: "Puffy Cube",
    collection: "Inflated",
    params: [P.inflate(0.45), P.twist(), P.detail(72, 16, 160)],
    build: (p) => solo("Puffy Cube", twistY(superquadric(p.inflate, p.inflate, Math.round(p.detail)), deg(p.twist))),
  },
  {
    id: "pillow",
    name: "Pillow",
    collection: "Inflated",
    params: [P.inflate(0.5), P.detail(72, 16, 160), P.amount("Flatten", 0.5, 0, 0.85)],
    build: (p) => {
      const g = superquadric(p.inflate, p.inflate, Math.round(p.detail));
      g.scale(1, 1 - p.amount, 1);
      return solo("Pillow", g);
    },
  },
  {
    id: "puffy-star",
    name: "Puffy Star",
    collection: "Inflated",
    params: [
      { key: "sides", label: "Points", min: 3, max: 12, step: 1, default: 5 },
      P.inflate(0.55),
      { key: "height", label: "Depth", min: 0.2, max: 2, step: 0.01, default: 0.8 },
    ],
    build: (p) => {
      const shape = starShape(Math.round(p.sides), 0.5);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: p.height,
        bevelEnabled: true,
        bevelSize: p.inflate * 0.4,
        bevelThickness: p.inflate * 0.4,
        bevelSegments: 8,
        curveSegments: 8,
      });
      g.rotateX(-Math.PI / 2);
      return solo("Star", g);
    },
  },
  {
    id: "balloon",
    name: "Balloon",
    collection: "Inflated",
    params: [P.detail(72, 16, 160), P.amount("Neck", 0.35, 0, 0.8)],
    build: (p) => {
      const g = superquadric(1, 1, Math.round(p.detail));
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const k = 1 - p.amount * Math.max(0, -y) ** 2;
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      g.scale(1, 1.2, 1);
      return solo("Balloon", g);
    },
  },
  {
    id: "inflated-ring",
    name: "Inflated Ring",
    collection: "Inflated",
    params: [P.tube(0.45), P.detail(120, 24, 240), P.amount("Squash", 0.25, 0, 0.7)],
    build: (p) => {
      const g = new THREE.TorusGeometry(1, p.tube, 32, Math.round(p.detail));
      g.rotateX(-Math.PI / 2);
      g.scale(1, 1 - p.amount, 1);
      return solo("Ring", g);
    },
  },
  {
    id: "puffy-cross",
    name: "Puffy Cross",
    collection: "Inflated",
    params: [
      { key: "amount", label: "Arm width", min: 0.15, max: 0.6, step: 0.01, default: 0.33 },
      P.inflate(0.35),
      { key: "height", label: "Depth", min: 0.2, max: 2, step: 0.01, default: 0.7 },
    ],
    build: (p) => {
      const g = new THREE.ExtrudeGeometry(crossShape(1, p.amount), {
        depth: p.height,
        bevelEnabled: true,
        bevelSize: p.inflate * 0.5,
        bevelThickness: p.inflate * 0.5,
        bevelSegments: 8,
        curveSegments: 6,
      });
      g.rotateX(-Math.PI / 2);
      return solo("Cross", g);
    },
  },
  {
    id: "puff-heart",
    name: "Puff Heart",
    collection: "Inflated",
    params: [P.inflate(0.5), { key: "height", label: "Depth", min: 0.2, max: 2, step: 0.01, default: 0.7 }],
    build: (p) => {
      const g = new THREE.ExtrudeGeometry(heartShape(), {
        depth: p.height,
        bevelEnabled: true,
        bevelSize: p.inflate * 0.5,
        bevelThickness: p.inflate * 0.5,
        bevelSegments: 10,
        curveSegments: 24,
      });
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.PI);
      return solo("Heart", g);
    },
  },
  {
    id: "bubbles",
    name: "Bubbles",
    collection: "Inflated",
    params: [P.count(4, 2, 8), P.seed(3), P.detail(48, 12, 96)],
    build: (p) => {
      const rand = mulberry32(Math.round(p.seed));
      const n = Math.round(p.count);
      const parts: GeneratedPart[] = [];
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const r = 0.45 + rand() * 0.55;
        const g = new THREE.SphereGeometry(r, Math.round(p.detail), Math.round(p.detail / 2));
        transformed(g, {
          position: [(rand() - 0.5) * 2.2, (rand() - 0.5) * 2.2, (rand() - 0.5) * 1.6],
        });
        geos.push(g);
        parts.push({ id: `bubble-${i}`, name: `Bubble ${i + 1}`, geometry: g });
      }
      normalizeGroup(geos);
      return parts;
    },
  },
];

// ---------------------------------------------------------------------------
// Organics
// ---------------------------------------------------------------------------

const organics: ObjectPreset[] = [
  {
    id: "blob",
    name: "Blob",
    collection: "Organics",
    params: [
      { key: "amount", label: "Bumpiness", min: 0, max: 0.8, step: 0.01, default: 0.3 },
      { key: "freq", label: "Frequency", min: 0.3, max: 4, step: 0.05, default: 1.2 },
      P.seed(7),
      P.detail(96, 24, 200),
    ],
    build: (p) => {
      const d = Math.round(p.detail);
      const g = new THREE.SphereGeometry(1, d, Math.round(d / 2));
      return solo("Blob", displace(g, p.amount, p.freq, Math.round(p.seed)));
    },
  },
  {
    id: "pebble",
    name: "Pebble",
    collection: "Organics",
    params: [
      { key: "amount", label: "Bumpiness", min: 0, max: 0.5, step: 0.01, default: 0.16 },
      P.seed(12),
      P.detail(96, 24, 200),
    ],
    build: (p) => {
      const d = Math.round(p.detail);
      const g = new THREE.SphereGeometry(1, d, Math.round(d / 2));
      g.scale(1.35, 0.75, 1);
      return solo("Pebble", displace(g, p.amount, 1.1, Math.round(p.seed)));
    },
  },
  {
    id: "pod",
    name: "Pod",
    collection: "Organics",
    params: [P.inflate(1.5), P.detail(96, 24, 200), P.twist()],
    build: (p) => {
      const g = superquadric(p.inflate, 1, Math.round(p.detail));
      g.scale(0.7, 1.4, 0.7);
      return solo("Pod", twistY(g, deg(p.twist)));
    },
  },
  {
    id: "drop",
    name: "Drop",
    collection: "Organics",
    params: [P.detail(96, 12, 200), { key: "height", label: "Point", min: 0.6, max: 3, step: 0.01, default: 1.6 }],
    build: (p) => {
      const profile: [number, number][] = [];
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -1 + t * (1 + p.height);
        const r = Math.sin(t * Math.PI) ** 1.4 * (1 - t * 0.55);
        profile.push([Math.max(0.001, r), y]);
      }
      return solo("Drop", lathe(profile, Math.round(p.detail), false));
    },
  },
  {
    id: "coral",
    name: "Coral",
    collection: "Organics",
    params: [P.count(5, 3, 10), P.seed(4), P.tube(0.14)],
    build: (p) => {
      const rand = mulberry32(Math.round(p.seed));
      const n = Math.round(p.count);
      const branches: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const lean = (rand() - 0.5) * 1.1;
        const twist = (rand() - 0.5) * 1.6;
        const h = 1.2 + rand() * 1.2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(lean * 0.3, h * 0.4, twist * 0.3),
          new THREE.Vector3(lean * 0.9, h * 0.8, twist * 0.8),
          new THREE.Vector3(lean * 1.3, h, twist * 1.2),
        ]);
        const g = new THREE.TubeGeometry(curve, 40, p.tube, 12, false);
        transformed(g, { rotation: [0, (i / n) * Math.PI * 2, 0] });
        branches.push(g);
      }
      const base = new THREE.SphereGeometry(0.45, 24, 16);
      base.scale(1, 0.6, 1);
      const parts: GeneratedPart[] = [
        { id: "base", name: "Base", geometry: base },
        { id: "branches", name: "Branches", geometry: merge(branches) },
      ];
      normalizeGroup(parts.map((x) => x.geometry));
      return parts;
    },
  },
  {
    id: "wave",
    name: "Wave",
    collection: "Organics",
    params: [
      { key: "turns", label: "Waves", min: 0.5, max: 5, step: 0.25, default: 2 },
      { key: "width", label: "Width", min: 0.2, max: 2, step: 0.01, default: 0.9 },
      { key: "amount", label: "Amplitude", min: 0.1, max: 1.5, step: 0.01, default: 0.6 },
      P.detail(160, 32, 400),
    ],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) =>
        target.set((t - 0.5) * 4, Math.sin(t * Math.PI * 2 * p.turns) * p.amount, 0);
      return solo("Wave", ribbonAlong(curve, p.width, 0.08, Math.round(p.detail)));
    },
  },
  {
    id: "melt",
    name: "Melt",
    collection: "Organics",
    params: [
      { key: "amount", label: "Bumpiness", min: 0, max: 0.6, step: 0.01, default: 0.22 },
      P.seed(9),
      P.detail(96, 24, 200),
    ],
    build: (p) => {
      const d = Math.round(p.detail);
      const g = new THREE.SphereGeometry(1, d, Math.round(d / 2));
      displace(g, p.amount, 1.4, Math.round(p.seed));
      taperY(g, -0.55);
      return solo("Melt", flattenBelow(g, -0.85));
    },
  },
  {
    id: "seed",
    name: "Seed",
    collection: "Organics",
    params: [P.inflate(1.7), P.detail(96, 24, 200), P.amount("Stretch", 0.5, 0, 1.2)],
    build: (p) => {
      const g = superquadric(p.inflate, 0.9, Math.round(p.detail));
      g.scale(0.75, 1 + p.amount, 0.75);
      return solo("Seed", g);
    },
  },
];

// ---------------------------------------------------------------------------
// Gems
// ---------------------------------------------------------------------------

const gems: ObjectPreset[] = [
  {
    id: "brilliant",
    name: "Brilliant",
    collection: "Gems",
    params: [P.sides(8, 4, 24), { key: "height", label: "Depth", min: 0.4, max: 2.5, step: 0.01, default: 1.3 }],
    build: (p) =>
      solo(
        "Brilliant",
        lathe(
          [
            [0.001, -p.height],
            [0.55, -p.height * 0.45],
            [1, 0],
            [0.98, 0.12],
            [0.55, 0.38],
            [0.001, 0.38],
          ],
          Math.round(p.sides),
          true,
        ),
      ),
  },
  {
    id: "emerald",
    name: "Emerald Cut",
    collection: "Gems",
    params: [P.sides(8, 4, 16), { key: "height", label: "Depth", min: 0.4, max: 2.5, step: 0.01, default: 1.1 }],
    build: (p) =>
      solo(
        "Emerald",
        lathe(
          [
            [0.35, -p.height],
            [0.62, -p.height * 0.6],
            [0.85, -p.height * 0.25],
            [1, 0],
            [0.85, 0.2],
            [0.62, 0.34],
            [0.001, 0.34],
          ],
          Math.round(p.sides),
          true,
        ),
      ),
  },
  {
    id: "marquise",
    name: "Marquise",
    collection: "Gems",
    params: [P.sides(10, 4, 20), P.amount("Elongate", 0.7, 0, 1.5)],
    build: (p) => {
      const g = lathe(
        [
          [0.001, -1.1],
          [0.6, -0.45],
          [1, 0],
          [0.6, 0.3],
          [0.001, 0.36],
        ],
        Math.round(p.sides),
        true,
      );
      g.scale(1, 1, 1 / (1 + p.amount));
      return solo("Marquise", g);
    },
  },
  {
    id: "cabochon",
    name: "Cabochon",
    collection: "Gems",
    params: [P.detail(96, 12, 200), P.amount("Dome", 0.6, 0.2, 1.2)],
    build: (p) => {
      const profile: [number, number][] = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        profile.push([Math.max(0.001, Math.cos((t * Math.PI) / 2)), Math.sin((t * Math.PI) / 2) * p.amount]);
      }
      profile.unshift([0.001, 0]);
      return solo("Cabochon", lathe(profile, Math.round(p.detail), false));
    },
  },
  {
    id: "prism",
    name: "Prism",
    collection: "Gems",
    params: [P.sides(3, 3, 12), P.height(2.2), P.twist()],
    build: (p) =>
      solo("Prism", twistY(facet(new THREE.CylinderGeometry(1, 1, p.height, Math.round(p.sides), 1)), deg(p.twist))),
  },
  {
    id: "crystal",
    name: "Crystal",
    collection: "Gems",
    params: [P.sides(6, 3, 12), P.height(2.4), P.amount("Point", 0.6, 0.1, 1.4)],
    build: (p) =>
      solo(
        "Crystal",
        lathe(
          [
            [0.001, -p.height / 2 - p.amount],
            [1, -p.height / 2],
            [1, p.height / 2],
            [0.001, p.height / 2 + p.amount],
          ],
          Math.round(p.sides),
          true,
        ),
      ),
  },
  {
    id: "cluster",
    name: "Crystal Cluster",
    collection: "Gems",
    params: [P.count(4, 2, 7), P.seed(5), P.sides(6, 3, 10)],
    build: (p) => {
      const rand = mulberry32(Math.round(p.seed));
      const n = Math.round(p.count);
      const parts: GeneratedPart[] = [];
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const h = 1 + rand() * 1.6;
        const r = 0.22 + rand() * 0.22;
        const g = lathe(
          [
            [0.001, -h / 2 - 0.2],
            [1, -h / 2],
            [1, h / 2],
            [0.001, h / 2 + 0.45],
          ],
          Math.round(p.sides),
          true,
        );
        g.scale(r, 1, r);
        transformed(g, {
          position: [(rand() - 0.5) * 1.1, h / 2 - 0.6, (rand() - 0.5) * 1.1],
          rotation: [(rand() - 0.5) * 0.7, rand() * Math.PI, (rand() - 0.5) * 0.7],
        });
        geos.push(g);
        parts.push({ id: `crystal-${i}`, name: `Crystal ${i + 1}`, geometry: g });
      }
      normalizeGroup(geos);
      return parts;
    },
  },
];

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const forms: ObjectPreset[] = [
  {
    id: "arch",
    name: "Arch",
    collection: "Forms",
    params: [
      { key: "amount", label: "Thickness", min: 0.1, max: 0.8, step: 0.01, default: 0.28 },
      P.height(1.4, 3),
      { key: "tube", label: "Depth", min: 0.1, max: 1.5, step: 0.01, default: 0.4 },
    ],
    build: (p) => {
      const g = new THREE.ExtrudeGeometry(archShape(2, p.height, p.amount * 2), {
        depth: p.tube,
        bevelEnabled: false,
        curveSegments: 32,
      });
      return solo("Arch", g);
    },
  },
  {
    id: "column",
    name: "Column",
    collection: "Forms",
    params: [P.sides(24, 3, 48), P.height(2.6, 5), P.taper(0.15)],
    build: (p) => {
      const sides = Math.round(p.sides);
      const shaft = new THREE.CylinderGeometry(0.55, 0.55, p.height, sides, 12);
      taperY(shaft, p.taper);
      const base = new THREE.CylinderGeometry(0.85, 0.95, 0.3, sides, 1);
      transformed(base, { position: [0, -p.height / 2 - 0.15, 0] });
      const capital = new THREE.CylinderGeometry(0.95, 0.75, 0.32, sides, 1);
      transformed(capital, { position: [0, p.height / 2 + 0.16, 0] });
      const parts: GeneratedPart[] = [
        { id: "base", name: "Base", geometry: base },
        { id: "shaft", name: "Shaft", geometry: shaft },
        { id: "capital", name: "Capital", geometry: capital },
      ];
      normalizeGroup(parts.map((x) => x.geometry));
      return parts;
    },
  },
  {
    id: "steps",
    name: "Steps",
    collection: "Forms",
    params: [P.count(5, 2, 12), { key: "width", label: "Width", min: 0.5, max: 3, step: 0.01, default: 1.4 }],
    build: (p) => {
      const n = Math.round(p.count);
      const parts: GeneratedPart[] = [];
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const g = new THREE.BoxGeometry(p.width, 0.4, 0.6);
        transformed(g, { position: [0, i * 0.4, -i * 0.6] });
        geos.push(g);
        parts.push({ id: `step-${i}`, name: `Step ${i + 1}`, geometry: g });
      }
      normalizeGroup(geos);
      return parts;
    },
  },
  {
    id: "lattice",
    name: "Lattice",
    collection: "Forms",
    params: [
      { key: "count", label: "Grid", min: 2, max: 8, step: 1, default: 4 },
      { key: "tube", label: "Bar", min: 0.04, max: 0.3, step: 0.01, default: 0.1 },
    ],
    build: (p) => {
      const n = Math.round(p.count);
      const bars: THREE.BufferGeometry[] = [];
      const span = 2;
      for (let i = 0; i <= n; i++) {
        const t = (i / n - 0.5) * span;
        const h = new THREE.BoxGeometry(span + p.tube, p.tube, p.tube);
        transformed(h, { position: [0, t, 0] });
        bars.push(h);
        const v = new THREE.BoxGeometry(p.tube, span + p.tube, p.tube);
        transformed(v, { position: [t, 0, 0] });
        bars.push(v);
      }
      return solo("Lattice", merge(bars));
    },
  },
  {
    id: "twisted-bar",
    name: "Twisted Bar",
    collection: "Forms",
    params: [P.sides(4, 3, 16), P.height(3, 5), P.twist(180)],
    build: (p) => {
      const g = new THREE.CylinderGeometry(0.7, 0.7, p.height, Math.round(p.sides), 96);
      return solo("Bar", facet(twistY(g, deg(p.twist))));
    },
  },
  {
    id: "cross",
    name: "Cross",
    collection: "Forms",
    params: [
      { key: "amount", label: "Arm width", min: 0.12, max: 0.6, step: 0.01, default: 0.28 },
      { key: "height", label: "Depth", min: 0.1, max: 2, step: 0.01, default: 0.45 },
    ],
    build: (p) => {
      const g = new THREE.ExtrudeGeometry(crossShape(1, p.amount), { depth: p.height, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      return solo("Cross", g);
    },
  },
  {
    id: "ribbon-loop",
    name: "Ribbon Loop",
    collection: "Forms",
    params: [
      { key: "width", label: "Width", min: 0.1, max: 1.2, step: 0.01, default: 0.4 },
      { key: "amount", label: "Wobble", min: 0, max: 1.2, step: 0.01, default: 0.45 },
      P.detail(200, 48, 400),
    ],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) => {
        const a = t * Math.PI * 2;
        return target.set(Math.cos(a), Math.sin(a * 2) * p.amount, Math.sin(a));
      };
      return solo("Ribbon", ribbonAlong(curve, p.width, 0.06, Math.round(p.detail)));
    },
  },
  {
    id: "panel",
    name: "Wave Panel",
    collection: "Forms",
    params: [
      { key: "turns", label: "Waves", min: 1, max: 8, step: 0.5, default: 3 },
      { key: "amount", label: "Amplitude", min: 0.05, max: 0.8, step: 0.01, default: 0.28 },
      { key: "tube", label: "Thickness", min: 0.03, max: 0.4, step: 0.01, default: 0.1 },
      P.detail(120, 24, 300),
    ],
    build: (p) => {
      const curve = emptyCurve();
      curve.getPoint = (t, target = new THREE.Vector3()) =>
        target.set((t - 0.5) * 3, 0, Math.sin(t * Math.PI * 2 * p.turns) * p.amount);
      return solo("Panel", ribbonAlong(curve, 2, p.tube, Math.round(p.detail)));
    },
  },
];



// ---------------------------------------------------------------------------
// Packaging: shapes made to carry a printed label
// ---------------------------------------------------------------------------

/**
 * These use lathes and cylinders on purpose: their UVs wrap once around the
 * side, so artwork applied in the material panel lands the way a label does.
 */
const packaging: ObjectPreset[] = [
  {
    id: "can",
    name: "Can",
    collection: "Packaging",
    params: [P.detail(96, 12, 200), P.height(2.6, 5), { key: "amount", label: "Rim", min: 0, max: 0.3, step: 0.005, default: 0.09 }],
    build: (p) => {
      const h = p.height / 2;
      const r = p.amount;
      return solo(
        "Can",
        lathe(
          [
            [0.001, -h - r],
            [0.82, -h - r],
            [0.9, -h],
            [1, -h + r],
            [1, h - r],
            [0.9, h],
            [0.82, h + r],
            [0.001, h + r],
          ],
          Math.round(p.detail),
          false,
        ),
      );
    },
  },
  {
    id: "bottle",
    name: "Bottle",
    collection: "Packaging",
    params: [
      P.detail(96, 12, 200),
      P.height(3.4, 6),
      { key: "amount", label: "Neck", min: 0.15, max: 0.6, step: 0.01, default: 0.32 },
    ],
    build: (p) => {
      const h = p.height / 2;
      const neck = p.amount;
      return solo(
        "Bottle",
        lathe(
          [
            [0.001, -h],
            [0.95, -h],
            [1, -h + 0.12],
            [1, h * 0.18],
            [0.92, h * 0.42],
            [neck * 1.15, h * 0.66],
            [neck, h * 0.78],
            [neck, h],
            [neck * 1.18, h],
            [0.001, h + 0.02],
          ],
          Math.round(p.detail),
          false,
        ),
      );
    },
  },
  {
    id: "jar",
    name: "Jar",
    collection: "Packaging",
    params: [P.detail(96, 12, 200), P.height(2.2, 5), { key: "amount", label: "Lid", min: 0.1, max: 0.6, step: 0.01, default: 0.26 }],
    build: (p) => {
      const h = p.height / 2;
      const lidHeight = p.amount;
      const body = lathe(
        [
          [0.001, -h],
          [1, -h],
          [1, h - lidHeight],
          [0.86, h - lidHeight],
          [0.86, h - lidHeight * 0.4],
          [0.001, h - lidHeight * 0.4],
        ],
        Math.round(p.detail),
        false,
      );
      const lid = lathe(
        [
          [0.001, h - lidHeight],
          [0.94, h - lidHeight],
          [0.94, h],
          [0.001, h],
        ],
        Math.round(p.detail),
        false,
      );
      const parts: GeneratedPart[] = [
        { id: "body", name: "Body", geometry: body },
        { id: "lid", name: "Lid", geometry: lid },
      ];
      normalizeGroup(parts.map((x) => x.geometry));
      return parts;
    },
  },
  {
    id: "tube",
    name: "Tube",
    collection: "Packaging",
    params: [P.detail(96, 12, 200), P.height(3, 6), { key: "amount", label: "Cap", min: 0.1, max: 0.6, step: 0.01, default: 0.28 }],
    build: (p) => {
      const h = p.height / 2;
      const cap = p.amount;
      const body = lathe(
        [
          [0.001, -h],
          [1, -h + 0.35],
          [1, h - cap * 1.6],
          [0.42, h - cap],
          [0.001, h - cap],
        ],
        Math.round(p.detail),
        false,
      );
      const capGeo = lathe(
        [
          [0.001, h - cap],
          [0.46, h - cap],
          [0.46, h],
          [0.001, h],
        ],
        Math.round(p.detail),
        false,
      );
      const parts: GeneratedPart[] = [
        { id: "body", name: "Body", geometry: body },
        { id: "cap", name: "Cap", geometry: capGeo },
      ];
      normalizeGroup(parts.map((x) => x.geometry));
      return parts;
    },
  },
  {
    id: "carton",
    name: "Carton",
    collection: "Packaging",
    params: [
      { key: "width", label: "Width", min: 0.3, max: 2, step: 0.01, default: 1 },
      P.height(2.6, 5),
      { key: "tube", label: "Depth", min: 0.2, max: 2, step: 0.01, default: 0.7 },
      P.round(0.04),
    ],
    build: (p) => solo("Carton", roundBox(p.width * 2, p.height, p.tube * 2, p.round, 8)),
  },
  {
    id: "pouch",
    name: "Pouch",
    collection: "Packaging",
    params: [P.detail(72, 16, 160), P.inflate(0.55), { key: "amount", label: "Flatten", min: 0, max: 0.8, step: 0.01, default: 0.55 }],
    build: (p) => {
      const g = superquadric(p.inflate, p.inflate, Math.round(p.detail));
      g.scale(1, 1.35, 1 - p.amount);
      taperY(g, -0.25);
      return solo("Pouch", g);
    },
  },
  {
    id: "mug",
    name: "Mug",
    collection: "Packaging",
    params: [P.detail(72, 12, 160), P.height(1.9, 4), P.tube(0.14)],
    build: (p) => {
      const h = p.height / 2;
      const body = lathe(
        [
          [0.001, -h],
          [1, -h],
          [1, h],
          [0.9, h],
          [0.9, -h + 0.16],
          [0.001, -h + 0.16],
        ],
        Math.round(p.detail),
        false,
      );
      const handle = new THREE.TorusGeometry(0.42, p.tube, 16, Math.round(p.detail), Math.PI * 1.25);
      transformed(handle, { position: [1.05, 0, 0], rotation: [0, 0, -Math.PI / 2.4] });
      const parts: GeneratedPart[] = [
        { id: "body", name: "Body", geometry: body },
        { id: "handle", name: "Handle", geometry: handle },
      ];
      normalizeGroup(parts.map((x) => x.geometry));
      return parts;
    },
  },
  {
    id: "card",
    name: "Card",
    collection: "Packaging",
    params: [
      { key: "width", label: "Width", min: 0.4, max: 3, step: 0.01, default: 1.6 },
      { key: "height", label: "Height", min: 0.3, max: 3, step: 0.01, default: 1 },
      { key: "tube", label: "Thickness", min: 0.01, max: 0.3, step: 0.005, default: 0.04 },
      P.round(0.06),
    ],
    build: (p) => {
      const g = roundBox(p.width * 2, p.height * 2, p.tube * 2, p.round, 8);
      return solo("Card", g);
    },
  },
];

export const OBJECT_PRESETS: ObjectPreset[] = [
  ...simple,
  ...packaging,
  ...loops,
  ...inflated,
  ...organics,
  ...gems,
  ...forms,
];

export const OBJECT_COLLECTIONS = Array.from(new Set(OBJECT_PRESETS.map((o) => o.collection)));

export function objectPresetById(id: string): ObjectPreset | undefined {
  return OBJECT_PRESETS.find((o) => o.id === id);
}

export function defaultParams(preset: ObjectPreset): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of preset.params) out[p.key] = p.default;
  return out;
}
