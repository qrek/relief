"use client";

import { useRef, useState } from "react";
import { useEditor } from "../../store";
import type { Project } from "../../types";
import { Button, IconButton } from "../ui";
import { CircleHelp, FilePlus2, FolderOpen, LayoutGrid, Redo2, Save, Undo2 } from "lucide-react";
import { SceneLibrary } from "./SceneLibrary";
import { downloadBlob } from "../../lib/export";
import { ReliefMark } from "../Logo";
import { AccountMenu } from "./AccountMenu";

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
    downloadBlob(blob, `${project.name.replace(/[^\w-]+/g, "_") || "project"}.relief.json`);
  };

  return (
    <header className="relative flex h-12 items-center gap-3 border-b border-white/5 bg-neutral-900 px-3">
      <div className="flex items-center gap-2">
        <ReliefMark size={22} />
        <span className="text-sm font-semibold tracking-tight text-neutral-100">Relief</span>
      </div>
      <div className="mx-2 h-5 w-px bg-white/10" />
      <input
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        className="w-48 rounded bg-transparent px-2 py-1 text-sm text-neutral-200 outline-none hover:bg-white/5 focus:bg-white/5"
      />
      <div className="flex items-center gap-0.5">
        <IconButton icon={Undo2} size="md" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
        <IconButton icon={Redo2} size="md" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" />
      </div>
      <div className="flex-1" />
      <AccountMenu />
      <Button variant="default" onClick={() => setScenesOpen(true)} title="Templates, your saved scenes and your cloud projects" className="flex items-center gap-1.5">
        <LayoutGrid size={13} strokeWidth={1.75} />
        Scenes
      </Button>
      <div className="mx-1 flex items-center gap-0.5">
        <IconButton
          icon={FilePlus2}
          size="md"
          title="New project"
          onClick={() => {
            if (confirm("Start a new project? The current one stays in your browser history only until replaced.")) newProject();
          }}
        />
        <IconButton icon={FolderOpen} size="md" title="Open a project file" onClick={() => fileRef.current?.click()} />
        <IconButton icon={Save} size="md" title="Save the project to a file" onClick={exportJson} />
        <IconButton icon={CircleHelp} size="md" title="Keyboard shortcuts" active={helpOpen} onClick={() => setHelpOpen((v) => !v)} />
      </div>
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
              ["Camera view on / off", "0"],
              ["Play / pause the clip", "Space"],
              ["Key the selection's whole transform", "K"],
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
