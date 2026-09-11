"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { objectKindLabel, useEditor, useSelectedObject } from "../../store";
import { useRuntime } from "../../runtime";
import { FONTS } from "../../presets/fonts";
import { defaultParams, objectPresetById } from "../../presets/objects";
import { mediaTypeOf } from "../../lib/media";
import { MOTIONS, motionById, motionPeriod } from "../../presets/motion";
import { MediaLibrary } from "./MediaLibrary";
import type { CoverObject, LabelObject, ModelObject, Motion, ShapeObject, TextObject } from "../../types";
import { Button, ColorField, Row, Section, SelectField, Slider, TextField, Toggle, Vec3Field } from "../ui";

export function ObjectPanel() {
  const obj = useSelectedObject();
  const updateObject = useEditor((s) => s.updateObject);
  const setTransform = useEditor((s) => s.setTransform);
  const removeObject = useEditor((s) => s.removeObject);
  const duplicateObject = useEditor((s) => s.duplicateObject);
  const toggleLock = useEditor((s) => s.toggleLock);
  const error = useRuntime((s) => (obj ? s.errors[obj.id] : undefined));

  if (!obj) {
    return (
      <div className="p-4 text-xs leading-relaxed text-neutral-500">
        Select an object in the viewport or the layers list, or add a new one from the left toolbar.
        <br />
        <br />
        Shift-click a mesh to give that layer its own material.
      </div>
    );
  }

  const t = obj.transform;
  return (
    <>
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{error}</div>
      )}

      <Section
        title={objectKindLabel(obj)}
        right={
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => duplicateObject(obj.id)} title="Duplicate (Ctrl+D)">
              Duplicate
            </Button>
            <Button variant="danger" onClick={() => removeObject(obj.id)} title="Delete">
              Delete
            </Button>
          </div>
        }
      >
        <TextField label="Name" value={obj.name} onChange={(name) => updateObject(obj.id, { name })} />
        <Toggle label="Visible" value={obj.visible} onChange={(visible) => updateObject(obj.id, { visible }, false)} />
        <Toggle label="Freeze" value={obj.locked} onChange={() => toggleLock(obj.id)} />
        {obj.kind === "text" && <TextFields obj={obj} />}
        {obj.kind === "shape" && <ShapeFields obj={obj} />}
        {obj.kind === "model" && <ModelFields obj={obj} />}
        {obj.kind === "cover" && <CoverFields obj={obj} />}
        {obj.kind === "label" && <LabelFields obj={obj} />}
      </Section>

      {(obj.kind === "text" || obj.kind === "shape") && (
        <Section title="Geometry">
          <Slider label="Depth" value={obj.depth} min={0} max={3} step={0.01} onChange={(depth) => updateObject(obj.id, { depth })} />
          <Toggle label="Bevel" value={obj.bevelEnabled} onChange={(bevelEnabled) => updateObject(obj.id, { bevelEnabled }, false)} />
          {obj.bevelEnabled && (
            <>
              <Slider label="Bevel size" value={obj.bevelSize} min={0} max={0.3} step={0.005} onChange={(bevelSize) => updateObject(obj.id, { bevelSize })} />
              <Slider label="Bevel depth" value={obj.bevelThickness} min={0} max={0.3} step={0.005} onChange={(bevelThickness) => updateObject(obj.id, { bevelThickness })} />
              <Slider label="Bevel steps" value={obj.bevelSegments} min={1} max={12} step={1} onChange={(bevelSegments) => updateObject(obj.id, { bevelSegments })} />
            </>
          )}
          <Slider label="Smoothness" value={obj.curveSegments} min={1} max={32} step={1} onChange={(curveSegments) => updateObject(obj.id, { curveSegments })} />
        </Section>
      )}

      <MotionSection objectId={obj.id} motion={obj.motion} />

      <Section title="Transform">
        <Vec3Field label="Position" value={t.position} onChange={(position) => setTransform(obj.id, { ...t, position })} />
        <Vec3Field
          label="Rotation"
          value={t.rotation.map((r) => THREE.MathUtils.radToDeg(r)) as [number, number, number]}
          step={1}
          format={(v) => String(Math.round(v))}
          onChange={(r) =>
            setTransform(obj.id, {
              ...t,
              rotation: r.map((d) => THREE.MathUtils.degToRad(d)) as [number, number, number],
            })
          }
        />
        <Vec3Field label="Scale" value={t.scale} onChange={(scale) => setTransform(obj.id, { ...t, scale })} />
        <Row label="">
          <Button
            variant="ghost"
            onClick={() => setTransform(obj.id, { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })}
          >
            Reset transform
          </Button>
        </Row>
      </Section>
    </>
  );
}

