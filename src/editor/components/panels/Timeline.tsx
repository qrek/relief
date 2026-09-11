"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { useEditor } from "../../store";
import { sceneClock } from "../../lib/clock";
import { CAMERA_CHANNELS, TRANSFORM_CHANNELS, hasKeys, type TrackRef } from "../../lib/keyframes";
import { effectById } from "../../presets/effects";
import type { Ease, EffectInstance, Key, KeyTracks, Project } from "../../types";
import { Button, IconButton } from "../ui";
import { useClockTick } from "../useClockTick";

const EASES: { value: Ease; label: string }[] = [
  { value: "smooth", label: "Smooth" },
  { value: "linear", label: "Linear" },
  { value: "in", label: "Ease in" },
  { value: "out", label: "Ease out" },
];

/** A line of the timeline: a name on the left, keys on the right. */
type Row = {
  id: string;
  label: string;
  /** A group line sums up the lines under it and only seeks; the lines under it move and delete. */
  group: boolean;
  track: TrackRef;
  /** Distinct key times on the row, to the hundredth of a second. */
  times: number[];
  ease: Ease;
};

const ROW_H = 24;

/** Distinct times across a set of channels, so one diamond stands for a whole vector. */
function timesOf(tracks: KeyTracks, channels: string[]): number[] {
  const set = new Set<number>();
  for (const c of channels) for (const k of tracks[c] ?? []) set.add(Math.round(k.t * 100) / 100);
  return [...set].sort((a, b) => a - b);
}

function easeOf(tracks: KeyTracks, channels: string[]): Ease {
  for (const c of channels) {
    const k = tracks[c]?.[0];
    if (k) return k.ease;
  }
  return "smooth";
}

function keyedChannels(tracks: KeyTracks): string[] {
  return Object.entries(tracks)
    .filter(([, keys]) => keys.length > 0)
    .map(([c]) => c);
}

function effectRows(ownerId: string, ownerLabel: string, instance: EffectInstance): Row[] {
  if (!hasKeys(instance.keys)) return [];
  const def = effectById(instance.effectId);
  const name = def?.name ?? instance.effectId;
  const channels = keyedChannels(instance.keys);
  const rows: Row[] = [
    {
      id: `fx:${instance.id}`,
      label: `${name} · ${ownerLabel}`,
      group: true,
      track: { kind: "effect", ownerId, instanceId: instance.id, channels },
      times: timesOf(instance.keys, channels),
      ease: easeOf(instance.keys, channels),
    },
  ];
  for (const channel of channels) {
    const param = def?.params.find((p) => p.key === channel);
    rows.push({
      id: `fx:${instance.id}:${channel}`,
      label: param?.label ?? channel,
      group: false,
      track: { kind: "effect", ownerId, instanceId: instance.id, channels: [channel] },
      times: timesOf(instance.keys, [channel]),
      ease: easeOf(instance.keys, [channel]),
    });
  }
  return rows;
}

const CAMERA_LABELS: Record<keyof typeof CAMERA_CHANNELS, string> = {
  position: "Position",
  target: "Looks at",
  focal: "Focal length",
  focus: "Focus",
};

