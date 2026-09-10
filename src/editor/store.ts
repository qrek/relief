import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CoverObject,
  CoverSource,
  EffectInstance,
  LabelObject,
  MaterialParams,
  Motion,
  ModelObject,
  ModelSource,
  PartMaterial,
  Project,
  SceneObject,
  ShapeObject,
  Staging,
  TextObject,
  Transform,
} from "./types";
import { DEFAULT_ARTWORK, DEFAULT_MATERIAL, materialFromPreset } from "./presets/materials";
import { DEFAULT_FONT_ID } from "./presets/fonts";
import { CANVAS_FORMATS, DEFAULT_CAMERA, DEFAULT_STAGING } from "./presets/scene";
import { defaultParams, objectPresetById } from "./presets/objects";
import { DEFAULT_MOTION } from "./presets/motion";
import {
  MAX_EFFECTS,
  defaultEffectColors,
  defaultEffectParams,
  effectById,
} from "./presets/effects";

export type TransformMode = "translate" | "rotate" | "scale";
export type PanelId = "object" | "material" | "effects" | "staging" | "export";
/** Which add-object popover the tool rail is showing. */
export type LibraryId = "shapes" | "objects" | "media" | null;

const HISTORY_LIMIT = 60;
const COALESCE_MS = 400;
// Bump whenever an object or project field is added, so normalizeProject runs on
// projects already saved in the browser.
const PERSIST_VERSION = 8;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);

const identity = (): Transform => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

export function createTextObject(partial: Partial<TextObject> = {}): TextObject {
  return {
    id: newId(),
    kind: "text",
    name: partial.text ?? "Studio",
    visible: true,
    locked: false,
    transform: identity(),
    material: materialFromPreset("chrome"),
    materialPresetId: "chrome",
    parts: {},
    motion: { ...DEFAULT_MOTION },
    text: "Studio",
    fontId: DEFAULT_FONT_ID,
    size: 0.8,
    depth: 0.3,
    letterSpacing: 0,
    lineHeight: 1,
    textCase: "none",
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 8,
    ...partial,
  };
}

export function createShapeObject(svg: string, name: string, partial: Partial<ShapeObject> = {}): ShapeObject {
  return {
    id: newId(),
    kind: "shape",
    name,
    visible: true,
    locked: false,
    transform: identity(),
    material: materialFromPreset("glossy-red"),
    materialPresetId: "glossy-red",
    parts: {},
    motion: { ...DEFAULT_MOTION },
    svg,
    size: 2,
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 4,
    curveSegments: 12,
    ...partial,
  };
}

export function createModelObject(source: ModelSource, name: string, partial: Partial<ModelObject> = {}): ModelObject {
  return {
    id: newId(),
    kind: "model",
    name,
    visible: true,
    locked: false,
    transform: identity(),
    material: materialFromPreset("soft-clay"),
    materialPresetId: "soft-clay",
    parts: {},
    motion: { ...DEFAULT_MOTION },
    source,
    size: 2.2,
    useSourceMaterials: source.type === "asset",
    ...partial,
  };
}

export function createLabelObject(partial: Partial<LabelObject> = {}): LabelObject {
  return {
    id: newId(),
    kind: "label",
    name: partial.text ?? "Label",
    visible: true,
    locked: false,
    transform: identity(),
    material: materialFromPreset("matte-white"),
    materialPresetId: "matte-white",
    parts: {},
    motion: { ...DEFAULT_MOTION },
    text: "Headline",
    fontId: DEFAULT_FONT_ID,
    size: 0.09,
    letterSpacing: 0,
    lineHeight: 1.1,
    align: "center",
    textCase: "none",
    color: "#ffffff",
    opacity: 1,
    anchorX: 0,
    anchorY: 0,
    tilt: 0,
    ...partial,
  };
}

