"use client";

import { useEffect, useState } from "react";
import { useEditor, useSelectedObject } from "../../store";
import { effectThumbnail, subscribeEffectThumbnail } from "../../lib/effectThumbs";
import { KeyframesSection } from "./Keyframes";
import { sampleParams } from "../../lib/keyframes";
import { useClockTick } from "../useClockTick";
import {
  EFFECTS,
  EFFECT_CATEGORIES,
  MAX_EFFECTS,
  effectById,
  effectSwatch,
} from "../../presets/effects";
import type { CoverObject, EffectInstance } from "../../types";
import type { EffectDef } from "../../presets/effects";
import { Button, ColorField, IconButton, Section, Slider } from "../ui";
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, X } from "lucide-react";

export function EffectsPanel() {
  const obj = useSelectedObject();

  if (!obj) {
    return <div className="p-4 text-xs text-neutral-500">Select an object to work on it.</div>;
  }
  if (obj.kind !== "cover") {
    return (
      <div className="p-4 text-xs leading-relaxed text-neutral-500">
        A solid object has a material, not effects. To treat the whole picture, open Look.
      </div>
    );
  }

  const cover = obj as CoverObject;
  return (
    <>
      <p className="border-b border-white/5 px-3 py-3 text-[11px] leading-relaxed text-neutral-500">
        These run on this {cover.source?.mediaType === "video" ? "video" : "image"} only, before it is placed in the
        scene. To treat the whole picture at once, type and objects included, use Look.
      </p>
      <EffectStack ownerId={cover.id} effects={cover.effects} title="Effects on this media" />
    </>
  );
}

/**
 * A stack of effects and the controls to build it. The owner id is either a
 * cover, whose media the stack treats, or the look, which treats the whole
 * frame; the store resolves which.
 */
export function EffectStack({
  ownerId,
  effects,
  title,
  hint,
  showcase = false,
}: {
  ownerId: string;
  effects: EffectInstance[];
  title: string;
  hint?: string;
  /** Opens with the gallery of effects on show while the stack is empty. */
  showcase?: boolean;
}) {
  const addEffect = useEditor((s) => s.addEffect);
  const [picking, setPicking] = useState(showcase && effects.length === 0);
  const full = effects.length >= MAX_EFFECTS;

  return (
    <>
      <Section
        title={effects.length > 0 ? `${title} · ${effects.length}` : title}
        right={
          <Button variant="default" onClick={() => setPicking((v) => !v)} disabled={full}>
            {picking ? "Close" : "Add effect"}
          </Button>
        }
      >
        {picking && !full && (
          <EffectPicker
            onPick={(effectId) => {
              addEffect(ownerId, effectId);
              setPicking(false);
            }}
          />
        )}
        {effects.length === 0 && !picking && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            {hint ?? "No effects yet. They apply from top to bottom, so the order changes the result."}
          </p>
        )}
        {full && (
          <p className="text-[11px] text-neutral-500">
            That is as many as the stack takes. Remove one to add another.
          </p>
        )}
        {!full && effects.length >= 6 && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Every effect is one more pass over the frame. A long stack is fine on a still, and a look this long
            will show on a laptop while the camera moves.
          </p>
        )}
      </Section>

      {effects.map((instance, index) => (
        <EffectCard key={instance.id} ownerId={ownerId} instance={instance} index={index} count={effects.length} />
      ))}
    </>
  );
}

/** The preview of an effect, rendered by the effect itself; blank until it is ready. */
function useEffectThumbnail(def: EffectDef): string {
  const [url, setUrl] = useState(() => effectThumbnail(def));
  useEffect(() => subscribeEffectThumbnail(def, setUrl), [def]);
  return url;
}

function EffectThumb({ def, className }: { def: EffectDef; className: string }) {
  const url = useEffectThumbnail(def);
  return (
    <span className={`block overflow-hidden bg-white/5 ${className}`} aria-hidden>
      {url && (
        // The source is a data URL made in the browser; there is nothing for next/image to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="block h-full w-full object-cover" draggable={false} />
      )}
    </span>
  );
}

/** The colour dot an effect carries on its card and in the gallery. */
function Swatch({ def }: { def: EffectDef }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: effectSwatch(def) }} aria-hidden />;
}