/** Everything keyed in the project, the selection first. */
function buildRows(project: Project, selectedId: string | null): Row[] {
  const rows: Row[] = [];
  if (hasKeys(project.camera.keys)) {
    const keys = project.camera.keys;
    const channels = keyedChannels(keys);
    rows.push({
      id: "camera",
      label: "Camera",
      group: true,
      track: { kind: "camera", channels },
      times: timesOf(keys, channels),
      ease: easeOf(keys, channels),
    });
    for (const part of Object.keys(CAMERA_CHANNELS) as (keyof typeof CAMERA_CHANNELS)[]) {
      const own = CAMERA_CHANNELS[part].filter((c) => (keys[c]?.length ?? 0) > 0);
      if (own.length === 0) continue;
      rows.push({
        id: `camera:${part}`,
        label: CAMERA_LABELS[part],
        group: false,
        track: { kind: "camera", channels: own },
        times: timesOf(keys, own),
        ease: easeOf(keys, own),
      });
    }
  }
  const objects = [...project.objects].sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0));
  for (const o of objects) {
    if (hasKeys(o.keys)) {
      const channels = keyedChannels(o.keys);
      rows.push({
        id: `obj:${o.id}`,
        label: o.name,
        group: true,
        track: { kind: "object", id: o.id, channels },
        times: timesOf(o.keys, channels),
        ease: easeOf(o.keys, channels),
      });
      for (const vector of ["position", "rotation", "scale"] as const) {
        const own = TRANSFORM_CHANNELS[vector].filter((c) => (o.keys[c]?.length ?? 0) > 0);
        if (own.length === 0) continue;
        rows.push({
          id: `obj:${o.id}:${vector}`,
          label: vector[0].toUpperCase() + vector.slice(1),
          group: false,
          track: { kind: "object", id: o.id, channels: own },
          times: timesOf(o.keys, own),
          ease: easeOf(o.keys, own),
        });
      }
    }
    if (o.kind === "cover") for (const e of o.effects) rows.push(...effectRows(o.id, o.name, e));
  }
  for (const e of project.staging.look) rows.push(...effectRows("__look__", "Look", e));
  return rows;
}

/**
 * The timeline: every keyed value in the project as a row, its keys as
 * diamonds on a shared ruler, and the playhead over all of it. Keys are
 * dragged to move, clicked to go to, deleted with the keyboard. What is keyed
 * is decided next to each value, in the panels, with the diamond beside it.
 */
