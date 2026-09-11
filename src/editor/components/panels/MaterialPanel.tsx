"use client";

import { useEffect, useState } from "react";
import { effectiveMaterial, useEditor, useSelectedObject } from "../../store";
import { usePartsOf } from "../../runtime";
import { MATERIAL_CATEGORIES, MATERIAL_PRESETS } from "../../presets/materials";
import { materialThumbnail, subscribeMaterialThumbnail } from "../../lib/materialThumbs";
import type { Artwork, MaterialParams, MaterialPreset } from "../../types";
import { MediaLibrary } from "./MediaLibrary";
import { Button, ColorField, Row, Section, Slider, Toggle } from "../ui";

/**
 * Prints a logo or a design onto the surface. It wraps with the object's own
 * UVs, so cylinders and boxes behave like real packaging.
 */
function ArtworkSection({
  artwork,
  onChange,
}: {
  artwork: Artwork;
  onChange: (patch: Partial<Artwork>, coalesce?: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <Section
      title="Artwork"
      right={
        artwork.assetId ? (
          <Button variant="ghost" onClick={() => onChange({ assetId: null }, false)}>
            Remove
          </Button>
        ) : undefined
      }
    >
      <Row label="Image">
        <Button variant="default" onClick={() => setPicking(true)}>
          {artwork.assetId ? "Change artwork…" : "Place a logo…"}
        </Button>
      </Row>
      {artwork.assetId && (
        <>
          <Slider label="Scale" value={artwork.scale} min={0.05} max={3} step={0.01} onChange={(scale) => onChange({ scale })} />
          <Slider label="Across" value={artwork.offsetX} min={-0.5} max={0.5} step={0.005} onChange={(offsetX) => onChange({ offsetX })} />
          <Slider label="Up" value={artwork.offsetY} min={-0.5} max={0.5} step={0.005} onChange={(offsetY) => onChange({ offsetY })} />
          <Slider
            label="Rotate"
            value={artwork.rotation}
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
            format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
            onChange={(rotation) => onChange({ rotation })}
          />
          <Slider
            label="Wrap"
            value={artwork.repeat}
            min={0.2}
            max={6}
            step={0.05}
            onChange={(repeat) => onChange({ repeat })}
          />
          <Toggle label="Repeat" value={artwork.tile} onChange={(tile) => onChange({ tile }, false)} />
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Wrap sets how many times the surface goes around the artwork. On a can or a bottle, raise it to shrink the
            label and turn it with Across.
          </p>
        </>
      )}
      {picking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={() => setPicking(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <MediaLibrary
              onClose={() => setPicking(false)}
              onPick={(asset) => {
                onChange({ assetId: asset.id }, false);
                setPicking(false);
              }}
            />
          </div>
        </div>
      )}
    </Section>
  );
}

/** The rendered ball for a preset; the painted swatch stands in until it exists. */
function MaterialBall({ preset, className }: { preset: MaterialPreset; className: string }) {
  const [url, setUrl] = useState(() => materialThumbnail(preset));
  useEffect(() => subscribeMaterialThumbnail(preset, setUrl), [preset]);
  return (
    <span className={`block overflow-hidden ${className}`} style={url ? undefined : swatchStyle(preset)} aria-hidden>
      {url && (
        // A data URL rendered in the browser; nothing for next/image to do.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="block h-full w-full object-cover" draggable={false} />
      )}
    </span>
  );
}

function swatchStyle(m: MaterialPreset): React.CSSProperties {
  const p = m.params;
  const color = p.color ?? "#f2f2f2";
  const metal = p.metalness ?? 0;
  const rough = p.roughness ?? 0.4;
  const glass = p.transmission ?? 0;
  const glow = p.emissiveIntensity && p.emissive && p.emissive !== "#000000" ? p.emissive : null;
  const highlight = `rgba(255,255,255,${(1 - rough) * (metal ? 0.9 : 0.6)})`;
  const iri = p.iridescence
    ? "conic-gradient(from 200deg, #ff8fd8, #8fd3ff, #b8ff9c, #ffd48f, #ff8fd8)"
    : null;
  return {
    background: [
      `radial-gradient(circle at 32% 28%, ${highlight} 0%, transparent 38%)`,
      iri ? iri : null,
      `linear-gradient(160deg, ${color} 0%, ${color} 55%, rgba(0,0,0,${metal ? 0.55 : 0.3}) 100%)`,
    ]
      .filter(Boolean)
      .join(","),
    backgroundBlendMode: iri ? "normal, overlay, normal" : undefined,
    opacity: glass ? 0.6 : 1,
    boxShadow: glow ? `0 0 14px ${glow}` : undefined,
  };
}

export function MaterialPanel() {
  const obj = useSelectedObject();
  const selectedPartId = useEditor((s) => s.selectedPartId);
  const selectPart = useEditor((s) => s.selectPart);
  const setMaterial = useEditor((s) => s.setMaterial);
  const setPartMaterial = useEditor((s) => s.setPartMaterial);
  const applyMaterialPreset = useEditor((s) => s.applyMaterialPreset);
  const applyPartPreset = useEditor((s) => s.applyPartPreset);
  const resetPart = useEditor((s) => s.resetPart);
  const parts = usePartsOf(obj?.id ?? null);
  const [category, setCategory] = useState<string>("All");

  if (!obj) {
    return <div className="p-4 text-xs text-neutral-500">Select an object to edit its material.</div>;
  }

  const usingSource = obj.kind === "model" && obj.source.type === "asset" && obj.useSourceMaterials;
  const target = effectiveMaterial(obj, selectedPartId);
  const m = target.material;
  const overridden = !!(selectedPartId && obj.parts[selectedPartId]);

  const set = (patch: Partial<MaterialParams>, coalesce = true) =>
    selectedPartId
      ? setPartMaterial(obj.id, selectedPartId, patch, coalesce)
      : setMaterial(obj.id, patch, coalesce);

  const applyPreset = (presetId: string) =>
    selectedPartId ? applyPartPreset(obj.id, selectedPartId, presetId) : applyMaterialPreset(obj.id, presetId);

  const list = MATERIAL_PRESETS.filter((x) => category === "All" || x.category === category);

  return (
    <>
      {usingSource && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          This model is rendering its own file materials. Turn off &quot;File materials&quot; in the Object tab to
          restyle it here.
        </div>
      )}

      {parts.length > 1 && (
        <Section
          title="Layers"
          right={
            overridden ? (
              <Button variant="ghost" onClick={() => resetPart(obj.id, selectedPartId!)}>
                Reset layer
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => selectPart(null)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                selectedPartId === null ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
              }`}
            >
              All layers
            </button>
            {parts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPart(p.id)}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  selectedPartId === p.id ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-300 hover:bg-white/15"
                } ${obj.parts[p.id] ? "ring-1 ring-emerald-400/60" : ""}`}
                title={obj.parts[p.id] ? `${p.name} has its own material` : p.name}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            {selectedPartId
              ? `Edits apply to ${parts.find((p) => p.id === selectedPartId)?.name ?? "this layer"} only.`
              : "Edits apply to every layer without its own material."}
          </p>
        </Section>
      )}

      <Section title="Material gallery">
        <div className="flex flex-wrap gap-1">
          {["All", ...MATERIAL_CATEGORIES].map((c) => (
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
        <div className="grid grid-cols-4 gap-2">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onClick={() => applyPreset(p.id)}
              className={`group flex flex-col items-center gap-1 rounded-md p-1 ${
                target.materialPresetId === p.id ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent-edge)]" : "hover:bg-white/10"
              }`}
            >
              <MaterialBall preset={p} className="h-14 w-14 rounded-full ring-1 ring-white/10" />
              <span className="w-full truncate text-center text-[10px] text-neutral-400 group-hover:text-neutral-200">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <ArtworkSection
        artwork={m.artwork}
        onChange={(patch, coalesce) => set({ artwork: { ...m.artwork, ...patch } }, coalesce)}
      />

      <Section title="Surface">
        <ColorField label="Color" value={m.color} onChange={(color) => set({ color })} />
        <Slider label="Roughness" value={m.roughness} min={0} max={1} onChange={(roughness) => set({ roughness })} />
        <Slider label="Metalness" value={m.metalness} min={0} max={1} onChange={(metalness) => set({ metalness })} />
        <Slider label="Clearcoat" value={m.clearcoat} min={0} max={1} onChange={(clearcoat) => set({ clearcoat })} />
        <Slider label="Coat rough." value={m.clearcoatRoughness} min={0} max={1} onChange={(clearcoatRoughness) => set({ clearcoatRoughness })} />
        <Slider label="Reflections" value={m.envMapIntensity} min={0} max={3} onChange={(envMapIntensity) => set({ envMapIntensity })} />
        <Toggle label="Flat shading" value={m.flatShading} onChange={(flatShading) => set({ flatShading }, false)} />
      </Section>

      <Section title="Glass">
        <Slider label="Transmission" value={m.transmission} min={0} max={1} onChange={(transmission) => set({ transmission })} />
        <Slider label="Thickness" value={m.thickness} min={0} max={5} onChange={(thickness) => set({ thickness })} />
        <Slider label="IOR" value={m.ior} min={1} max={2.4} onChange={(ior) => set({ ior })} />
        <Slider label="Opacity" value={m.opacity} min={0} max={1} onChange={(opacity) => set({ opacity })} />
      </Section>

      <Section title="Special">
        <Slider label="Iridescence" value={m.iridescence} min={0} max={1} onChange={(iridescence) => set({ iridescence })} />
        <Slider label="Sheen" value={m.sheen} min={0} max={1} onChange={(sheen) => set({ sheen })} />
        <ColorField label="Sheen color" value={m.sheenColor} onChange={(sheenColor) => set({ sheenColor })} />
        <ColorField label="Emissive" value={m.emissive} onChange={(emissive) => set({ emissive })} />
        <Slider label="Glow" value={m.emissiveIntensity} min={0} max={5} onChange={(emissiveIntensity) => set({ emissiveIntensity })} />
        <Row label="">
          <span className="text-[11px] text-neutral-600">
            {overridden ? "This layer overrides the object material." : ""}
          </span>
        </Row>
      </Section>
    </>
  );
}
