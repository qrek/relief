import type { Ease, ParamKey, Transform, TransformKey } from "../types";

/** Two keys closer than this in time are the same key. */
export const KEY_SNAP = 0.02;

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

type Keyed = { t: number; ease: Ease };

/**
 * Finds the pair of keys around a time and how far between them it falls.
 * Before the first key the first holds, after the last key the last holds:
 * a value never moves where nobody keyed it.
 */
function bracket<K extends Keyed>(keys: K[], t: number): { a: K; b: K; u: number } | null {
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

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Angles take the short way round, so a turn from 350 to 10 degrees does not swing back. */
function lerpAngle(a: number, b: number, u: number): number {
  let d = b - a;
  const turn = Math.PI * 2;
  d = ((((d + Math.PI) % turn) + turn) % turn) - Math.PI;
  return a + d * u;
}

export function sampleTransform(keys: TransformKey[], t: number, fallback: Transform): Transform {
  const hit = bracket(keys, t);
  if (!hit) return fallback;
  const { a, b, u } = hit;
  if (a === b || u === 0) return a.transform;
  const ta = a.transform;
  const tb = b.transform;
  return {
    position: [lerp(ta.position[0], tb.position[0], u), lerp(ta.position[1], tb.position[1], u), lerp(ta.position[2], tb.position[2], u)],
    rotation: [lerpAngle(ta.rotation[0], tb.rotation[0], u), lerpAngle(ta.rotation[1], tb.rotation[1], u), lerpAngle(ta.rotation[2], tb.rotation[2], u)],
    scale: [lerp(ta.scale[0], tb.scale[0], u), lerp(ta.scale[1], tb.scale[1], u), lerp(ta.scale[2], tb.scale[2], u)],
  };
}

export function sampleParams(keys: ParamKey[], t: number, fallback: Record<string, number>): Record<string, number> {
  const hit = bracket(keys, t);
  if (!hit) return fallback;
  const { a, b, u } = hit;
  if (a === b || u === 0) return { ...fallback, ...a.params };
  const out: Record<string, number> = { ...fallback };
  for (const key of new Set([...Object.keys(a.params), ...Object.keys(b.params)])) {
    const va = a.params[key] ?? b.params[key] ?? fallback[key] ?? 0;
    const vb = b.params[key] ?? a.params[key] ?? fallback[key] ?? 0;
    out[key] = lerp(va, vb, u);
  }
  return out;
}

/** The key at a time, if one sits close enough to count. */
export function keyAt<K extends { t: number }>(keys: K[], t: number): K | undefined {
  return keys.find((k) => Math.abs(k.t - t) < KEY_SNAP);
}

/** Replaces the key at that time or inserts one, keeping the list sorted. Returns a new list. */
export function upsertKey<K extends { id: string; t: number }>(keys: K[], key: Omit<K, "id">, makeId: () => string): K[] {
  const existing = keyAt(keys, key.t);
  const next = keys.filter((k) => k !== existing);
  next.push({ ...key, id: existing?.id ?? makeId() } as K);
  next.sort((a, b) => a.t - b.t);
  return next;
}
