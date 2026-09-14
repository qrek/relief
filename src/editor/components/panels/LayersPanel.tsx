"use client";

import { CAMERA_ID, useEditor } from "../../store";
import { useRuntime } from "../../runtime";
import { IconButton } from "../ui";
import { ALargeSmall, Box, ChevronDown, ChevronUp, Eye, EyeOff, Image as ImageIcon, Lightbulb, Lock, LockOpen, Shapes, Sun, Type, Video, X } from "lucide-react";

const KIND_ICON = { text: Type, shape: Shapes, model: Box, cover: ImageIcon, label: ALargeSmall } as const;

export function LayersPanel() {
  const objects = useEditor((s) => s.project.objects);
  const selectedId = useEditor((s) => s.selectedId);
  const selectedPartId = useEditor((s) => s.selectedPartId);
  const select = useEditor((s) => s.select);
  const selectPart = useEditor((s) => s.selectPart);
  const updateObject = useEditor((s) => s.updateObject);
  const removeObject = useEditor((s) => s.removeObject);
  const moveObject = useEditor((s) => s.moveObject);
  const toggleLock = useEditor((s) => s.toggleLock);
  const partsById = useRuntime((s) => s.parts);
  const toggleFolded = useEditor((s) => s.toggleFolded);
  const lights = useEditor((s) => s.project.staging.lights);
  const selectedLightId = useEditor((s) => s.selectedLightId);
  const selectLight = useEditor((s) => s.selectLight);
  const setLight = useEditor((s) => s.setLight);
  const removeLight = useEditor((s) => s.removeLight);

  return (
    <div className="flex max-h-[52vh] flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Layers</h3>
        <span className="flex items-center gap-1 text-[11px] text-neutral-600">
          {objects.length}
          <IconButton icon={ChevronUp} title="Fold the layers away" onClick={() => toggleFolded("layers")} />
        </span>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-2">
        <li>
          <div
            onClick={() => select(CAMERA_ID)}
            title="The camera: place it, aim it, key it"
            className={`mb-1 flex cursor-pointer items-center gap-2 rounded-md border-b border-white/5 px-2 py-1.5 pb-2 text-xs ${
              selectedId === CAMERA_ID ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-neutral-300 hover:bg-white/5"
            }`}
          >
            <Video size={13} strokeWidth={1.75} className={`shrink-0 ${selectedId === CAMERA_ID ? "text-[var(--accent)]" : "text-neutral-500"}`} />
            <span className="flex-1 truncate">Camera</span>
          </div>
        </li>
        {lights.map((light) => {
          const active = light.id === selectedLightId;
          const Icon = light.type === "sun" ? Sun : Lightbulb;
          return (
            <li key={light.id}>
              <div
                onClick={() => selectLight(light.id)}
                className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-neutral-300 hover:bg-white/5"
                }`}
              >
                <Icon size={13} strokeWidth={1.75} className={`shrink-0 ${active ? "text-[var(--accent)]" : "text-neutral-500"}`} />
                <span className={`flex-1 truncate ${light.enabled ? "" : "line-through opacity-50"}`}>{light.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <IconButton icon={light.enabled ? Eye : EyeOff} title={light.enabled ? "Switch off" : "Switch on"} onClick={() => setLight(light.id, { enabled: !light.enabled }, false)} />
                  <IconButton icon={X} title="Delete" danger onClick={() => removeLight(light.id)} />
                </div>
              </div>
            </li>
          );
        })}
        {[...objects].reverse().map((o, idx) => {
          const active = o.id === selectedId;
          const parts = partsById[o.id] ?? [];
          const Icon = KIND_ICON[o.kind];
          return (
            <li key={o.id}>
              <div
                onClick={() => select(o.id)}
                className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-neutral-300 hover:bg-white/5"
                }`}
              >
                <Icon size={13} strokeWidth={1.75} className={`shrink-0 ${active ? "text-[var(--accent)]" : "text-neutral-500"}`} />
                <span
                  className={`flex-1 truncate ${o.visible ? "" : "line-through opacity-50"} ${
                    o.locked ? "opacity-60" : ""
                  }`}
                >
                  {o.name}
                </span>
                {o.locked && <span className="text-[10px] text-neutral-500">freeze</span>}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <IconButton icon={ChevronUp} title="Move up" disabled={idx === 0} onClick={() => moveObject(o.id, 1)} />
                  <IconButton icon={ChevronDown} title="Move down" disabled={idx === objects.length - 1} onClick={() => moveObject(o.id, -1)} />
                  <IconButton icon={o.locked ? Lock : LockOpen} title={o.locked ? "Unfreeze" : "Freeze"} onClick={() => toggleLock(o.id)} />
                  <IconButton icon={o.visible ? Eye : EyeOff} title={o.visible ? "Hide" : "Show"} onClick={() => updateObject(o.id, { visible: !o.visible }, false)} />
                  <IconButton icon={X} title="Delete" danger onClick={() => removeObject(o.id)} />
                </div>
              </div>

              {active && parts.length > 1 && (
                <ul className="mb-1 ml-6 flex flex-col border-l border-white/10 pl-1.5">
                  {parts.map((p) => (
                    <li
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectPart(selectedPartId === p.id ? null : p.id);
                      }}
                      className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11px] ${
                        selectedPartId === p.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-neutral-400 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {o.parts[p.id] && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {objects.length === 0 && <li className="px-2 py-2 text-[11px] text-neutral-600">Empty scene.</li>}
      </ul>
    </div>
  );
}
