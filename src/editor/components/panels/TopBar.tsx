"use client";

import { useRef, useState } from "react";
import { useEditor } from "../../store";
import type { Project } from "../../types";
import { SceneLibrary } from "./SceneLibrary";
import { Toolbar } from "./Toolbar";

export function TopBar() {
  const project = useEditor((s) => s.project);
  const renameProject = useEditor((s) => s.renameProject);
  const newProject = useEditor((s) => s.newProject);
  const loadProject = useEditor((s) => s.loadProject);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const setActivePanel = useEditor((s) => s.setActivePanel);
  const fileRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/[^\w-]+/g, "_") || "project"}.relief.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-2">
      <span className="grid h-8 w-8 place-items-center rounded bg-[var(--accent)] text-[12px] font-bold text-white">
        R
      </span>

      <span className="mx-1 h-5 w-px bg-[var(--line)]" />

      <Toolbar />

      <div className="flex flex-1 items-center justify-center gap-1">
        <BarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          &#8624;
        </BarButton>
        <BarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          &#8625;
        </BarButton>
        <input
          value={project.name}
          onChange={(e) => renameProject(e.target.value)}
          spellCheck={false}
          className="w-56 rounded bg-transparent px-2 py-1 text-center text-[12px] text-[var(--ink)] outline-none transition hover:bg-[var(--raised)] focus:bg-[var(--raised)]"
        />
      </div>

      <BarButton onClick={() => setScenesOpen(true)} title="Scenes you have saved">
        Scenes
      </BarButton>
      <BarButton
        onClick={() => {
          if (confirm("Start a new project? The current one stays in your browser history only until replaced.")) {
            newProject();
          }
        }}
      >
        New
      </BarButton>
      <BarButton onClick={() => fileRef.current?.click()}>Open</BarButton>
      <BarButton onClick={exportJson}>Save file</BarButton>
      <BarButton onClick={() => setHelpOpen((v) => !v)} title="Keyboard shortcuts" active={helpOpen}>
        ?
      </BarButton>
      <button
        type="button"
        onClick={() => setActivePanel("export")}
        className="ml-1 rounded bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[var(--accent-press)]"
      >
        Export
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text()) as Project;
            if (!Array.isArray(data.objects) || !data.staging) throw new Error("Not a project file");
            loadProject(data);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Could not open file");
          }
          e.target.value = "";
        }}
      />

      {scenesOpen && <SceneLibrary onClose={() => setScenesOpen(false)} />}

      {helpOpen && (
        <div className="absolute right-2 top-12 z-40 w-80 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3.5 text-[11.5px] text-[var(--ink-dim)] shadow-2xl">
          <div className="mb-2.5 text-[11px] font-medium text-[var(--ink)]">Shortcuts</div>
          <ul className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
            {[
              ["Move / Rotate / Scale", "W / E / R"],
              ["Add 3D type, shape, object, cover, flat type", "T / S / O / C / L"],
              ["Pull focus onto a point", "F"],
              ["Frame the selection", "Shift + F"],
              ["Pick one layer of an object", "Shift + click"],
              ["Delete / Duplicate", "Del / Ctrl + D"],
              ["Deselect, or close what is open", "Esc"],
              ["Undo / Redo", "Ctrl + Z / Ctrl + Shift + Z"],
              ["Panels: object, material, effects, scene, export", "1 to 5"],
              ["Export", "Ctrl + E"],
            ].map(([k, v]) => (
              <li key={k} className="contents">
                <span>{k}</span>
                <kbd className="rounded bg-[var(--raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink)]">
                  {v}
                </kbd>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-faint)]">
            The project is saved in this browser as you work. Save file keeps a copy you can carry.
          </p>
        </div>
      )}
    </header>
  );
}

function BarButton({
  children,
  onClick,
  disabled,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2 py-1.5 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-[var(--raised)] text-[var(--ink)]"
          : "text-[var(--ink-dim)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
