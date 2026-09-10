"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useEditor, type PanelId } from "../store";
import { useRuntime } from "../runtime";
import { Viewport } from "./Viewport";
import { TopBar } from "./panels/TopBar";
import { LayersPanel } from "./panels/LayersPanel";
import { ObjectPanel } from "./panels/ObjectPanel";
import { MaterialPanel } from "./panels/MaterialPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { StagingPanel } from "./panels/StagingPanel";
import { ExportPanel } from "./panels/ExportPanel";

const PANELS: { id: PanelId; label: string }[] = [
  { id: "object", label: "Design" },
  { id: "staging", label: "Scene" },
  { id: "export", label: "Export" },
];

export default function Editor() {
  const activePanel = useEditor((s) => s.activePanel);
  const setActivePanel = useEditor((s) => s.setActivePanel);
  const selectedId = useEditor((s) => s.selectedId);

  useKeyboardShortcuts();
  useLayoutNudge();

  // Material and effects are no longer tabs of their own: they are sections of
  // the design column, so anything still pointing at them lands there.
  const tab: PanelId = activePanel === "material" || activePanel === "effects" ? "object" : activePanel;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--field)] text-[var(--ink)] select-none">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--panel)]">
          <LayersPanel />
        </aside>

        <div className="relative min-w-0 flex-1">
          <Viewport />
        </div>

        <aside className="flex w-60 shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel)]">
          <nav className="flex shrink-0 gap-0.5 border-b border-[var(--line)] px-2 py-1.5">
            {PANELS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePanel(p.id)}
                className={`flex-1 rounded py-1 text-[11.5px] font-medium transition ${
                  tab === p.id
                    ? "bg-[var(--raised)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "object" && (
              <>
                <ObjectPanel />
                {selectedId && <MaterialPanel />}
                {selectedId && <EffectsPanel />}
              </>
            )}
            {tab === "staging" && <StagingPanel />}
            {tab === "export" && <ExportPanel />}
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

/** Frames the selection: swings the camera in until the object fills the shot. */
function frameSelection() {
  const { camera, objects } = useRuntime.getState();
  const { selectedId, setCamera, setStaging } = useEditor.getState();
  const target = selectedId ? objects[selectedId] : undefined;
  if (!camera || !target) return;

  const box = new THREE.Box3().setFromObject(target);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.3, box.getSize(new THREE.Vector3()).length() * 0.5);
  const distance = (radius * 1.9) / Math.tan((camera.fov * Math.PI) / 360);
  const direction = camera.position.clone().sub(centre).normalize();
  const position = centre.clone().addScaledVector(direction, distance);

  setCamera(position.toArray() as [number, number, number], centre.toArray() as [number, number, number]);
  setStaging({ focusDistance: distance }, false);
  useRuntime.getState().requestCameraReset();
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
          // Close whatever is open, outermost first, then drop the selection.
          if (useRuntime.getState().focusPicking) useRuntime.getState().setFocusPicking(false);
          else if (s.library) s.setLibrary(null);
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
        case "f":
        case "F":
          // Shift frames the selection; on its own it arms a focus pull.
          if (e.shiftKey) frameSelection();
          else useRuntime.getState().setFocusPicking(!useRuntime.getState().focusPicking);
          break;
        case "1":
          s.setActivePanel("object");
          break;
        case "2":
          s.setActivePanel("staging");
          break;
        case "3":
          s.setActivePanel("export");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
