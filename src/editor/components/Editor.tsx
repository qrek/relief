"use client";

import { useEffect } from "react";
import { useEditor, type PanelId } from "../store";
import { useRuntime } from "../runtime";
import { Viewport } from "./Viewport";
import { TopBar } from "./panels/TopBar";
import { ToolRail } from "./panels/ToolRail";
import { LayersPanel } from "./panels/LayersPanel";
import { ObjectPanel } from "./panels/ObjectPanel";
import { MaterialPanel } from "./panels/MaterialPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { StagingPanel } from "./panels/StagingPanel";
import { ExportPanel } from "./panels/ExportPanel";

const PANELS: { id: PanelId; label: string }[] = [
  { id: "object", label: "Object" },
  { id: "material", label: "Material" },
  { id: "effects", label: "Effects" },
  { id: "staging", label: "Staging" },
  { id: "export", label: "Export" },
];

export default function Editor() {
  const activePanel = useEditor((s) => s.activePanel);
  const setActivePanel = useEditor((s) => s.setActivePanel);

  useKeyboardShortcuts();
  useLayoutNudge();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-200 select-none">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <div className="relative min-w-0 flex-1">
          <Viewport />
          <div className="absolute left-3 top-3 w-56 rounded-lg border border-white/10 bg-neutral-900/90 backdrop-blur">
            <LayersPanel />
          </div>
        </div>
        <aside className="flex w-80 flex-col border-l border-white/5 bg-neutral-900">
          <nav className="flex border-b border-white/5">
            {PANELS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePanel(p.id)}
                className={`flex-1 py-2.5 text-xs font-medium transition ${
                  activePanel === p.id
                    ? "border-b-2 border-white text-white"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activePanel === "object" && <ObjectPanel />}
            {activePanel === "material" && <MaterialPanel />}
            {activePanel === "effects" && <EffectsPanel />}
            {activePanel === "staging" && <StagingPanel />}
            {activePanel === "export" && <ExportPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Some embedded browsers do not deliver the first ResizeObserver callback after
 * the initial paint, which leaves the WebGL canvas un-measured and blank. One
 * resize event on the next frames makes first paint deterministic everywhere.
 */
function useLayoutNudge() {
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      if (useRuntime.getState().gl || tries++ > 12) {
        clearInterval(timer);
        return;
      }
      window.dispatchEvent(new Event("resize"));
    }, 200);
    return () => clearInterval(timer);
  }, []);
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        s.setActivePanel("export");
        return;
      }
      if (typing) return;

      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (s.selectedId) s.duplicateObject(s.selectedId);
        return;
      }
      if (mod) return;

      switch (e.key) {
        case "Delete":
        case "Backspace":
          if (s.selectedId) s.removeObject(s.selectedId);
          break;
        case "Escape":
          // Close the add-object popover first, then drop the selection.
          if (s.library) s.setLibrary(null);
          else if (s.selectedPartId) s.selectPart(null);
          else s.select(null);
          break;
        case "s":
        case "S":
          s.setLibrary(s.library === "shapes" ? null : "shapes");
          break;
        case "o":
        case "O":
          s.setLibrary(s.library === "objects" ? null : "objects");
          break;
        case "w":
        case "W":
          s.setTransformMode("translate");
          break;
        case "e":
        case "E":
          s.setTransformMode("rotate");
          break;
        case "r":
        case "R":
          s.setTransformMode("scale");
          break;
        case "t":
        case "T":
          s.addText();
          break;
        case "l":
        case "L":
          s.addLabel();
          break;
        case "c":
        case "C":
          s.setLibrary(s.library === "media" ? null : "media");
          break;
        case "1":
          s.setActivePanel("object");
          break;
        case "2":
          s.setActivePanel("material");
          break;
        case "3":
          s.setActivePanel("effects");
          break;
        case "4":
          s.setActivePanel("staging");
          break;
        case "5":
          s.setActivePanel("export");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