function LabelFields({ obj }: { obj: LabelObject }) {
  const updateObject = useEditor((s) => s.updateObject);
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Text
        <textarea
          value={obj.text}
          rows={2}
          onChange={(e) =>
            updateObject(obj.id, { text: e.target.value, name: e.target.value.split("\n")[0] || "Label" })
          }
          className="w-full resize-y rounded bg-white/5 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-[var(--accent-edge)]"
        />
      </label>
      <SelectField
        label="Font"
        value={obj.fontId}
        options={FONTS.map((f) => ({ value: f.id, label: `${f.name} · ${f.category}` }))}
        onChange={(fontId) => updateObject(obj.id, { fontId }, false)}
      />
      <SelectField
        label="Align"
        value={obj.align}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Centre" },
          { value: "right", label: "Right" },
        ]}
        onChange={(align) => updateObject(obj.id, { align }, false)}
      />
      <SelectField
        label="Depth"
        value={obj.depth}
        options={[
          { value: "front", label: "In front, over the picture" },
          { value: "behind", label: "Behind, objects pass in front" },
        ]}
        onChange={(depth) => updateObject(obj.id, { depth }, false)}
      />
      <SelectField
        label="Case"
        value={obj.textCase}
        options={[
          { value: "none", label: "As typed" },
          { value: "upper", label: "UPPERCASE" },
          { value: "lower", label: "lowercase" },
        ]}
        onChange={(textCase) => updateObject(obj.id, { textCase }, false)}
      />
      <ColorField label="Colour" value={obj.color} onChange={(color) => updateObject(obj.id, { color })} />
      <Slider label="Size" value={obj.size} min={0.01} max={0.5} step={0.002} format={(v) => `${Math.round(v * 100)}%`} onChange={(size) => updateObject(obj.id, { size })} />
      <Slider label="Opacity" value={obj.opacity} min={0} max={1} step={0.01} onChange={(opacity) => updateObject(obj.id, { opacity })} />
      <Slider label="Spacing" value={obj.letterSpacing} min={-0.15} max={0.6} step={0.005} onChange={(letterSpacing) => updateObject(obj.id, { letterSpacing })} />
      <Slider label="Line height" value={obj.lineHeight} min={0.6} max={2.4} step={0.01} onChange={(lineHeight) => updateObject(obj.id, { lineHeight })} />
      <Slider label="Across" value={obj.anchorX} min={-0.5} max={0.5} step={0.005} onChange={(anchorX) => updateObject(obj.id, { anchorX })} />
      <Slider label="Up" value={obj.anchorY} min={-0.5} max={0.5} step={0.005} onChange={(anchorY) => updateObject(obj.id, { anchorY })} />
      <Slider label="Tilt" value={obj.tilt} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(tilt) => updateObject(obj.id, { tilt })} />
      <p className="text-[11px] leading-relaxed text-neutral-500">
        Flat type sits on the frame, not in the scene. It never turns when you orbit, and it stays put across formats.
      </p>
    </>
  );
}