export function createCoverObject(source: CoverSource | null, name: string, partial: Partial<CoverObject> = {}): CoverObject {
  return {
    id: newId(),
    kind: "cover",
    name,
    visible: true,
    locked: false,
    transform: identity(),
    material: materialFromPreset("matte-white"),
    materialPresetId: "matte-white",
    parts: {},
    motion: { ...DEFAULT_MOTION },
    source,
    effects: [],
    size: 4,
    background: false,
    stretch: 1,
    ...partial,
  };
}

export function createEffectInstance(effectId: string): EffectInstance {
  const def = effectById(effectId);
  if (!def) throw new Error(`Unknown effect "${effectId}"`);
  return {
    id: newId(),
    effectId,
    enabled: true,
    params: defaultEffectParams(def),
    colors: defaultEffectColors(def),
  };
}

export function createProject(): Project {
  return {
    id: newId(),
    name: "Untitled",
    objects: [createTextObject()],
    staging: { ...DEFAULT_STAGING },
    formatId: "square",
    customFormat: { width: 1600, height: 1200 },
    camera: { position: [...DEFAULT_CAMERA.position], target: [...DEFAULT_CAMERA.target] },
  };
}

/** Fills in fields added after a project was saved, so older files keep opening. */
export function normalizeProject(input: unknown): Project {
  const raw = (input ?? {}) as Partial<Project>;
  const objects = Array.isArray(raw.objects) ? raw.objects : [];
  return {
    id: raw.id ?? newId(),
    name: raw.name ?? "Untitled",
    objects: objects.map((o) => {
      const base = {
        ...o,
        locked: o.locked ?? false,
        motion: { ...DEFAULT_MOTION, ...(o.motion ?? {}) },
        material: {
          ...DEFAULT_MATERIAL,
          ...(o.material ?? {}),
          artwork: { ...DEFAULT_ARTWORK, ...(o.material?.artwork ?? {}) },
        },
        parts: Object.fromEntries(
          Object.entries(o.parts ?? {}).map(([key, part]) => [
            key,
            {
              ...part,
              material: {
                ...DEFAULT_MATERIAL,
                ...part.material,
                artwork: { ...DEFAULT_ARTWORK, ...(part.material?.artwork ?? {}) },
              },
            },
          ]),
        ),
        visible: o.visible ?? true,
        transform: o.transform ?? identity(),
      };
      if (base.kind !== "cover") return base;
      const cover = base as CoverObject;
      return {
        ...cover,
        effects: Array.isArray(cover.effects) ? cover.effects : [],
        size: cover.size ?? 4,
        background: cover.background ?? false,
        stretch: cover.stretch ?? 1,
      };
    }) as SceneObject[],
    staging: { ...DEFAULT_STAGING, ...(raw.staging ?? {}) },
    formatId: raw.formatId ?? "square",
    customFormat: raw.customFormat ?? { width: 1600, height: 1200 },
    camera: raw.camera ?? {
      position: [...DEFAULT_CAMERA.position],
      target: [...DEFAULT_CAMERA.target],
    },
  };
}

/** The material a given part renders with, falling back to the object's base material. */
export function effectiveMaterial(obj: SceneObject, partId: string | null): PartMaterial {
  if (partId && obj.parts[partId]) return obj.parts[partId];
  return { material: obj.material, materialPresetId: obj.materialPresetId };
}

