"use client";

import { useEffect, useState } from "react";
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
import { importDroppedFiles } from "../lib/importers";
import { CARD, GAP, LEFT_INSET, RAIL_WIDTH, RIGHT_INSET } from "./layout";
import { IconButton } from "./ui";
import { PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

export default function Editor() {
  const activePanel = useEditor((s) => s.activePanel);
  const setActivePanel = useEditor((s) => s.setActivePanel);
  const timelineOpen = useEditor((s) => s.timelineOpen);
  const folded = useEditor((s) => s.folded);
  const toggleFolded = useEditor((s) => s.toggleFolded);
  const selected = useSelectedObject();

  useKeyboardShortcuts();
  useLayoutNudge();
  const drop = useFileDrop();

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
      <div className="relative min-h-0 flex-1" {...drop.handlers}>
        <div className="absolute inset-0 flex flex-col">
          <div className="relative min-h-0 flex-1">
            <Viewport />
            {drop.over && (
              <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--accent)] bg-black/50 text-sm text-neutral-100">
                Drop to import: models, images, videos, HDRI maps, fonts
              </div>
            )}
            {drop.notice && (
              <div
                className={`pointer-events-none absolute bottom-14 left-1/2 z-30 max-w-[70%] -translate-x-1/2 rounded-lg px-3 py-2 text-xs shadow-xl ring-1 ${
                  drop.notice.error ? "bg-red-950/95 text-red-200 ring-red-500/40" : "bg-neutral-900/95 text-neutral-200 ring-white/10"
                }`}
              >
                {drop.notice.text}
              </div>
            )}
          </div>
          {timelineOpen && (
            <div className="shrink-0" style={{ paddingLeft: LEFT_INSET, paddingRight: RIGHT_INSET, paddingBottom: GAP }}>
              <Timeline />
            </div>
          )}
        </div>
        <div className="absolute z-20" style={{ left: GAP, top: GAP }}>
          {folded.rail ? (
            <div className={`p-1 ${CARD}`}>
              <IconButton icon={PanelLeftOpen} size="md" title="Show the tools" onClick={() => toggleFolded("rail")} />
            </div>
          ) : (
            <ToolRail />
          )}
        </div>
        {!folded.layers ? (
          <div className={`absolute z-20 w-56 ${CARD}`} style={{ left: GAP + RAIL_WIDTH + GAP, top: GAP }}>
            <LayersPanel />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggleFolded("layers")}
            title="Show the layers"
            className={`absolute z-20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-200 ${CARD}`}
            style={{ left: GAP + RAIL_WIDTH + GAP, top: GAP }}
          >
            Layers
          </button>
        )}
        {folded.panel && (
          <div className={`absolute z-20 p-1 ${CARD}`} style={{ right: GAP, top: GAP }}>
            <IconButton icon={PanelRightOpen} size="md" title="Show the panel (Tab shows everything)" onClick={() => toggleFolded("panel")} />
          </div>
        )}
        <aside
          className={`absolute z-20 flex w-80 flex-col overflow-hidden ${CARD}`}
          style={{ right: GAP, top: GAP, bottom: GAP, display: folded.panel ? "none" : undefined }}
        >
          <nav className="flex items-stretch border-b border-white/5">
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
            <div className="flex items-center pr-1">
              <IconButton icon={PanelRightClose} title="Fold the panel away (Tab folds everything)" onClick={() => toggleFolded("panel")} />
            </div>
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

/**
 * Files dropped anywhere on the viewport column are imported for what they
 * are. The dashed frame says a drop is welcome; a notice says what happened.
 */
function useFileDrop() {
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), notice.error ? 8000 : 4000);
    return () => clearTimeout(id);
  }, [notice]);

  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!over) setOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      // Leaving a child fires too; only leaving the column itself counts.
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setOver(false);
    },
    onDrop: async (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      setNotice({ text: files.length === 1 ? `Importing ${files[0].name}` : `Importing ${files.length} files`, error: false });
      const report = await importDroppedFiles(files);
      const parts: string[] = [];
      if (report.added.length) parts.push(`Added ${report.added.join(", ")}.`);
      parts.push(...report.errors);
      setNotice({ text: parts.join(" "), error: report.errors.length > 0 });
    },
  };
  return { over, notice, handlers };
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
        case "Tab":
          e.preventDefault();
          s.toggleAllFolded();
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
