import { create } from "zustand";
import type * as THREE from "three";
import type { PartInfo } from "./types";

/** Non-persisted handles to live three.js objects, shared between the canvas and the UI. */
type RuntimeState = {
  gl: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  objects: Record<string, THREE.Object3D>;
  /** Meshes discovered inside each object, published by the mesh components. */
  parts: Record<string, PartInfo[]>;
  /** Per-object load or build failure, surfaced in the panels. */
  errors: Record<string, string>;
  setRenderer: (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
  register: (id: string, obj: THREE.Object3D) => void;
  unregister: (id: string) => void;
  setParts: (id: string, parts: PartInfo[]) => void;
  setError: (id: string, message: string | null) => void;
  resetCameraSignal: number;
  requestCameraReset: () => void;
  /** While armed, the next click in the viewport pulls focus to what it hits. */
  focusPicking: boolean;
  setFocusPicking: (picking: boolean) => void;
};

const sameParts = (a: PartInfo[] | undefined, b: PartInfo[]) =>
  !!a && a.length === b.length && a.every((p, i) => p.id === b[i].id && p.name === b[i].name);

export const useRuntime = create<RuntimeState>((set, get) => ({
  gl: null,
  scene: null,
  camera: null,
  objects: {},
  parts: {},
  errors: {},
  setRenderer: (gl, scene, camera) => set({ gl, scene, camera }),
  register: (id, obj) => set((s) => ({ objects: { ...s.objects, [id]: obj } })),
  unregister: (id) =>
    set((s) => {
      const objects = { ...s.objects };
      const parts = { ...s.parts };
      const errors = { ...s.errors };
      delete objects[id];
      delete parts[id];
      delete errors[id];
      return { objects, parts, errors };
    }),
  setParts: (id, parts) => {
    if (sameParts(get().parts[id], parts)) return;
    set((s) => ({ parts: { ...s.parts, [id]: parts } }));
  },
  setError: (id, message) =>
    set((s) => {
      const errors = { ...s.errors };
      if (message) errors[id] = message;
      else delete errors[id];
      return { errors };
    }),
  resetCameraSignal: 0,
  requestCameraReset: () => set((s) => ({ resetCameraSignal: s.resetCameraSignal + 1 })),
  focusPicking: false,
  setFocusPicking: (focusPicking) => set({ focusPicking }),
}));

export const usePartsOf = (id: string | null) =>
  useRuntime((s) => (id ? (s.parts[id] ?? EMPTY_PARTS) : EMPTY_PARTS));

const EMPTY_PARTS: PartInfo[] = [];
