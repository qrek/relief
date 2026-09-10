"use client";

import { useEffect, useRef } from "react";
import { useEditor, type LibraryId, type TransformMode } from "../../store";
import { SHAPES } from "../../presets/shapes";
import { ObjectLibrary } from "./ObjectLibrary";
import { MediaLibrary } from "./MediaLibrary";
import { mediaTypeOf } from "../../lib/media";

/**
 * Tools sit along the top rather than down the side. The whole left edge then
 * belongs to the layers list, which is the one thing a designer scans while
 * working, and the tools read as a row of verbs across the top of the document.
 */
export function Toolbar() {
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
  const barRef = useRef<HTMLDivElement>(null);

  const toggle = (id: Exclude<LibraryId, null>) => setOpen(open === id ? null : id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!popover.current?.contains(target) && !barRef.current?.contains(target)) setOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, setOpen]);

  const modes: { id: TransformMode; label: string; key: string; glyph: string }[] = [
    { id: "translate", label: "Move", key: "V", glyph: "✥" },
    { id: "rotate", label: "Rotate", key: "E", glyph: "↻" },
    { id: "scale", label: "Scale", key: "R", glyph: "⤡" },
  ];

  return (
    <div ref={barRef} className="relative flex items-center gap-0.5">
      {modes.map((m) => (
        <ToolButton
          key={m.id}
          hint={`${m.label} (${m.key === "V" ? "W" : m.key})`}
          active={transformMode === m.id}
          onClick={() => setTransformMode(m.id)}
        >
          <span className="text-[14px] leading-none">{m.glyph}</span>
        </ToolButton>
      ))}

      <span className="mx-1.5 h-5 w-px bg-[var(--line)]" />

      <ToolButton hint="3D type (T)" onClick={() => addText()}>
        <span className="font-serif text-[16px] leading-none">T</span>
      </ToolButton>
      <ToolButton hint="Shape from SVG (S)" active={open === "shapes"} onClick={() => toggle("shapes")}>
        <span className="text-[13px] leading-none">&#9670;</span>
      </ToolButton>
      <ToolButton hint="3D object (O)" active={open === "objects"} onClick={() => toggle("objects")}>
        <span className="text-[13px] leading-none">&#11042;</span>
      </ToolButton>
      <ToolButton hint="Flat type locked to the frame (L)" onClick={() => addLabel()}>
        <span className="text-[12px] font-semibold leading-none">Aa</span>
      </ToolButton>
      <ToolButton hint="Image or video with effects (C)" active={open === "media"} onClick={() => toggle("media")}>
        <span className="text-[13px] leading-none">&#9636;</span>
      </ToolButton>

      {open && (
        <div ref={popover} className="absolute left-0 top-[38px] z-40">
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
            <div className="w-64 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--ink-dim)]">Shapes</span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded bg-[var(--raised)] px-2 py-1 text-[11px] text-[var(--ink)] transition hover:bg-[var(--accent)]"
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
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.name}
                    onClick={() => {
                      addShape(s.svg, s.name);
                      setOpen(null);
                    }}
                    className="flex aspect-square items-center justify-center rounded bg-[var(--field)] p-2 transition hover:bg-[var(--raised)]"
                  >
                    <span
                      className="h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:fill-[var(--ink-dim)]"
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

function ToolButton({
  children,
  hint,
  onClick,
  active,
}: {
  children: React.ReactNode;
  hint: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded transition ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--ink-dim)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
