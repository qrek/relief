"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { CAMERA_ID, useEditor, useSelectedObject, type PanelId } from "../store";
import { useRuntime } from "../runtime";
import { sceneClock } from "../lib/clock";
import { Viewport } from "./Viewport";
import { TopBar } from "./panels/TopBar";
import { ToolRail } from "./panels/ToolRail";
import { LayersPanel } from "./panels/LayersPanel";
import { ObjectPanel } from "./panels/ObjectPanel";
import { MaterialPanel } from "./panels/MaterialPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { StagingPanel } from "./panels/StagingPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { LookPanel } from "./panels/LookPanel";
import { Timeline } from "./panels/Timeline";
import { ALL_CAMERA_CHANNELS, ALL_TRANSFORM_CHANNELS } from "../lib/keyframes";

export default function Editor() {
  const activePanel = useEditor((s) => s.activePanel);
  const setActivePanel = useEditor((s) => s.setActivePanel);
  const timelineOpen = useEditor((s) => s.timelineOpen);
  const selected = useSelectedObject();

  useKeyboardShortcuts();
  useLayoutNudge();

  // The second tab is the selection's own treatment: a solid has a material, a
  // piece of media has effects. One slot, named for what is selected, so there
  // is never a dead tab and never a question of which one applies.
  const mediaSelected = selected?.kind === "cover";
  const treatment: PanelId = mediaSelected ? "effects" : "material";
  const tab: PanelId =
    activePanel === "material" || activePanel === "effects" ? treatment : activePanel;

  const panels: { id: PanelId; label: string; hint: string }[] = [
    { id: "object", label: "Object", hint: "What is selected (1)" },
    {
      id: treatment,
      label: mediaSelected ? "Effects" : "Material",
      hint: mediaSelected ? "Effects on this image or video (2)" : "Surface of the selected object (2)",
    },
    { id: "scene", label: "Scene", hint: "Light, environment and camera (3)" },
    { id: "look", label: "Look", hint: "Effects over the whole picture (4)" },
    { id: "export", label: "Export", hint: "Image, video and formats (5)" },
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-200 select-none">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Viewport />
            <div className="absolute left-3 top-3 w-56 rounded-lg border border-white/10 bg-neutral-900/90 backdrop-blur">
              <LayersPanel />
            </div>
          </div>
          {timelineOpen && <Timeline />}
        </div>
        <aside className="flex w-80 flex-col border-l border-white/5 bg-neutral-900">
          <nav className="flex border-b border-white/5">
            {panels.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={() => setActivePanel(p.id)}
                className={`flex-1 py-2.5 text-xs font-medium transition ${
                  tab === p.id
                    ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "object" && <ObjectPanel />}
            {tab === "material" && <MaterialPanel />}
            {tab === "effects" && <EffectsPanel />}
            {tab === "scene" && <StagingPanel />}
            {tab === "look" && <LookPanel />}
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
          else if (s.selectedLightId) s.selectLight(null);
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
        case "0":
          s.setViewMode(s.viewMode === "camera" ? "free" : "camera");
          break;
        case " ":
          e.preventDefault();
          sceneClock.toggle();
          break;
        case "k":
        case "K":
          if (s.selectedId === CAMERA_ID) s.toggleKeys({ kind: "camera", channels: ALL_CAMERA_CHANNELS }, sceneClock.clipTime);
          else if (s.selectedId) s.toggleKeys({ kind: "object", id: s.selectedId, channels: ALL_TRANSFORM_CHANNELS }, sceneClock.clipTime);
          break;
        case "1":
          s.setActivePanel("object");
          break;
        case "2":
          s.setActivePanel("material");
          break;
        case "3":
          s.setActivePanel("scene");
          break;
        case "4":
          s.setActivePanel("look");
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