type EditorState = {
  project: Project;
  selectedId: string | null;
  selectedPartId: string | null;
  transformMode: TransformMode;
  activePanel: PanelId;
  library: LibraryId;
  /** Shows the platform margins guide over the canvas. */
  safeAreas: boolean;
  past: Project[];
  future: Project[];

  select: (id: string | null, partId?: string | null) => void;
  selectPart: (partId: string | null) => void;
  setTransformMode: (m: TransformMode) => void;
  setActivePanel: (p: PanelId) => void;
  setLibrary: (l: LibraryId) => void;
  setSafeAreas: (v: boolean) => void;

  addText: (partial?: Partial<TextObject>) => string;
  addShape: (svg: string, name: string) => string;
  addModel: (source: ModelSource, name: string) => string;
  addCover: (source: CoverSource | null, name: string) => string;
  addLabel: (partial?: Partial<LabelObject>) => string;
  updateObject: (id: string, patch: Partial<SceneObject>, coalesce?: boolean) => void;
  setModelParam: (id: string, key: string, value: number, coalesce?: boolean) => void;
  setTransform: (id: string, transform: Transform) => void;
  setMotion: (id: string, patch: Partial<Motion>, coalesce?: boolean) => void;

  addEffect: (id: string, effectId: string) => void;
  removeEffect: (id: string, instanceId: string) => void;
  moveEffect: (id: string, instanceId: string, direction: -1 | 1) => void;
  toggleEffect: (id: string, instanceId: string) => void;
  setEffectParam: (id: string, instanceId: string, key: string, value: number, coalesce?: boolean) => void;
  setEffectColor: (id: string, instanceId: string, key: string, value: string, coalesce?: boolean) => void;
  resetEffect: (id: string, instanceId: string) => void;

  setMaterial: (id: string, patch: Partial<MaterialParams>, coalesce?: boolean) => void;
  applyMaterialPreset: (id: string, presetId: string) => void;
  setPartMaterial: (id: string, partId: string, patch: Partial<MaterialParams>, coalesce?: boolean) => void;
  applyPartPreset: (id: string, partId: string, presetId: string) => void;
  resetPart: (id: string, partId: string) => void;

  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  moveObject: (id: string, direction: -1 | 1) => void;
  toggleLock: (id: string) => void;

  setStaging: (patch: Partial<Staging>, coalesce?: boolean) => void;
  setFormat: (formatId: string, custom?: { width: number; height: number }) => void;
  setCamera: (position: Transform["position"], target: Transform["position"]) => void;
  renameProject: (name: string) => void;
  newProject: () => void;
  loadProject: (project: unknown) => void;

  undo: () => void;
  redo: () => void;
};

let lastCommit = 0;

