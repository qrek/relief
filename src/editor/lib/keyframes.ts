import type { Ease, Key, KeyTracks, Transform } from "../types";

/** Two keys closer than this in time are the same key. */
export const KEY_SNAP = 0.02;

/** The nine channels a transform can be keyed on, by vector. */
export const TRANSFORM_CHANNELS: Record<"position" | "rotation" | "scale", string[]> = {
  position: ["position.x", "position.y", "position.z"],
  rotation: ["rotation.x", "rotation.y", "rotation.z"],
  scale: ["scale.x", "scale.y", "scale.z"],
};
export const ALL_TRANSFORM_CHANNELS = [
  ...TRANSFORM_CHANNELS.position,
  ...TRANSFORM_CHANNELS.rotation,
  ...TRANSFORM_CHANNELS.scale,
];

/**
 * A row of the timeline: one or more channels of one thing, moved and keyed
 * together. "Position" on an object is three channels; one effect slider is one.
 */
export type TrackRef =
  | { kind: "object"; id: string; channels: string[] }
  | { kind: "effect"; ownerId: string; instanceId: string; channels: string[] };

/** Eases run over 0..1 and return 0..1. */
export function easeValue(ease: Ease, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  switch (ease) {
    case "linear":
      return x;
    case "in":
      return x * x;
    case "out":
      return 1 - (1 - x) * (1 - x);
    default:
      return x * x * (3 - 2 * x);
  }
}

/**
 * Finds the pair of keys around a time and how far between them it falls.
 * Before the first key the first holds, after the last key the last holds:
 * a value never moves where nobody keyed it.
 */
function bracket(keys: Key[], t: number): { a: Key; b: Key; u: number } | null {
  if (keys.length === 0) return null;
  if (t <= keys[0].t) return { a: keys[0], b: keys[0], u: 0 };
  const last = keys[keys.length - 1];
  if (t >= last.t) return { a: last, b: last, u: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t < b.t) {
      const span = Math.max(1e-6, b.t - a.t);
      return { a, b, u: easeValue(a.ease, (t - a.t) / span) };
    }
  }
  return { a: last, b: last, u: 0 };
}

/** Angles take the short way round, so a turn from 350 to 10 degrees does not swing back. */
function lerpAngle(a: number, b: number, u: number): number {
  const turn = Math.PI * 2;
  const d = ((((b - a + Math.PI) % turn) + turn) % turn) - Math.PI;
  return a + d * u;
}

/** The value of one channel at a time, or the fallback when it has no keys. */
export function sampleChannel(keys: Key[] | undefined, t: number, fallback: number, angular = false): number {
  if (!keys || keys.length === 0) return fallback;
  const hit = bracket(keys, t)!;
  if (hit.a === hit.b || hit.u === 0) return hit.a.v;
  return angular ? lerpAngle(hit.a.v, hit.b.v, hit.u) : hit.a.v + (hit.b.v - hit.a.v) * hit.u;
}

export function hasKeys(tracks: KeyTracks | undefined): boolean {
  return !!tracks && Object.values(tracks).some((keys) => keys.length > 0);
}

/** Reads one transform channel, "rotation.y" and the like. */
export function transformValue(transform: Transform, channel: string): number {
  const [vector, axis] = channel.split(".") as [keyof Transform, "x" | "y" | "z"];
  return transform[vector][axis === "x" ? 0 : axis === "y" ? 1 : 2];
}

export function sampleTransform(tracks: KeyTracks, t: number, base: Transform): Transform {
  if (!hasKeys(tracks)) return base;
  const read = (vector: keyof Transform): [number, number, number] =>
    TRANSFORM_CHANNELS[vector].map((channel, i) =>
      sampleChannel(tracks[channel], t, base[vector][i], vector === "rotation"),
    ) as [number, number, number];
  return { position: read("position"), rotation: read("rotation"), scale: read("scale") };
}

export function sampleParams(tracks: KeyTracks, t: number, base: Record<string, number>): Record<string, number> {
  if (!hasKeys(tracks)) return base;
  const out = { ...base };
  for (const [channel, keys] of Object.entries(tracks)) {
    if (keys.length) out[channel] = sampleChannel(keys, t, base[channel] ?? 0);
  }
  return out;
}

/** The key at a time, if one sits close enough to count. */
export function keyAt(keys: Key[] | undefined, t: number): Key | undefined {
  return keys?.find((k) => Math.abs(k.t - t) < KEY_SNAP);
}

/** Replaces the key at that time or inserts one, keeping the list sorted. Returns a new list. */
export function upsertKey(keys: Key[] | undefined, key: Omit<Key, "id">, makeId: () => string): Key[] {
  const list = keys ?? [];
  const existing = keyAt(list, key.t);
  const next = list.filter((k) => k !== existing);
  next.push({ ...key, id: existing?.id ?? makeId() });
  next.sort((a, b) => a.t - b.t);
  return next;
}

/** How a control shows its channel: nothing, keyed elsewhere, or keyed right here. */
export type KeyState = "none" | "keyed" | "here";

export function keyStateOf(tracks: KeyTracks | undefined, channels: string[], t: number): KeyState {
  if (!tracks) return "none";
  if (channels.some((c) => keyAt(tracks[c], t))) return "here";
  if (channels.some((c) => (tracks[c]?.length ?? 0) > 0)) return "keyed";
  return "none";
}

/**
 * Reads keys off a saved project: the current per-channel form, or the first
 * form (one key holding a whole transform or a whole set of parameters),
 * spread over its channels.
 */
export function normalizeTracks(raw: unknown): KeyTracks {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: KeyTracks = {};
    let n = 0;
    const id = () => `k${Date.now().toString(36)}${(n++).toString(36)}`;
    for (const key of raw as { t: number; ease?: Ease; transform?: Transform; params?: Record<string, number> }[]) {
      const ease = key.ease ?? "smooth";
      if (key.transform) {
        for (const channel of ALL_TRANSFORM_CHANNELS) {
          out[channel] = upsertKey(out[channel], { t: key.t, v: transformValue(key.transform, channel), ease }, id);
        }
      }
      if (key.params) {
        for (const [channel, v] of Object.entries(key.params)) {
          out[channel] = upsertKey(out[channel], { t: key.t, v, ease }, id);
        }
      }
    }
    return out;
  }
  if (typeof raw !== "object") return {};
  const out: KeyTracks = {};
  for (const [channel, keys] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(keys) && keys.length) {
      out[channel] = [...(keys as Key[])].sort((a, b) => a.t - b.t);
    }
  }
  return out;
}
