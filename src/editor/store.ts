import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  LightType,
  KeyTracks,
  Ease,
  CoverObject,
  CoverSource,
  EffectInstance,
  LabelObject,
  SceneLight,
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
import { DEFAULT_KEY_LIGHT, createLight } from "./presets/lights";
import { useRuntime } from "./runtime";
import { defaultParams, objectPresetById } from "./presets/objects";
import { DEFAULT_MOTION } from "./presets/motion";
import { sceneClock } from "./lib/clock";
import {
  ALL_TRANSFORM_CHANNELS,
  CAMERA_CHANNELS,
  cameraValue,
  hasKeys,
  keyAt,
  normalizeTracks,
  sampleChannel,
  transformValue,
  upsertKey,
  type TrackRef,
} from "./lib/keyframes";
import {
  MAX_EFFECTS,
  defaultEffectColors,
  defaultEffectParams,
  effectById,
} from "./presets/effects";

export type TransformMode = "translate" | "rotate" | "scale";
/**
 * Object is what is selected. Material or effects is its surface or its
 * treatment, one or the other depending on whether a solid or a piece of media
 * is selected. Scene is the room around it, look is the finish over the whole
 * picture, and export is the way out.
 */
export type PanelId = "object" | "material" | "effects" | "scene" | "look" | "export";

/**
 * How much the viewport is allowed to spend on a frame. Draft is for a laptop
 * on battery, Fine for judging an image just before export. It belongs to the
 * machine sitting in front of the editor, not to the document, but it is
 * persisted alongside it so a slow machine stays set.
 */
export type Quality = "draft" | "balanced" | "fine";
/** Which add-object popover the tool rail is showing. */
export type LibraryId = "shapes" | "objects" | "media" | "lights" | null;

const HISTORY_LIMIT = 60;
const COALESCE_MS = 400;
// Bump whenever an object or project field is added, so normalizeProject runs on
// projects already saved in the browser.
const PERSIST_VERSION = 15;

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
    keys: {},
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
    keys: {},
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
    keys: {},
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
    keys: {},
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
    depth: "front",
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
    keys: {},
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
    keys: {},
  };
}

export function createProject(): Project {
  return {
    id: newId(),
    name: "Untitled",
    objects: [createTextObject()],
    staging: { ...DEFAULT_STAGING },
    formatId: "landscape",
    customFormat: { width: 1600, height: 1200 },
    camera: { position: [...DEFAULT_CAMERA.position], target: [...DEFAULT_CAMERA.target], keys: {} },
    clip: { duration: 4 },
    cloudId: null,
  };
}

/**
 * The effect actions take an owner id. A cover's id reaches that cover's stack;
 * this sentinel reaches the look, the stack run over the whole frame. Both are
 * the same kind of list, so one set of actions and one panel serve both.
 */
export const LOOK_ID = "__look__";

/** The camera's id when it is the selection: it is an object to the panels and the timeline, not to the scene list. */
export const CAMERA_ID = "__camera__";

function withEffects(p: Project, ownerId: string, fn: (list: EffectInstance[]) => void) {
  if (ownerId === LOOK_ID) {
    fn(p.staging.look);
    return;
  }
  const owner = p.objects.find((o) => o.id === ownerId);
  if (owner?.kind === "cover") fn(owner.effects);
}

/**
 * Reaches the keys a timeline row points at, on an object or on an effect,
 * with a reader for the channel's plain value when a key has to be made.
 */
function withTrack(p: Project, track: TrackRef, fn: (tracks: KeyTracks, base: (channel: string) => number) => void) {
  if (track.kind === "object") {
    const o = p.objects.find((x) => x.id === track.id);
    if (o) fn(o.keys, (c) => transformValue(o.transform, c));
    return;
  }
  if (track.kind === "camera") {
    fn(p.camera.keys, (c) => cameraValue(p.camera, p.staging.focalLength, p.staging.focusDistance, c));
    return;
  }
  withEffects(p, track.ownerId, (list) => {
    const e = list.find((x) => x.id === track.instanceId);
    if (e) fn(e.keys, (c) => e.params[c] ?? 0);
  });
}