function MotionSection({ objectId, motion }: { objectId: string; motion: Motion }) {
  const setMotion = useEditor((s) => s.setMotion);
  const def = motionById(motion.preset);
  const period = motionPeriod(motion);

  return (
    <Section title="Motion">
      <SelectField
        label="Preset"
        value={motion.preset}
        options={MOTIONS.map((m) => ({ value: m.id, label: m.name }))}
        onChange={(preset) => setMotion(objectId, { preset }, false)}
      />
      <p className="text-[11px] leading-relaxed text-neutral-500">{def.hint}</p>
      {motion.preset !== "none" && (
        <>
          <Slider
            label="Speed"
            value={motion.speed}
            min={0.01}
            max={3}
            step={0.01}
            format={(v) => `${v.toFixed(2)}/s`}
            onChange={(speed) => setMotion(objectId, { speed })}
          />
          {def.uses.amount && (
            <Slider label="Amount" value={motion.amount} min={0} max={3} step={0.01} onChange={(amount) => setMotion(objectId, { amount })} />
          )}
          {def.uses.axis && (
            <SelectField
              label="Axis"
              value={String(motion.axis)}
              options={[
                { value: "0", label: "X" },
                { value: "1", label: "Y" },
                { value: "2", label: "Z" },
              ]}
              onChange={(v) => setMotion(objectId, { axis: parseInt(v, 10) }, false)}
            />
          )}
          <Slider
            label="Offset"
            value={motion.phase}
            min={0}
            max={1}
            step={0.01}
            onChange={(phase) => setMotion(objectId, { phase })}
          />
          {period !== null && (
            <p className="text-[11px] text-neutral-500">
              One cycle takes {period.toFixed(2)}s. A clip that long loops seamlessly.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

function CoverFields({ obj }: { obj: CoverObject }) {
  const updateObject = useEditor((s) => s.updateObject);
  const setActivePanel = useEditor((s) => s.setActivePanel);
  const [picking, setPicking] = useState(false);

  return (
    <>
      <Row label="Media">
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={() => setPicking(true)}>
            {obj.source ? "Change media…" : "Choose media…"}
          </Button>
          {obj.source && (
            <span className="truncate text-[11px] text-neutral-500">{obj.source.mediaType}</span>
          )}
        </div>
      </Row>
      <Toggle
        label="Backdrop"
        value={obj.background}
        onChange={(background) => updateObject(obj.id, { background }, false)}
      />
      {obj.background ? (
        <p className="text-[11px] leading-relaxed text-neutral-500">
          Filling the frame behind everything and following the camera. Select it from the layers list.
        </p>
      ) : (
        <Slider label="Size" value={obj.size} min={0.5} max={20} step={0.05} onChange={(size) => updateObject(obj.id, { size })} />
      )}
      <Slider label="Stretch" value={obj.stretch} min={0.25} max={4} step={0.01} onChange={(stretch) => updateObject(obj.id, { stretch })} />
      <Row label="">
        <Button variant="ghost" onClick={() => setActivePanel("effects")}>
          {obj.effects.length > 0 ? `Edit ${obj.effects.length} effect${obj.effects.length === 1 ? "" : "s"}` : "Add effects"}
        </Button>
      </Row>

      {picking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={() => setPicking(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <MediaLibrary
              onClose={() => setPicking(false)}
              onPick={(asset) => {
                const mediaType = mediaTypeOf(asset.format) ?? "image";
                updateObject(obj.id, { source: { assetId: asset.id, mediaType }, name: asset.name }, false);
                setPicking(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ModelFields({ obj }: { obj: ModelObject }) {
  const updateObject = useEditor((s) => s.updateObject);
  const setModelParam = useEditor((s) => s.setModelParam);
  const parts = useRuntime((s) => s.parts[obj.id]);
  const preset = obj.source.type === "procedural" ? objectPresetById(obj.source.presetId) : undefined;
  const params = obj.source.type === "procedural" ? obj.source.params : {};

  return (
    <>
      <Slider label="Size" value={obj.size} min={0.2} max={8} step={0.01} onChange={(size) => updateObject(obj.id, { size })} />
      {obj.source.type === "asset" && (
        <>
          <Toggle
            label="File materials"
            value={obj.useSourceMaterials}
            onChange={(useSourceMaterials) => updateObject(obj.id, { useSourceMaterials }, false)}
          />
          <p className="text-[11px] leading-relaxed text-neutral-500">
            {obj.useSourceMaterials
              ? "Rendering the materials that shipped with the file. Turn this off to restyle it with the material gallery."
              : "Rendering with the material gallery. Shift-click a mesh to give it its own material."}
          </p>
        </>
      )}
      {preset && (
        <>
          {preset.params.map((def) => (
            <Slider
              key={def.key}
              label={def.label}
              value={params[def.key] ?? def.default}
              min={def.min}
              max={def.max}
              step={def.step}
              format={def.step >= 1 ? (v) => String(Math.round(v)) : undefined}
              onChange={(v) => setModelParam(obj.id, def.key, v)}
            />
          ))}
          <Row label="">
            <Button
              variant="ghost"
              onClick={() =>
                updateObject(
                  obj.id,
                  { source: { type: "procedural", presetId: preset.id, params: defaultParams(preset) } },
                  false,
                )
              }
            >
              Reset shape
            </Button>
          </Row>
        </>
      )}
      {parts && parts.length > 1 && (
        <p className="text-[11px] text-neutral-500">
          {parts.length} layers. Shift-click one in the viewport, or pick it in the layers list, to give it its own
          material.
        </p>
      )}
    </>
  );
}

function TextFields({ obj }: { obj: TextObject }) {
  const updateObject = useEditor((s) => s.updateObject);
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Text
        <textarea
          value={obj.text}
          rows={3}
          onChange={(e) =>
            updateObject(obj.id, { text: e.target.value, name: e.target.value.split("\n")[0] || "Text" })
          }
          className="w-full resize-y rounded bg-white/5 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-[var(--accent-edge)]"
        />
      </label>
      <SelectField
        label="Font"
        value={obj.fontId}
        options={FONTS.map((f) => ({ value: f.id, label: `${f.name} · ${f.category}` }))}
        onChange={(fontId) => updateObject(obj.id, { fontId }, false)}
      />
      <SelectField
        label="Case"
        value={obj.textCase}
        options={[
          { value: "none", label: "As typed" },
          { value: "upper", label: "UPPERCASE" },
          { value: "lower", label: "lowercase" },
        ]}
        onChange={(textCase) => updateObject(obj.id, { textCase }, false)}
      />
      <Slider label="Size" value={obj.size} min={0.1} max={4} step={0.01} onChange={(size) => updateObject(obj.id, { size })} />
      <Slider label="Spacing" value={obj.letterSpacing} min={-0.2} max={1} step={0.005} onChange={(letterSpacing) => updateObject(obj.id, { letterSpacing })} />
      <Slider label="Line height" value={obj.lineHeight} min={0.5} max={2.5} step={0.01} onChange={(lineHeight) => updateObject(obj.id, { lineHeight })} />
    </>
  );
}

function ShapeFields({ obj }: { obj: ShapeObject }) {
  const updateObject = useEditor((s) => s.updateObject);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Slider label="Size" value={obj.size} min={0.1} max={6} step={0.01} onChange={(size) => updateObject(obj.id, { size })} />
      <Row label="SVG">
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={() => fileRef.current?.click()}>
            Replace SVG…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const svg = await file.text();
              updateObject(obj.id, { svg, name: file.name.replace(/\.svg$/i, "") }, false);
              e.target.value = "";
            }}
          />
        </div>
      </Row>
    </>
  );
}
