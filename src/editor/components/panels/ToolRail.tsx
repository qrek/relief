"use client";

import { useEffect, useRef } from "react";
import { useEditor, type LibraryId, type TransformMode } from "../../store";
import { SHAPES } from "../../presets/shapes";
import { ObjectLibrary } from "./ObjectLibrary";
import { MediaLibrary } from "./MediaLibrary";
import { mediaTypeOf } from "../../lib/media";

export function ToolRail() {
  const addText = useEditor((s) => s.addText);
  const addShape = useEditor((s) => s.addShape);
  const addCover = useEditor((s) => s.addCover);
  const addLabel = useEditor((s) => s.addLabel);
  const transformMode = useEditor((s) => s.transformMode);
  const setTransformMode = useEditor((s) => s.setTransformMode);
  const open = useEditor((s) => s.library);
  const setOpen = useEditor((s) => s.setLibrary);
  const fileRef = useRef<HTMLInputElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const toggle = (id: Exclude<LibraryId, null>) => setOpen(open === id ? null : id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!popover.current?.contains(target) && !railRef.current?.contains(target)) setOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, setOpen]);

  const modes: { id: TransformMode; label: string; key: string }[] = [
    { id: "translate", label: "Move", key: "W" },
    { id: "rotate", label: "Rotate", key: "E" },
    { id: "scale", label: "Scale", key: "R" },
  ];

  return (
    <div
      ref={railRef}
      className="relative flex w-14 flex-col items-center gap-1 border-r border-white/5 bg-neutral-900 py-2"
    >
      <RailButton label="Text" hint="Add 3D text (T)" onClick={() => addText()}>
        <span className="font-serif text-lg leading-none">T</span>
      </RailButton>
      <RailButton label="Shape" hint="Add a shape from SVG (S)" active={open === "shapes"} onClick={() => toggle("shapes")}>
        <span className="text-base leading-none">◆</span>
      </RailButton>
      <RailButton label="Object" hint="Add a 3D object (O)" active={open === "objects"} onClick={() => toggle("objects")}>
        <span className="text-base leading-none">⬢</span>
      </RailButton>
      <RailButton label="Type" hint="Add flat 2D type on the frame (L)" onClick={() => addLabel()}>
        <span className="text-[13px] font-semibold leading-none">Aa</span>
      </RailButton>
      <RailButton label="Cover" hint="Add an image or video with effects (C)" active={open === "media"} onClick={() => toggle("media")}>
        <span className="text-base leading-none">▤</span>
      </RailButton>

      <div className="my-2 h-px w-8 bg-white/10" />

      {modes.map((m) => (
        <RailButton
          key={m.id}
          label={m.label}
          hint={`${m.label} (${m.key})`}
          active={transformMode === m.id}
          onClick={() => setTransformMode(m.id)}
        >
          <span className="text-[10px] font-semibold">{m.key}</span>
        </RailButton>
      ))}

      {open && (
        <div ref={popover} className="absolute left-16 top-2 z-20">
          {open === "objects" ? (
            <ObjectLibrary onClose={() => setOpen(null)} />
          ) : open === "media" ? (
            <MediaLibrary
              onClose={() => setOpen(null)}
              onPick={(asset) => {
                const mediaType = mediaTypeOf(asset.format) ?? "image";
                addCover({ assetId: asset.id, mediaType }, asset.name);
              }}
            />
          ) : (
            <div className="w-64 rounded-lg border border-white/10 bg-neutral-900 p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Shapes</span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded bg-white/10 px-2 py-1 text-[11px] text-neutral-200 hover:bg-white/15"
                >
                  Upload SVG
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    addShape(await file.text(), file.name.replace(/\.svg$/i, ""));
                    e.target.value = "";
                    setOpen(null);
                  }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.name}
                    onClick={() => {
                      addShape(s.svg, s.name);
                      setOpen(null);
                    }}
                    className="flex aspect-square items-center justify-center rounded-md bg-white/5 p-2 hover:bg-white/15"
                  >
                    <span
                      className="h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:fill-neutral-200"
                      dangerouslySetInnerHTML={{ __html: s.svg }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RailButton({
  children,
  label,
  hint,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className={`flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-ink)]"
          : "text-neutral-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
      <span className="text-[9px] uppercase tracking-wide opacity-70">{label}</span>
    </button>
  );
}
