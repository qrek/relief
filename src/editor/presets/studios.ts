import * as THREE from "three";

/**
 * Studio environments: not photographs of places but lighting rigs, the way
 * a product photographer sets them, built from panels of light in a dark or
 * bright room. What a material reflects is what makes it read: a chrome
 * needs a wide soft panel to bend, a glass needs a rim strip to find its
 * edge. These give both, and they are tiny, tunable and licence-free.
 */
export type StudioPanel = {
  form: "rect" | "circle" | "ring";
  position: [number, number, number];
  /** Width and height for a rect, radius for a circle or a ring (outer). */
  size: [number, number];
  /** Linear light level; 1 is a white wall, 8 a softbox. */
  intensity: number;
  color: string;
  /** Rotation around the axis to the origin, in degrees; a rect can be tilted. */
  roll?: number;
};

export type StudioDef = {
  id: string;
  name: string;
  blurb: string;
  /** The room's walls, seen in every reflection and as the background. */
  room: string;
  /** A brighter floor makes a subject sit on something. */
  floor?: string;
  panels: StudioPanel[];
};

export const STUDIO_PREFIX = "studio:";
export const isStudio = (id: string) => id.startsWith(STUDIO_PREFIX);

export const STUDIOS: StudioDef[] = [
  {
    id: "studio:softbox",
    name: "Softbox",
    blurb: "One big soft key from the upper left, a wide fill, a rim strip behind, on a mid-grey cyclorama. The all-purpose product setup.",
    room: "#4a4a4c",
    floor: "#5c5c5e",
    panels: [
      { form: "rect", position: [-5, 6, 5], size: [9, 7], intensity: 9, color: "#fff3e4" },
      { form: "rect", position: [7, 2, 4], size: [6, 6], intensity: 2.6, color: "#e4ecfa" },
      { form: "rect", position: [0, 3, -8], size: [12, 1], intensity: 7, color: "#ffffff" },
      { form: "rect", position: [0, 9, 0], size: [8, 4], intensity: 2, color: "#ffffff" },
    ],
  },
  {
    id: "studio:window",
    name: "Window",
    blurb: "A tall window of cool daylight on one side, a warm wall bouncing it back on the other. Editorial, quiet.",
    room: "#4d463f",
    floor: "#5e564d",
    panels: [
      { form: "rect", position: [-8, 3, 1], size: [7, 9], intensity: 6, color: "#dbe7ff" },
      { form: "rect", position: [8, 1.5, -1], size: [10, 6], intensity: 1.8, color: "#ffe2c4" },
      { form: "rect", position: [0, 9, -2], size: [6, 3], intensity: 1.2, color: "#ffffff" },
    ],
  },
  {
    id: "studio:rim",
    name: "Rim",
    blurb: "A dark room, two tall strips behind the subject and a faint sheet in front. Chrome, glass and black plastic find their edges.",
    room: "#141414",
    panels: [
      { form: "rect", position: [-5, 2, -5], size: [0.7, 9], intensity: 14, color: "#ffffff" },
      { form: "rect", position: [5, 2, -5], size: [0.7, 9], intensity: 14, color: "#eef2ff" },
      { form: "circle", position: [1, 7.5, 3], size: [1.2, 1.2], intensity: 8, color: "#ffffff" },
      { form: "rect", position: [0, 1, 9], size: [12, 8], intensity: 1.1, color: "#ffffff" },
    ],
  },
  {
    id: "studio:table",
    name: "Table",
    blurb: "A pale cyclorama with a ring of light above and soft panels on both sides. Clean, bright, e-commerce.",
    room: "#8c8c8c",
    floor: "#bdbdbd",
    panels: [
      { form: "ring", position: [0, 7.5, 3.5], size: [3.6, 2.4], intensity: 3.5, color: "#ffffff" },
      { form: "rect", position: [-7, 2.5, 1], size: [5, 5], intensity: 1.8, color: "#fff8f0" },
      { form: "rect", position: [7, 2.5, 1], size: [5, 5], intensity: 1.8, color: "#f0f6ff" },
    ],
  },
];

export function studioById(id: string): StudioDef | undefined {
  return STUDIOS.find((s) => s.id === id);
}

/** The rig as a three scene, to be baked into an environment map. */
export function buildStudioScene(def: StudioDef): THREE.Scene {
  const scene = new THREE.Scene();

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 24, 24),
    new THREE.MeshBasicMaterial({ color: def.room, side: THREE.BackSide }),
  );
  scene.add(room);

  if (def.floor) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: def.floor }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    scene.add(floor);
  }

  for (const panel of def.panels) {
    const geometry =
      panel.form === "rect"
        ? new THREE.PlaneGeometry(panel.size[0], panel.size[1])
        : panel.form === "circle"
          ? new THREE.CircleGeometry(panel.size[0], 48)
          : new THREE.RingGeometry(panel.size[1], panel.size[0], 64);
    const color = new THREE.Color(panel.color).multiplyScalar(panel.intensity);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.position.set(...panel.position);
    mesh.lookAt(0, 0, 0);
    if (panel.roll) mesh.rotateZ(THREE.MathUtils.degToRad(panel.roll));
    scene.add(mesh);
  }
  return scene;
}
