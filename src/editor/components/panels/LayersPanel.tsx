"use client";

import { useEditor } from "../../store";
import { useRuntime } from "../../runtime";

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
        <h3 className="text-[11.5px] font-medium text-[var(--ink)]">Layers</h3>
        <span className="text-[11px] text-[var(--ink-faint)]">{objects.length}</span>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1.5">
        {[...objects].reverse().map((o, idx) => {
          const active = o.id === selectedId;
          const parts = partsById[o.id] ?? [];
          const icon = o.kind === "text" ? "T" : o.kind === "shape" ? "◆" : "⬢";
          return (
            <li key={o.id}>
              <div
                onClick={() => select(o.id)}
                className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11.5px] ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--ink-dim)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"
                }`}
              >
                <span className={`w-4 text-center text-[10px] ${active ? "text-white/70" : "text-[var(--ink-faint)]"}`}>
                  {icon}
                </span>
                <span
                  className={`flex-1 truncate ${o.visible ? "" : "line-through opacity-50"} ${
                    o.locked ? "opacity-60" : ""
                  }`}
                >
                  {o.name}
                </span>
                {o.locked && <span className="text-[10px] text-neutral-500">freeze</span>}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <IconButton title="Move up" disabled={idx === 0} onClick={() => moveObject(o.id, 1)}>
                    ↑
                  </IconButton>
                  <IconButton title="Move down" disabled={idx === objects.length - 1} onClick={() => moveObject(o.id, -1)}>
                    ↓
                  </IconButton>
                  <IconButton title={o.locked ? "Unfreeze" : "Freeze"} onClick={() => toggleLock(o.id)}>
                    {o.locked ? "🔒" : "🔓"}
                  </IconButton>
                  <IconButton
                    title={o.visible ? "Hide" : "Show"}
                    onClick={() => updateObject(o.id, { visible: !o.visible }, false)}
                  >
                    {o.visible ? "●" : "○"}
                  </IconButton>
                  <IconButton title="Delete" onClick={() => removeObject(o.id)}>
                    ×
                  </IconButton>
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
                        selectedPartId === p.id ? "bg-white/15 text-white" : "text-neutral-400 hover:bg-white/5"
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="h-5 w-5 rounded text-[11px] leading-none text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
