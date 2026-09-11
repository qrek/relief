"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Plus, X } from "lucide-react";
import { useEditor } from "../../store";
import type { LightType, SceneLight } from "../../types";
import { LIGHT_RIGS, createLight } from "../../presets/lights";
import { Button, ColorField, IconButton, Section, SelectField, Slider, TextField, Toggle } from "../ui";

const TYPE_LABEL: Record<LightType, string> = { sun: "Sun", spot: "Spot", point: "Point" };

/**
 * The lights, as a list a photographer would recognise: each one named, placed
 * by azimuth and height, with its own colour and its own shadow. Rigs put a
 * classic setup in place in one click; from there every light is editable.
 */
export function LightsSection() {
  const lights = useEditor((s) => s.project.staging.lights);
  const castShadows = useEditor((s) => s.project.staging.castShadows);
  const setStaging = useEditor((s) => s.setStaging);
  const selectedLightId = useEditor((s) => s.selectedLightId);
  const selectLight = useEditor((s) => s.selectLight);
  const [adding, setAdding] = useState(false);

  const commit = (next: SceneLight[], coalesce = false) => setStaging({ lights: next }, coalesce);
  const patchLight = (id: string, patch: Partial<SceneLight>, coalesce = true) =>
    commit(
      lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      coalesce,
    );

  return (
    <>
      <Section
        title={`Lights · ${lights.length}`}
        right={
          <Button variant="default" onClick={() => setAdding((v) => !v)}>
            {adding ? "Close" : "Add"}
          </Button>
        }
      >
        {adding && (
          <div className="flex flex-col gap-2 rounded-md bg-black/30 p-2">
            <div className="flex gap-1">
              {(["sun", "spot", "point"] as LightType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const light = createLight(t);
                    commit([...lights, light]);
                    selectLight(light.id);
                    setAdding(false);
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-2 py-1.5 text-[11px] text-neutral-200 hover:bg-white/15"
                >
                  <Plus size={12} strokeWidth={1.75} />
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Rigs, replacing the lights</div>
            {LIGHT_RIGS.map((rig) => (
              <button
                key={rig.id}
                type="button"
                title={rig.blurb}
                onClick={() => {
                  commit(rig.lights());
                  setAdding(false);
                }}
                className="rounded px-2 py-1.5 text-left hover:bg-white/10"
              >
                <div className="text-[11.5px] text-neutral-200">{rig.name}</div>
                <div className="text-[10.5px] leading-snug text-neutral-500">{rig.blurb}</div>
              </button>
            ))}
          </div>
        )}
        {lights.length === 0 && !adding && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            No lights: only the environment lights the scene. Add one, or pick a rig.
          </p>
        )}
        {lights.length > 0 && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Each light is drawn in the viewport. Click one to select it, drag it to place it; it always aims at the subject. Press 0 to step out of the camera and see the whole set.
          </p>
        )}
        {!castShadows && lights.some((l) => l.castShadow) && (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Cast shadows are off in Shadows below, so no light throws one yet.
          </p>
        )}
      </Section>

      {lights.map((light, index) => (
        <div
          key={light.id}
          onClick={() => {
            if (selectedLightId !== light.id) selectLight(light.id);
          }}
          className={light.id === selectedLightId ? "bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]" : ""}
        >
        <Section
          title={`${index + 1}. ${light.name || TYPE_LABEL[light.type]}`}
          right={
            <div className="flex items-center gap-0.5">
              <IconButton
                icon={ChevronUp}
                title="Move up"
                disabled={index === 0}
                onClick={() => {
                  const next = [...lights];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  commit(next);
                }}
              />
              <IconButton
                icon={ChevronDown}
                title="Move down"
                disabled={index === lights.length - 1}
                onClick={() => {
                  const next = [...lights];
                  [next[index + 1], next[index]] = [next[index], next[index + 1]];
                  commit(next);
                }}
              />
              <IconButton
                icon={light.enabled ? Eye : EyeOff}
                title={light.enabled ? "Switch off" : "Switch on"}
                onClick={() => patchLight(light.id, { enabled: !light.enabled }, false)}
              />
              <IconButton
                icon={Copy}
                title="Duplicate"
                onClick={() => commit([...lights, createLight(light.type, { ...light, id: undefined, name: `${light.name} copy` })])}
              />
              <IconButton
                icon={X}
                title="Remove"
                danger
                onClick={() => {
                  commit(lights.filter((l) => l.id !== light.id));
                  if (selectedLightId === light.id) selectLight(null);
                }}
              />
            </div>
          }
        >
          <div className={light.enabled ? "flex flex-col gap-2" : "pointer-events-none flex flex-col gap-2 opacity-40"}>
            <TextField label="Name" value={light.name} onChange={(name) => patchLight(light.id, { name })} />
            <SelectField
              label="Type"
              value={light.type}
              options={[
                { value: "sun", label: "Sun, parallel light" },
                { value: "spot", label: "Spot, a cone from a point" },
                { value: "point", label: "Point, a bulb" },
              ]}
              onChange={(type) => patchLight(light.id, { type }, false)}
            />
            <ColorField label="Colour" value={light.color} onChange={(color) => patchLight(light.id, { color })} />
            <Slider
              label="Intensity"
              value={light.intensity}
              min={0}
              max={light.type === "sun" ? 8 : 40}
              step={0.05}
              onChange={(intensity) => patchLight(light.id, { intensity })}
            />
            <Slider
              label="Azimuth"
              value={light.azimuth}
              min={-180}
              max={180}
              step={1}
              format={(v) => `${Math.round(v)}°`}
              onChange={(azimuth) => patchLight(light.id, { azimuth })}
            />
            <Slider
              label="Height"
              value={light.elevation}
              min={-30}
              max={90}
              step={1}
              format={(v) => `${Math.round(v)}°`}
              onChange={(elevation) => patchLight(light.id, { elevation })}
            />
            {light.type !== "sun" && (
              <Slider
                label="Distance"
                value={light.distance}
                min={1}
                max={30}
                step={0.1}
                onChange={(distance) => patchLight(light.id, { distance })}
              />
            )}
            {light.type === "spot" && (
              <>
                <Slider
                  label="Spread"
                  value={light.angle}
                  min={5}
                  max={120}
                  step={1}
                  format={(v) => `${Math.round(v)}°`}
                  onChange={(angle) => patchLight(light.id, { angle })}
                />
                <Slider label="Edge" value={light.penumbra} min={0} max={1} step={0.01} onChange={(penumbra) => patchLight(light.id, { penumbra })} />
              </>
            )}
            <Toggle label="Casts shadow" value={light.castShadow} onChange={(castShadow) => patchLight(light.id, { castShadow }, false)} />
            {light.castShadow && (
              <Slider label="Softness" value={light.softness} min={0} max={12} step={0.1} onChange={(softness) => patchLight(light.id, { softness })} />
            )}
          </div>
        </Section>
        </div>
      ))}
    </>
  );
}
