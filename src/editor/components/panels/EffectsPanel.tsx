"use client";

import { useState } from "react";
import { useEditor, useSelectedObject } from "../../store";
import {
  EFFECTS,
  EFFECT_CATEGORIES,
  MAX_EFFECTS,
  effectById,
} from "../../presets/effects";
import type { CoverObject, EffectInstance } from "../../types";
import { Button, ColorField, Section, Slider } from "../ui";

export function EffectsPanel() {
  const obj = useSelectedObject();
  const addEffect = useEditor((s) => s.addEffect);
  const [picking, setPicking] = useState(false);

  if (!obj) {
    return <div className="p-4 text-xs text-neutral-500">Select an object to work on it.</div>;
  }
  if (obj.kind !== "cover") {
    return (
      <div className="p-4 text-xs leading-relaxed text-neutral-500">
        Effects run on cover objects: an image or a video placed in the scene.
        <br />
        <br />
        Add one from the toolbar above, then stack up to {MAX_EFFECTS} effects on it.
      </div>
    );
  }

  const cover = obj as CoverObject;
  const full = cover.effects.length >= MAX_EFFECTS;

  return (
    <>
      <Section
        title={`Stack · ${cover.effects.length}/${MAX_EFFECTS}`}
        right={
          <Button variant="default" onClick={() => setPicking((v) => !v)} disabled={full}>
            {picking ? "Close" : "Add effect"}
          </Button>
        }
      >
        {picking && !full && (
          <EffectPicker
            onPick={(effectId) => {
              addEffect(cover.id, effectId);
              setPicking(false);
            }}
          />
        )}
        {cover.effects.length === 0 && !picking && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            No effects yet. They apply from top to bottom, so the order changes the result.
          </p>
        )}
        {full && (
          <p className="text-[11px] text-neutral-500">
            Stack is full. Remove one to add another.
          </p>
        )}
      </Section>

      {cover.effects.map((instance, index) => (
        <EffectCard
          key={instance.id}
          cover={cover}
          instance={instance}
          index={index}
          count={cover.effects.length}
        />
      ))}
    </>
  );
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
              category === c ? "bg-white text-black" : "bg-white/10 text-neutral-300 hover:bg-white/15"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onPick(e.id)}
            className="rounded px-2 py-1.5 text-left text-[11px] text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function EffectCard({
  cover,
  instance,
  index,
  count,
}: {
  cover: CoverObject;
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

  const def = effectById(instance.effectId);
  if (!def) {
    return (
      <Section title={`Unknown effect: ${instance.effectId}`}>
        <Button variant="danger" onClick={() => removeEffect(cover.id, instance.id)}>
          Remove
        </Button>
      </Section>
    );
  }

  return (
    <Section
      title={`${index + 1}. ${def.name}`}
      right={
        <div className="flex items-center gap-0.5">
          <IconButton title="Move up" disabled={index === 0} onClick={() => moveEffect(cover.id, instance.id, -1)}>
            ↑
          </IconButton>
          <IconButton
            title="Move down"
            disabled={index === count - 1}
            onClick={() => moveEffect(cover.id, instance.id, 1)}
          >
            ↓
          </IconButton>
          <IconButton
            title={instance.enabled ? "Mute" : "Unmute"}
            onClick={() => toggleEffect(cover.id, instance.id)}
          >
            {instance.enabled ? "●" : "○"}
          </IconButton>
          <IconButton title="Reset" onClick={() => resetEffect(cover.id, instance.id)}>
            ↺
          </IconButton>
          <IconButton title="Remove" onClick={() => removeEffect(cover.id, instance.id)}>
            ×
          </IconButton>
        </div>
      }
    >
      <div className={instance.enabled ? "" : "pointer-events-none opacity-40"}>
        <div className="flex flex-col gap-2">
          {def.params.map((p) => (
            <Slider
              key={p.key}
              label={p.label}
              value={instance.params[p.key] ?? p.default}
              min={p.min}
              max={p.max}
              step={p.step}
              format={p.step >= 1 ? (v) => String(Math.round(v)) : undefined}
              onChange={(v) => setEffectParam(cover.id, instance.id, p.key, v)}
            />
          ))}
          {def.colors.map((c) => (
            <ColorField
              key={c.key}
              label={c.label}
              value={instance.colors[c.key] ?? c.default}
              onChange={(v) => setEffectColor(cover.id, instance.id, c.key, v)}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="h-5 w-5 rounded text-[11px] leading-none text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