type LegacyStaging = Partial<Staging> & {
  lightColor?: string;
  lightIntensity?: number;
  lightAzimuth?: number;
  lightElevation?: number;
};

/**
 * Scenes saved before lights became a list had one directional light spelled
 * out as four fields. It becomes the key light, in the same place, so a saved
 * scene and every template open looking exactly as they did.
 */
function normalizeStaging(input: unknown): Staging {
  const raw = (input ?? {}) as LegacyStaging;
  const { lightColor, lightIntensity, lightAzimuth, lightElevation, ...rest } = raw;
  const lights: SceneLight[] = Array.isArray(rest.lights)
    ? rest.lights.map((l) => ({ ...DEFAULT_KEY_LIGHT, ...l }))
    : [
        createLight("sun", {
          id: "key",
          name: "Key",
          color: lightColor ?? DEFAULT_KEY_LIGHT.color,
          intensity: lightIntensity ?? DEFAULT_KEY_LIGHT.intensity,
          azimuth: lightAzimuth ?? DEFAULT_KEY_LIGHT.azimuth,
          elevation: lightElevation ?? DEFAULT_KEY_LIGHT.elevation,
          castShadow: rest.shadows ?? true,
        }),
      ];
  return {
    ...DEFAULT_STAGING,
    ...rest,
    lights,
    look: Array.isArray(rest.look) ? rest.look : [],
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
        keys: normalizeTracks(o.keys),
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
      if (base.kind === "label") return { ...base, depth: (base as LabelObject).depth ?? "front" };
      if (base.kind !== "cover") return base;
      const cover = base as CoverObject;
      return {
        ...cover,
        effects: Array.isArray(cover.effects) ? cover.effects.map(withKeys) : [],
        size: cover.size ?? 4,
        background: cover.background ?? false,
        stretch: cover.stretch ?? 1,
      };
    }) as SceneObject[],
    staging: withLookKeys(normalizeStaging(raw.staging)),
    formatId: raw.formatId ?? "square",
    customFormat: raw.customFormat ?? { width: 1600, height: 1200 },
    camera: {
      position: raw.camera?.position ?? [...DEFAULT_CAMERA.position],
      target: raw.camera?.target ?? [...DEFAULT_CAMERA.target],
      keys: normalizeTracks(raw.camera?.keys),
    },
    clip: { duration: Number(raw.clip?.duration) > 0 ? Number(raw.clip?.duration) : 4 },
    cloudId: typeof raw.cloudId === "string" ? raw.cloudId : null,
  };
}

/** An effect saved before keyframes existed has none; one saved with the first form is converted. */
function withKeys(e: EffectInstance): EffectInstance {
  return { ...e, keys: normalizeTracks(e.keys) };
}

function withLookKeys(staging: Staging): Staging {
  return { ...staging, look: staging.look.map(withKeys) };
}

/** The material a given part renders with, falling back to the object's base material. */
export function effectiveMaterial(obj: SceneObject, partId: string | null): PartMaterial {
  if (partId && obj.parts[partId]) return obj.parts[partId];
  return { material: obj.material, materialPresetId: obj.materialPresetId };
}

export type ViewMode = "camera" | "free" | "split";