export const useEditor = create<EditorState>()(
  persist(
    (set, get) => {
      const mutate = (fn: (p: Project) => void, coalesce = false) => {
        const prev = get().project;
        const next = structuredClone(prev);
        fn(next);
        const now = Date.now();
        let past = get().past;
        if (!(coalesce && now - lastCommit < COALESCE_MS)) {
          past = [...past.slice(-(HISTORY_LIMIT - 1)), prev];
        }
        lastCommit = now;
        set({ project: next, past, future: [] });
      };

      const patchObject = (p: Project, id: string, fn: (o: SceneObject) => void) => {
        const o = p.objects.find((x) => x.id === id);
        if (o) fn(o);
      };

      /** New objects inherit the look of the last object added, so a scene stays coherent. */
      const inheritMaterial = (obj: SceneObject) => {
        const last = get().project.objects.at(-1);
        if (!last) return;
        obj.material = { ...last.material };
        obj.materialPresetId = last.materialPresetId;
      };

      const push = (obj: SceneObject) => {
        mutate((p) => p.objects.push(obj));
        set({ selectedId: obj.id, selectedPartId: null, activePanel: "object", library: null });
        return obj.id;
      };

      return {
        project: createProject(),
        selectedId: null,
        selectedPartId: null,
        transformMode: "translate",
        activePanel: "object",
        library: null,
        safeAreas: false,
        past: [],
        future: [],

        select: (id, partId = null) => set({ selectedId: id, selectedPartId: id ? partId : null }),
        selectPart: (selectedPartId) => set({ selectedPartId }),
        setTransformMode: (transformMode) => set({ transformMode }),
        setActivePanel: (activePanel) => set({ activePanel }),
        setLibrary: (library) => set({ library }),
        setSafeAreas: (safeAreas) => set({ safeAreas }),

        addText: (partial) => {
          const obj = createTextObject(partial);
          inheritMaterial(obj);
          return push(obj);
        },
        addShape: (svg, name) => {
          const obj = createShapeObject(svg, name);
          inheritMaterial(obj);
          return push(obj);
        },
        addModel: (source, name) => {
          const obj = createModelObject(source, name);
          if (!obj.useSourceMaterials) inheritMaterial(obj);
          return push(obj);
        },
        addCover: (source, name) => push(createCoverObject(source, name)),
        addLabel: (partial) => push(createLabelObject(partial)),

        updateObject: (id, patch, coalesce = true) =>
          mutate((p) => patchObject(p, id, (o) => Object.assign(o, patch)), coalesce),
        setModelParam: (id, key, value, coalesce = true) =>
          mutate(
            (p) =>
              patchObject(p, id, (o) => {
                if (o.kind !== "model" || o.source.type !== "procedural") return;
                o.source.params = { ...o.source.params, [key]: value };
              }),
            coalesce,
          ),
        setTransform: (id, transform) =>
          mutate((p) => patchObject(p, id, (o) => (o.transform = transform))),
        setMotion: (id, patch, coalesce = true) =>
          mutate(
            (p) =>
              patchObject(p, id, (o) => {
                o.motion = { ...DEFAULT_MOTION, ...o.motion, ...patch };
              }),
            coalesce,
          ),

        addEffect: (id, effectId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              if (o.kind !== "cover" || o.effects.length >= MAX_EFFECTS) return;
              o.effects.push(createEffectInstance(effectId));
            }),
          ),
        removeEffect: (id, instanceId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              if (o.kind !== "cover") return;
              o.effects = o.effects.filter((e) => e.id !== instanceId);
            }),
          ),
        moveEffect: (id, instanceId, direction) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              if (o.kind !== "cover") return;
              const i = o.effects.findIndex((e) => e.id === instanceId);
              const j = i + direction;
              if (i < 0 || j < 0 || j >= o.effects.length) return;
              [o.effects[i], o.effects[j]] = [o.effects[j], o.effects[i]];
            }),
          ),
        toggleEffect: (id, instanceId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              if (o.kind !== "cover") return;
              const e = o.effects.find((x) => x.id === instanceId);
              if (e) e.enabled = !e.enabled;
            }),
          ),
        setEffectParam: (id, instanceId, key, value, coalesce = true) =>
          mutate(
            (p) =>
              patchObject(p, id, (o) => {
                if (o.kind !== "cover") return;
                const e = o.effects.find((x) => x.id === instanceId);
                if (e) e.params = { ...e.params, [key]: value };
              }),
            coalesce,
          ),
        setEffectColor: (id, instanceId, key, value, coalesce = true) =>
          mutate(
            (p) =>
              patchObject(p, id, (o) => {
                if (o.kind !== "cover") return;
                const e = o.effects.find((x) => x.id === instanceId);
                if (e) e.colors = { ...e.colors, [key]: value };
              }),
            coalesce,
          ),
        resetEffect: (id, instanceId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              if (o.kind !== "cover") return;
              const e = o.effects.find((x) => x.id === instanceId);
              const def = e && effectById(e.effectId);
              if (!e || !def) return;
              e.params = defaultEffectParams(def);
              e.colors = defaultEffectColors(def);
            }),
          ),

        setMaterial: (id, patch, coalesce = true) =>
          mutate(
            (p) =>
              patchObject(p, id, (o) => {
                o.material = { ...o.material, ...patch };
                o.materialPresetId = null;
              }),
            coalesce,
          ),
        applyMaterialPreset: (id, presetId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              o.material = materialFromPreset(presetId);
              o.materialPresetId = presetId;
              // "Apply to all layers" drops every per-part override.
              o.parts = {};
            }),
          ),
        setPartMaterial: (id, partId, patch, coalesce = true) =>
          mutate(
            (p) =>
              patchObject(p, id, (o) => {
                const base = o.parts[partId] ?? { material: o.material, materialPresetId: o.materialPresetId };
                o.parts[partId] = {
                  material: { ...base.material, ...patch },
                  materialPresetId: null,
                };
              }),
            coalesce,
          ),
        applyPartPreset: (id, partId, presetId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              o.parts[partId] = { material: materialFromPreset(presetId), materialPresetId: presetId };
            }),
          ),
        resetPart: (id, partId) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              delete o.parts[partId];
            }),
          ),

        removeObject: (id) => {
          mutate((p) => (p.objects = p.objects.filter((o) => o.id !== id)));
          if (get().selectedId === id) set({ selectedId: null, selectedPartId: null });
        },
        duplicateObject: (id) => {
          const src = get().project.objects.find((o) => o.id === id);
          if (!src) return;
          const copy = structuredClone(src);
          copy.id = newId();
          copy.name = `${src.name} copy`;
          copy.transform.position = [
            src.transform.position[0] + 0.5,
            src.transform.position[1],
            src.transform.position[2],
          ];
          mutate((p) => {
            const i = p.objects.findIndex((o) => o.id === id);
            p.objects.splice(i + 1, 0, copy);
          });
          set({ selectedId: copy.id, selectedPartId: null });
        },
        moveObject: (id, direction) =>
          mutate((p) => {
            const i = p.objects.findIndex((o) => o.id === id);
            const j = i + direction;
            if (i < 0 || j < 0 || j >= p.objects.length) return;
            [p.objects[i], p.objects[j]] = [p.objects[j], p.objects[i]];
          }),
        toggleLock: (id) =>
          mutate((p) =>
            patchObject(p, id, (o) => {
              o.locked = !o.locked;
            }),
          ),

        setStaging: (patch, coalesce = true) =>
          mutate((p) => Object.assign(p.staging, patch), coalesce),
        setFormat: (formatId, custom) =>
          mutate((p) => {
            p.formatId = formatId;
            if (custom) p.customFormat = custom;
          }),
        setCamera: (position, target) =>
          set((s) => ({ project: { ...s.project, camera: { position, target } } })),
        renameProject: (name) => set((s) => ({ project: { ...s.project, name } })),
        newProject: () =>
          set({ project: createProject(), selectedId: null, selectedPartId: null, past: [], future: [] }),
        loadProject: (project) =>
          set({
            project: normalizeProject(project),
            selectedId: null,
            selectedPartId: null,
            past: [],
            future: [],
          }),

        undo: () => {
          const { past, project, future, selectedId } = get();
          if (past.length === 0) return;
          const prev = past[past.length - 1];
          const keep = prev.objects.some((o) => o.id === selectedId);
          set({
            project: prev,
            past: past.slice(0, -1),
            future: [project, ...future].slice(0, HISTORY_LIMIT),
            selectedId: keep ? selectedId : null,
            selectedPartId: keep ? get().selectedPartId : null,
          });
        },
        redo: () => {
          const { past, project, future } = get();
          if (future.length === 0) return;
          const next = future[0];
          set({ project: next, past: [...past, project], future: future.slice(1) });
        },
      };
    },
    {
      name: "relief-project",
      version: PERSIST_VERSION,
      partialize: (s) => ({ project: s.project }),
      migrate: (persisted) => {
        const state = persisted as { project?: unknown } | undefined;
        return { project: normalizeProject(state?.project) } as { project: Project };
      },
    },
  ),
);

export const useSelectedObject = () =>
  useEditor((s) => s.project.objects.find((o) => o.id === s.selectedId) ?? null);

export function currentFormat(project: Project) {
  const f = CANVAS_FORMATS.find((x) => x.id === project.formatId) ?? CANVAS_FORMATS[0];
  return f.id === "custom" ? { ...f, ...project.customFormat } : f;
}

/** A short label for the object's geometry source, used in panel titles. */
export function objectKindLabel(obj: SceneObject): string {
  if (obj.kind === "text") return "Text";
  if (obj.kind === "shape") return "Shape";
  if (obj.kind === "cover") return obj.background ? "Background cover" : "Cover";
  if (obj.kind === "label") return "Flat type";
  if (obj.source.type === "asset") return "Imported model";
  return objectPresetById(obj.source.presetId)?.collection ?? "Object";
}

export { DEFAULT_MATERIAL, defaultParams, objectPresetById };
