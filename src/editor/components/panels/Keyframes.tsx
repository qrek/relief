"use client";

import { Diamond, X } from "lucide-react";
import { useEditor } from "../../store";
import { sceneClock } from "../../lib/clock";
import { keyAt } from "../../lib/keyframes";
import type { Ease } from "../../types";
import { Button, IconButton, Section, SelectField } from "../ui";
import { useClockTick } from "../useClockTick";

const EASES: { value: Ease; label: string }[] = [
  { value: "smooth", label: "Smooth" },
  { value: "linear", label: "Linear" },
  { value: "in", label: "Ease in" },
  { value: "out", label: "Ease out" },
];

type Key = { id: string; t: number; ease: Ease };

/**
 * The keys of one thing, an object or an effect, as a row of moments. One
 * button writes a key at the clip's current time; a key already there is
 * updated by simply moving the object or the slider. Clicking a key goes to
 * it. Kept to what a first animation needs: no curves, no per-channel keys.
 */
export function KeyframesSection({
  keys,
  onAdd,
  onRemove,
  onEase,
  onCloseLoop,
  compact = false,
  what,
}: {
  keys: Key[];
  onAdd: (t: number) => void;
  onRemove: (id: string) => void;
  onEase: (ease: Ease) => void;
  onCloseLoop: () => void;
  /** Inside a card rather than as its own section. */
  compact?: boolean;
  /** What the keys drive, for the hint. */
  what: string;
}) {
  const duration = useEditor((s) => s.project.clip.duration);
  const { time } = useClockTick();
  const here = keyAt(keys, time);
  const closed = keys.length > 0 && keyAt(keys, duration) !== undefined;

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant={keys.length ? "default" : "primary"} onClick={() => onAdd(sceneClock.clipTime)} title={`Write a key at ${time.toFixed(2)} s`} className="flex items-center gap-1">
          <Diamond size={11} strokeWidth={1.75} />
          {here ? `Key at ${time.toFixed(2)} s` : `Add key at ${time.toFixed(2)} s`}
        </Button>
        {keys.length > 0 && !closed && (
          <Button variant="ghost" onClick={onCloseLoop} title="Copy the first key to the end of the clip, so it loops without a jump">
            Close loop
          </Button>
        )}
      </div>
      {keys.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keys.map((k) => (
            <span
              key={k.id}
              className={`flex items-center gap-0.5 rounded-full pl-2 text-[10.5px] ring-1 ${
                k === here ? "bg-[var(--accent-soft)] text-neutral-100 ring-[var(--accent-edge)]" : "bg-white/5 text-neutral-300 ring-white/10"
              }`}
            >
              <button type="button" onClick={() => sceneClock.seek(k.t)} title="Go to this key" className="py-0.5 hover:text-white">
                {k.t.toFixed(2)} s
              </button>
              <IconButton icon={X} title="Remove this key" onClick={() => onRemove(k.id)} />
            </span>
          ))}
        </div>
      )}
      {keys.length >= 2 && <SelectField label="Ease" value={keys[0].ease} options={EASES} onChange={onEase} />}
      <p className="text-[11px] leading-relaxed text-neutral-500">
        {keys.length === 0
          ? `Pause the clip at a moment, add a key, move to another moment, and ${what}: a second key is written where it is, and the clip plays between them.`
          : `Between keys, ${what} and the key at the current time follows. K adds a key to the selection, Space plays and pauses.`}
      </p>
    </>
  );

  if (compact) return <div className="mt-1 flex flex-col gap-2 border-t border-white/5 pt-2">{body}</div>;
  return <Section title={keys.length ? `Keyframes · ${keys.length}` : "Keyframes"}>{body}</Section>;
}