type EditorState = {
  project: Project;
  selectedId: string | null;
  selectedPartId: string | null;
  transformMode: TransformMode;
  activePanel: PanelId;
  quality: Quality;
  library: LibraryId;
  /** Shows the platform margins guide over the canvas. */
  safeAreas: boolean;
  /**
   * How the viewport looks at the set. `camera` looks through the shot camera,
   * framed to the format. `free` orbits anywhere, with the camera drawn as an
   * object in the set. `split` shows both side by side.
   */
  viewMode: ViewMode;
  /** A reference grid on the floor, never exported. */
  showGrid: boolean;
  /** The light whose marker is selected in the viewport, if any. */
  selectedLightId: string | null;
  past: Project[];
  future: Project[];

  select: (id: string | null, partId?: string | null) => void;
  selectPart: (partId: string | null) => void;
  setTransformMode: (m: TransformMode) => void;
  setActivePanel: (p: PanelId) => void;
  setQuality: (q: Quality) => void;
  setLibrary: (l: LibraryId) => void;
  setSafeAreas: (v: boolean) => void;
  setViewMode: (m: ViewMode) => void;
  setShowGrid: (v: boolean) => void;
  selectLight: (id: string | null) => void;
  setLight: (id: string, patch: Partial<SceneLight>, coalesce?: boolean) => void;
  /** Adds a light the way an object is added: it appears, drawn in the set, and is selected. */
  addLight: (type: LightType) => string;
  removeLight: (id: string) => void;

  addText: (partial?: Partial<TextObject>) => string;
  addShape: (svg: string, name: string) => string;
  addModel: (source: ModelSource, name: string) => string;
  addCover: (source: CoverSource | null, name: string) => string;
  addLabel: (partial?: Partial<LabelObject>) => string;
  updateObject: (id: string, patch: Partial<SceneObject>, coalesce?: boolean) => void;
  setModelParam: (id: string, key: string, value: number, coalesce?: boolean) => void;
  setTransform: (id: string, transform: Transform) => void;
  setClipDuration: (seconds: number) => void;
  /** Shows the timeline under the viewport. */
  timelineOpen: boolean;
  setTimelineOpen: (open: boolean) => void;
  /** Which floating cards are folded to a stub. */
  folded: { rail: boolean; layers: boolean; panel: boolean };
  toggleFolded: (card: "rail" | "layers" | "panel") => void;
  /** Folds every card, or unfolds them all: the way to see the frame alone. */
  toggleAllFolded: () => void;
  /**
   * Keys the channels at that moment, at their current values; if every one
   * of them already has a key there, removes those keys instead.
   */
  toggleKeys: (track: TrackRef, t: number) => void;
  /** Moves every key sitting at `from` on the track to `to`. Coalesced, for dragging. */
  moveKeys: (track: TrackRef, from: number, to: number) => void;
  removeKeys: (track: TrackRef, t: number) => void;
  setTrackEase: (track: TrackRef, ease: Ease) => void;
  /** Copies the track's first key to the end of the clip, so the loop closes. */
  closeLoop: (track: TrackRef) => void;
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
  /** Remembers the cloud row, outside the history: it is not an edit. */
  setCloudId: (id: string | null) => void;
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
        quality: "balanced",
        library: null,
        safeAreas: false,
        viewMode: "camera",
        showGrid: false,
        selectedLightId: null,
        past: [],
        future: [],

        select: (id, partId = null) =>
          set({ selectedId: id, selectedPartId: id ? partId : null, selectedLightId: null }),
        selectPart: (selectedPartId) => set({ selectedPartId }),
        setTransformMode: (transformMode) => set({ transformMode }),
        setActivePanel: (activePanel) => set({ activePanel }),
        setQuality: (quality) => set({ quality }),
        setLibrary: (library) => set({ library }),
        setSafeAreas: (safeAreas) => set({ safeAreas }),
        setViewMode: (viewMode) => set({ viewMode }),
        setShowGrid: (showGrid) => set({ showGrid }),
        // A light and an object are never selected together: one gizmo at a time.
        selectLight: (id) =>
          set(id ? { selectedLightId: id, selectedId: null, selectedPartId: null, activePanel: "scene" } : { selectedLightId: null }),
        addLight: (type) => {
          const light = createLight(type);
          get().setStaging({ lights: [...get().project.staging.lights, light] }, false);
          set({ selectedLightId: light.id, selectedId: null, selectedPartId: null, activePanel: "scene", library: null });
          return light.id;
        },
        removeLight: (id) => {
          get().setStaging({ lights: get().project.staging.lights.filter((l) => l.id !== id) }, false);
          if (get().selectedLightId === id) set({ selectedLightId: null });
        },
        setLight: (id, patch, coalesce = true) => {
          const lights = get().project.staging.lights.map((l) => (l.id === id ? { ...l, ...patch } : l));
          get().setStaging({ lights }, coalesce);
        },

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
          mutate((p) =>
            patchObject(p, id, (o) => {
              o.transform = transform;
              // A keyed channel is wherever its keys say, so moving the object
              // means writing that channel's key at this moment of the clip.
              for (const channel of ALL_TRANSFORM_CHANNELS) {
                const keys = o.keys[channel];
                if (keys?.length) {
                  o.keys[channel] = upsertKey(keys, { t: sceneClock.clipTime, v: transformValue(transform, channel), ease: keys[0].ease }, newId);
                }
              }
            }),
          ),
        setClipDuration: (seconds) =>
          mutate((p) => {
            p.clip = { duration: Math.min(60, Math.max(0.5, seconds)) };
          }),
        timelineOpen: false,
        folded: { rail: false, layers: false, panel: false },
        toggleFolded: (card) => set((s) => ({ folded: { ...s.folded, [card]: !s.folded[card] } })),
        toggleAllFolded: () =>
          set((s) => {
            const any = s.folded.rail || s.folded.layers || s.folded.panel || s.timelineOpen;
            return any
              ? { folded: { rail: false, layers: false, panel: false } }
              : { folded: { rail: true, layers: true, panel: true } };
          }),
        setTimelineOpen: (timelineOpen) => set({ timelineOpen }),
        toggleKeys: (track, t) => {
          mutate((p) =>
            withTrack(p, track, (tracks, base) => {
              const all = track.channels.every((c) => keyAt(tracks[c], t));
              for (const c of track.channels) {
                if (all) {
                  const k = keyAt(tracks[c], t);
                  tracks[c] = (tracks[c] ?? []).filter((x) => x !== k);
                  if (tracks[c].length === 0) delete tracks[c];
                } else {
                  const keys = tracks[c];
                  const v = sampleChannel(keys, t, base(c), c.startsWith("rotation"));
                  tracks[c] = upsertKey(keys, { t, v, ease: keys?.[0]?.ease ?? "smooth" }, newId);
                }
              }
            }),
          );
          // The first key opens the timeline, where the rest of the work happens.
          set({ timelineOpen: true });
        },
        moveKeys: (track, from, to) =>
          mutate(
            (p) =>
              withTrack(p, track, (tracks) => {
                const at = Math.min(p.clip.duration, Math.max(0, to));
                for (const c of track.channels) {
                  const k = keyAt(tracks[c], from);
                  if (!k) continue;
                  tracks[c] = upsertKey(
                    (tracks[c] ?? []).filter((x) => x !== k),
                    { t: at, v: k.v, ease: k.ease },
                    () => k.id,
                  );
                }
              }),
            true,
          ),
        removeKeys: (track, t) =>
          mutate((p) =>
            withTrack(p, track, (tracks) => {
              for (const c of track.channels) {
                const k = keyAt(tracks[c], t);
                if (!k) continue;
                tracks[c] = (tracks[c] ?? []).filter((x) => x !== k);
                if (tracks[c].length === 0) delete tracks[c];
              }
            }),
          ),
        setTrackEase: (track, ease) =>
          mutate((p) =>
            withTrack(p, track, (tracks) => {
              for (const c of track.channels) if (tracks[c]) tracks[c] = tracks[c].map((k) => ({ ...k, ease }));
            }),
          ),
        closeLoop: (track) =>
          mutate((p) =>
            withTrack(p, track, (tracks) => {
              for (const c of track.channels) {
                const first = tracks[c]?.[0];
                if (first) tracks[c] = upsertKey(tracks[c], { t: p.clip.duration, v: first.v, ease: first.ease }, newId);
              }
            }),
          ),
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
            withEffects(p, id, (list) => {
              if (list.length < MAX_EFFECTS) list.push(createEffectInstance(effectId));
            }),
          ),
        removeEffect: (id, instanceId) =>
          mutate((p) =>
            withEffects(p, id, (list) => {
              const i = list.findIndex((e) => e.id === instanceId);
              if (i >= 0) list.splice(i, 1);
            }),
          ),
        moveEffect: (id, instanceId, direction) =>
          mutate((p) =>
            withEffects(p, id, (list) => {
              const i = list.findIndex((e) => e.id === instanceId);
              const j = i + direction;
              if (i < 0 || j < 0 || j >= list.length) return;
              [list[i], list[j]] = [list[j], list[i]];
            }),
          ),
        toggleEffect: (id, instanceId) =>
          mutate((p) =>
            withEffects(p, id, (list) => {
              const e = list.find((x) => x.id === instanceId);
              if (e) e.enabled = !e.enabled;
            }),
          ),
        setEffectParam: (id, instanceId, key, value, coalesce = true) =>
          mutate(
            (p) =>
              withEffects(p, id, (list) => {
                const e = list.find((x) => x.id === instanceId);
                if (!e) return;
                e.params = { ...e.params, [key]: value };
                // A keyed parameter reads its keys, so its slider writes the key at this moment.
                const keys = e.keys[key];
                if (keys?.length) {
                  e.keys[key] = upsertKey(keys, { t: sceneClock.clipTime, v: value, ease: keys[0].ease }, newId);
                }
              }),
            coalesce,
          ),
        setEffectColor: (id, instanceId, key, value, coalesce = true) =>
          mutate(
            (p) =>
              withEffects(p, id, (list) => {
                const e = list.find((x) => x.id === instanceId);
                if (e) e.colors = { ...e.colors, [key]: value };
              }),
            coalesce,
          ),
        resetEffect: (id, instanceId) =>
          mutate((p) =>
            withEffects(p, id, (list) => {
              const e = list.find((x) => x.id === instanceId);
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
          mutate((p) => {
            Object.assign(p.staging, patch);
            // A keyed lens or focus writes its key at this moment of the clip.
            const t = sceneClock.clipTime;
            const focal = p.camera.keys.focal;
            if (patch.focalLength !== undefined && focal?.length) {
              p.camera.keys.focal = upsertKey(focal, { t, v: patch.focalLength, ease: focal[0].ease }, newId);
            }
            const focus = p.camera.keys.focus;
            if (patch.focusDistance !== undefined && focus?.length) {
              p.camera.keys.focus = upsertKey(focus, { t, v: patch.focusDistance, ease: focus[0].ease }, newId);
            }
          }, coalesce),
        setFormat: (formatId, custom) =>
          mutate((p) => {
            p.formatId = formatId;
            if (custom) p.customFormat = custom;
          }),
        // Outside the history on purpose: an orbit would flood it. With keys on
        // the camera, moving it writes the keyed channels at this moment.
        setCamera: (position, target) =>
          set((s) => {
            let keys = s.project.camera.keys;
            if (hasKeys(keys)) {
              keys = { ...keys };
              const t = sceneClock.clipTime;
              const next = { position, target };
              for (const channel of [...CAMERA_CHANNELS.position, ...CAMERA_CHANNELS.target]) {
                const track = keys[channel];
                if (track?.length) keys[channel] = upsertKey(track, { t, v: cameraValue(next, 0, 0, channel), ease: track[0].ease }, newId);
              }
            }
            return { project: { ...s.project, camera: { position, target, keys } } };
          }),
        renameProject: (name) => set((s) => ({ project: { ...s.project, name } })),
        setCloudId: (cloudId) => set((s) => ({ project: { ...s.project, cloudId } })),
        newProject: () => {
          set({ project: createProject(), selectedId: null, selectedPartId: null, past: [], future: [] });
          useRuntime.getState().requestCameraReset();
        },
        loadProject: (project) => {
          set({
            project: normalizeProject(project),
            selectedId: null,
            selectedPartId: null,
            past: [],
            future: [],
          });
          // The live camera follows the document it just received. Without this
          // a template opened over another scene kept that scene's framing.
          useRuntime.getState().requestCameraReset();
        },

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
      partialize: (s) => ({ project: s.project, quality: s.quality }),
      migrate: (persisted) => {
        const state = persisted as { project?: unknown; quality?: unknown } | undefined;
        const quality: Quality = state?.quality === "draft" || state?.quality === "fine" ? state.quality : "balanced";
        return { project: normalizeProject(state?.project), quality } as { project: Project; quality: Quality };
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