function EffectPicker({ onPick }: { onPick: (effectId: string) => void }) {
  const [category, setCategory] = useState<string>(EFFECT_CATEGORIES[0]);
  const list = EFFECTS.filter((e) => e.category === category);
  return (
    <div className="rounded-md bg-black/30 p-2">
      <div className="mb-2 flex flex-wrap gap-1">
        {EFFECT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              category === c ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onPick(e.id)}
            title={`Add ${e.name}`}
            className="group flex flex-col gap-1 rounded-md p-1 text-left hover:bg-white/10"
          >
            <EffectThumb def={e} className="aspect-[4/3] w-full rounded ring-1 ring-white/10 group-hover:ring-[var(--accent-edge)]" />
            <span className="flex min-w-0 items-center gap-1 px-0.5 text-[10.5px] leading-tight text-neutral-300 group-hover:text-white">
              <Swatch def={e} />
              <span className="truncate">{e.name}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EffectCard({
  ownerId,
  instance,
  index,
  count,
}: {
  ownerId: string;
  instance: EffectInstance;
  index: number;
  count: number;
}) {
  const removeEffect = useEditor((s) => s.removeEffect);
  const moveEffect = useEditor((s) => s.moveEffect);
  const toggleEffect = useEditor((s) => s.toggleEffect);
  const setEffectParam = useEditor((s) => s.setEffectParam);
  const setEffectColor = useEditor((s) => s.setEffectColor);
  const resetEffect = useEditor((s) => s.resetEffect);
  const addEffectKey = useEditor((s) => s.addEffectKey);
  const removeEffectKey = useEditor((s) => s.removeEffectKey);
  const setEffectKeysEase = useEditor((s) => s.setEffectKeysEase);
  const closeEffectLoop = useEditor((s) => s.closeEffectLoop);
  const tick = useClockTick();
  // A keyed effect shows the numbers its keys give right now.
  const shown = instance.keys.length ? sampleParams(instance.keys, tick.time, instance.params) : instance.params;

  const def = effectById(instance.effectId);
  if (!def) {
    return (
      <Section title={`Unknown effect: ${instance.effectId}`}>
        <Button variant="danger" onClick={() => removeEffect(ownerId, instance.id)}>
          Remove
        </Button>
      </Section>
    );
  }

  return (
    <Section
      title={
        <>
          <Swatch def={def} />
          {`${index + 1}. ${def.name}`}
        </>
      }
      right={
        <div className="flex items-center gap-0.5">
          <IconButton icon={ChevronUp} title="Move up" disabled={index === 0} onClick={() => moveEffect(ownerId, instance.id, -1)} />
          <IconButton icon={ChevronDown} title="Move down" disabled={index === count - 1} onClick={() => moveEffect(ownerId, instance.id, 1)} />
          <IconButton icon={instance.enabled ? Eye : EyeOff} title={instance.enabled ? "Mute" : "Unmute"} onClick={() => toggleEffect(ownerId, instance.id)} />
          <IconButton icon={RotateCcw} title="Reset" onClick={() => resetEffect(ownerId, instance.id)} />
          <IconButton icon={X} title="Remove" danger onClick={() => removeEffect(ownerId, instance.id)} />
        </div>
      }
    >
      <div className={instance.enabled ? "" : "pointer-events-none opacity-40"}>
        <div className="flex flex-col gap-2">
          {def.params.map((p) => (
            <Slider
              key={p.key}
              label={p.label}
              value={shown[p.key] ?? p.default}
              min={p.min}
              max={p.max}
              step={p.step}
              format={p.step >= 1 ? (v) => String(Math.round(v)) : undefined}
              onChange={(v) => setEffectParam(ownerId, instance.id, p.key, v)}
            />
          ))}
          {def.colors.map((c) => (
            <ColorField
              key={c.key}
              label={c.label}
              value={instance.colors[c.key] ?? c.default}
              onChange={(v) => setEffectColor(ownerId, instance.id, c.key, v)}
            />
          ))}
          <KeyframesSection
            compact
            keys={instance.keys}
            what="move a slider"
            onAdd={(at) => addEffectKey(ownerId, instance.id, at)}
            onRemove={(keyId) => removeEffectKey(ownerId, instance.id, keyId)}
            onEase={(ease) => setEffectKeysEase(ownerId, instance.id, ease)}
            onCloseLoop={() => closeEffectLoop(ownerId, instance.id)}
          />
        </div>
      </div>
    </Section>
  );
}
