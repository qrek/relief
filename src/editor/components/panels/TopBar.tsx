"use client";

import { useRef, useState } from "react";
import { useEditor } from "../../store";
import type { Project } from "../../types";
import { Button } from "../ui";
import { SceneLibrary } from "./SceneLibrary";

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
    <header className="relative flex h-12 items-center gap-3 border-b border-white/5 bg-neutral-900 px-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent)] text-[11px] font-bold text-[var(--accent-ink)]">R</span>
        <span className="text-sm font-semibold tracking-tight text-neutral-100">Relief</span>
      </div>
      <div className="mx-2 h-5 w-px bg-white/10" />
      <input
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        className="w-48 rounded bg-transparent px-2 py-1 text-sm text-neutral-200 outline-none hover:bg-white/5 focus:bg-white/5"
      />
      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </Button>
        <Button variant="ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </Button>
      </div>
      <div className="flex-1" />
      <Button variant="ghost" onClick={() => setHelpOpen((v) => !v)} title="Keyboard shortcuts">
        ?
      </Button>
      <Button variant="default" onClick={() => setScenesOpen(true)} title="Your saved scenes">
        Scenes
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          if (confirm("Start a new project? The current one stays in your browser history only until replaced.")) newProject();
        }}
      >
        New
      </Button>
      <Button variant="ghost" onClick={() => fileRef.current?.click()}>
        Open
      </Button>
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
      <Button variant="ghost" onClick={exportJson}>
        Save file
      </Button>
      <Button variant="primary" onClick={() => setActivePanel("export")}>
        Export
      </Button>

      {scenesOpen && <SceneLibrary onClose={() => setScenesOpen(false)} />}

      {helpOpen && (
        <div className="absolute right-3 top-12 z-30 w-72 rounded-lg border border-white/10 bg-neutral-900 p-3 text-xs text-neutral-300 shadow-2xl">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Shortcuts</div>
          <ul className="grid grid-cols-[1fr_auto] gap-y-1">
            {[
              ["Move / Rotate / Scale", "W / E / R"],
              ["Add 3D text / shapes / objects / cover / flat type", "T / S / O / C / L"],
              ["Pull focus onto a point", "F"],
              ["Frame the selection", "Shift + F"],
              ["Pick one layer of an object", "Shift + click"],
              ["Delete selection", "Del"],
              ["Duplicate", "Ctrl + D"],
              ["Deselect", "Esc"],
              ["Undo / Redo", "Ctrl + Z / Ctrl + Shift + Z"],
              ["Export image", "Ctrl + E"],
              ["Panels: object, material or effects, scene, look, export", "1 to 5"],
            ].map(([k, v]) => (
              <li key={k} className="contents">
                <span>{k}</span>
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200">{v}</kbd>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-neutral-500">
            Your project is saved automatically in this browser. Use Save file to keep a copy.
          </p>
        </div>
      )}
    </header>
  );
}