export function Timeline() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const setClipDuration = useEditor((s) => s.setClipDuration);
  const setTimelineOpen = useEditor((s) => s.setTimelineOpen);
  const moveKeys = useEditor((s) => s.moveKeys);
  const removeKeys = useEditor((s) => s.removeKeys);
  const closeLoop = useEditor((s) => s.closeLoop);
  const setTrackEase = useEditor((s) => s.setTrackEase);
  const duration = project.clip.duration;
  const { time, playing } = useClockTick(30);

  const rows = useMemo(() => buildRows(project, selectedId), [project, selectedId]);
  const [picked, setPicked] = useState<{ rowId: string; t: number } | null>(null);
  const pickedRow = picked ? rows.find((r) => r.id === picked.rowId) : undefined;
  const pickedKey = pickedRow && picked ? pickedRow.times.find((t) => Math.abs(t - picked.t) < 0.005) : undefined;
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ row: Row; t: number } | null>(null);

  const timeAt = (clientX: number) => {
    const el = area.current;
    if (!el) return 0;
    const b = el.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (clientX - b.left) / Math.max(1, b.width)));
    return Math.round(u * duration * 100) / 100;
  };

  const scrub = (e: React.PointerEvent) => {
    sceneClock.pause();
    sceneClock.seek(timeAt(e.clientX));
  };

  const ticks: number[] = [];
  const step = duration > 12 ? 2 : duration > 6 ? 1 : 0.5;
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(Math.round(t * 100) / 100);

  return (
    <div
      className="flex h-48 shrink-0 flex-col border-t border-white/5 bg-neutral-900 text-xs text-neutral-300 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        // The window's own shortcuts sit above this; they must not see a Delete meant for a key.
        if ((e.key === "Delete" || e.key === "Backspace") && pickedRow && pickedKey !== undefined) {
          e.preventDefault();
          e.stopPropagation();
          removeKeys(pickedRow.track, pickedKey);
          setPicked(null);
        }
        if (e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          sceneClock.toggle();
        }
      }}
    >
      <div className="flex h-9 items-center gap-2 border-b border-white/5 px-2">
        <IconButton icon={playing ? Pause : Play} size="md" title={playing ? "Pause (Space)" : "Play (Space)"} onClick={() => sceneClock.toggle()} />
        <span className="w-16 tabular-nums text-neutral-200">{time.toFixed(2)} s</span>
        <span className="text-neutral-500">Length</span>
        <input
          type="number"
          min={0.5}
          max={60}
          step={0.5}
          value={duration}
          onChange={(e) => setClipDuration(Number(e.target.value) || duration)}
          title="Length of the clip, in seconds. A video export is one pass of it."
          className="w-14 rounded bg-white/5 px-1.5 py-0.5 tabular-nums text-neutral-200 outline-none focus:bg-white/10"
        />
        <span className="text-neutral-500">s</span>
        <div className="flex-1" />
        {pickedRow && (
          <>
            <span className="truncate text-neutral-400">{pickedRow.label}</span>
            <select
              value={pickedRow.ease}
              onChange={(e) => setTrackEase(pickedRow.track, e.target.value as Ease)}
              title="How this row moves between its keys"
              className="rounded bg-white/5 px-1.5 py-0.5 text-neutral-200 outline-none"
            >
              {EASES.map((o) => (
                <option key={o.value} value={o.value} className="bg-neutral-900">
                  {o.label}
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => closeLoop(pickedRow.track)} title="Copy this row's first key to the end of the clip, so it loops without a jump">
              Close loop
            </Button>
            {pickedKey !== undefined && (
              <Button
                variant="ghost"
                onClick={() => {
                  removeKeys(pickedRow.track, pickedKey);
                  setPicked(null);
                }}
                title="Remove the selected key (Delete)"
              >
                Delete key
              </Button>
            )}
          </>
        )}
        <IconButton icon={X} size="md" title="Hide the timeline" onClick={() => setTimelineOpen(false)} />
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-3 text-[11px] leading-relaxed text-neutral-500">
          Nothing is keyed yet. Click the diamond beside any value, a position, a rotation, an effect slider, to key it at
          the current time. Move the playhead, change the value, and it is keyed again there.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-y-auto">
          <div className="w-40 shrink-0 border-r border-white/5">
            <div className="h-5 border-b border-white/5" />
            {rows.map((r) => (
              <div
                key={r.id}
                className={`flex items-center truncate px-2 ${r.group ? "font-medium text-neutral-200" : "pl-5 text-neutral-400"} ${
                  picked?.rowId === r.id ? "bg-white/5" : ""
                }`}
                style={{ height: ROW_H }}
              >
                {r.label}
              </div>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 select-none" ref={area}>
            <div
              className="relative h-5 cursor-pointer border-b border-white/5"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons & 1) scrub(e);
              }}
            >
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-white/10 pl-1 text-[9px] leading-5 text-neutral-500" style={{ left: `${(t / duration) * 100}%` }}>
                  {Number.isInteger(t) ? `${t}s` : ""}
                </span>
              ))}
            </div>
            {rows.map((r) => (
              <div key={r.id} className={`relative border-b border-white/[0.03] ${picked?.rowId === r.id ? "bg-white/5" : ""}`} style={{ height: ROW_H }}>
                {r.times.map((t) => {
                  const isPicked = picked?.rowId === r.id && Math.abs(picked.t - t) < 0.005;
                  return (
                    <button
                      key={t}
                      type="button"
                      title={`${t.toFixed(2)} s`}
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] ring-1"
                      style={{
                        left: `${(t / duration) * 100}%`,
                        background: isPicked ? "var(--accent)" : r.group ? "rgba(255,255,255,0.35)" : "var(--accent-edge)",
                        // Inline so the ring follows the pick; Tailwind's ring colour would need a class per state.
                        boxShadow: isPicked ? "0 0 0 1px var(--accent)" : "0 0 0 1px rgba(255,255,255,0.25)",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setPicked({ rowId: r.id, t });
                        sceneClock.pause();
                        sceneClock.seek(t);
                        if (r.group) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        drag.current = { row: r, t };
                      }}
                      onPointerMove={(e) => {
                        const d = drag.current;
                        if (!d || !(e.buttons & 1)) return;
                        const to = timeAt(e.clientX);
                        if (Math.abs(to - d.t) < 0.005) return;
                        moveKeys(d.row.track, d.t, to);
                        d.t = to;
                        setPicked({ rowId: d.row.id, t: to });
                        sceneClock.seek(to);
                      }}
                      onPointerUp={() => {
                        drag.current = null;
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-[var(--accent)]" style={{ left: `${(Math.min(duration, time) / duration) * 100}%` }}>
              <span className="absolute -left-[3px] top-0 h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-[var(--accent)]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Keys of a row as the store keeps them, for the callers that need ids. */
export type { Key };
