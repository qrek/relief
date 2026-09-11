"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { currentFormat, useEditor, type Quality } from "../store";
import { useRuntime } from "../runtime";
import type { Motion, PartInfo, SceneObject, Staging } from "../types";
import { DepthOfFieldPass, focalToFov } from "../lib/postFx";
import { LookPass, lookIsActive } from "../lib/look";
import { SceneEnvironment, SceneLights } from "./Lights";
import { drawHelpersOnTop, hideEditorHelpers } from "../lib/export";
import { sceneClock } from "../lib/clock";
import { applyMotion } from "../presets/motion";
import { TextMesh } from "./objects/TextMesh";
import { ShapeMesh } from "./objects/ShapeMesh";
import { ModelMesh } from "./objects/ModelMesh";
import { CoverMesh } from "./objects/CoverMesh";
import { LabelMesh } from "./objects/LabelMesh";
import { ObjectBoundary } from "./objects/ObjectBoundary";
import { CANVAS_FORMATS, FORMAT_GROUPS, safeAreaFor } from "../presets/scene";
import { renderImage } from "../lib/export";
import { OBJECT_PRESETS, defaultParams } from "../presets/objects";
import { thumbnailFor } from "../lib/thumbnails";
import { EFFECTS } from "../presets/effects";
import { renderVideo } from "../lib/video";
import { exportImageSet, exportVideoSet, frameForAspect, zipFiles } from "../lib/batch";

/**
 * How many device pixels a frame may cost. Draft renders below the screen's own
 * resolution, which is the largest saving available and costs nothing that
 * matters while a shot is still being blocked out.
 */
const DPR_FOR_QUALITY: Record<Quality, [number, number]> = {
  draft: [0.6, 1],
  balanced: [1, 1.5],
  fine: [1, 2],
};

/** Sizes the canvas to the active format's aspect ratio inside the available area. */
export function Viewport() {
  const project = useEditor((s) => s.project);
  const format = currentFormat(project);
  const quality = useEditor((s) => s.quality);
  const outer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const pad = 32;
    const measure = () => {
      const aw = el.clientWidth - pad * 2;
      const ah = el.clientHeight - pad * 2;
      const aspect = format.width / format.height;
      let w = aw;
      let h = w / aspect;
      if (h > ah) {
        h = ah;
        w = h * aspect;
      }
      const next = { w: Math.max(0, Math.floor(w)), h: Math.max(0, Math.floor(h)) };
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    // ResizeObserver alone can miss the first useful layout when the pane starts
    // collapsed, so the frame callback and window resize act as backstops.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [format.width, format.height]);

  const transparent = project.staging.transparent && !project.staging.envAsBackground;

  return (
    <div ref={outer} className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-950">
      <div
        className="relative shadow-2xl shadow-black/60 ring-1 ring-white/10"
        style={{
          // Falls back to filling the area until the first measurement lands, so the
          // renderer always starts even if layout reports zero on the first frame.
          width: size.w || "100%",
          height: size.h || "100%",
          backgroundImage: transparent
            ? "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)"
            : undefined,
          backgroundSize: transparent ? "20px 20px" : undefined,
          backgroundPosition: transparent ? "0 0,0 10px,10px -10px,-10px 0" : undefined,
          backgroundColor: transparent ? "#1c1c1c" : undefined,
        }}
      >
        <SafeAreaOverlay />
        <FocusPickerHint />
        <Canvas
          // Percentage-closer shadows honour each light's blur radius; the
          // "soft" variant ignores it, so softness would have no effect.
          shadows="percentage"
          dpr={DPR_FOR_QUALITY[quality]}
          // The drawing buffer is kept so video export can read frames back after awaiting the encoder.
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{ fov: project.staging.fov, position: project.camera.position, near: 0.1, far: 200 }}
          onPointerMissed={() => {
            if (useRuntime.getState().focusPicking) {
              useRuntime.getState().setFocusPicking(false);
              return;
            }
            useEditor.getState().select(null);
          }}
        >
          <SceneContent />
        </Canvas>
      </div>
      <FormatBadge />
    </div>
  );
}

/** Tells the user the next click sets focus, and gives them a way out. */
function FocusPickerHint() {
  const picking = useRuntime((r) => r.focusPicking);
  const setFocusPicking = useRuntime((r) => r.setFocusPicking);
  if (!picking) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 cursor-crosshair">
      <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-neutral-900 shadow">
        Click a point to pull focus there
        <button className="ml-2 text-neutral-500 hover:text-neutral-900" onClick={() => setFocusPicking(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Draft, Balanced or Fine: how much a viewport frame is allowed to cost. */
function QualityPicker() {
  const quality = useEditor((s) => s.quality);
  const setQuality = useEditor((s) => s.setQuality);
  const hints: Record<Quality, string> = {
    draft: "Fewer pixels, and no blur while you move. For a laptop on battery.",
    balanced: "Full pixels, and the blur settles as soon as you let go.",
    fine: "Everything, all the time. For judging an image before export.",
  };
  return (
    <div className="flex items-center gap-0.5">
      {(["draft", "balanced", "fine"] as Quality[]).map((q) => (
        <button
          key={q}
          type="button"
          title={hints[q]}
          onClick={() => setQuality(q)}
          className={`rounded-full px-2 py-0.5 text-[11px] capitalize transition ${
            quality === q ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-neutral-400 hover:bg-white/10"
          }`}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function FormatBadge() {
  const project = useEditor((s) => s.project);
  const setFormat = useEditor((s) => s.setFormat);
  const safeAreas = useEditor((s) => s.safeAreas);
  const setSafeAreas = useEditor((s) => s.setSafeAreas);
  const f = currentFormat(project);
  const hasSafe = safeAreaFor(project.formatId) !== null;
  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-neutral-900/90 px-3 py-1.5 text-xs text-neutral-300 ring-1 ring-white/10 backdrop-blur">
      <select
        value={project.formatId}
        onChange={(e) => setFormat(e.target.value)}
        className="max-w-[150px] bg-transparent outline-none"
      >
        {FORMAT_GROUPS.map((group) => (
          <optgroup key={group} label={group} className="bg-neutral-900">
            {CANVAS_FORMATS.filter((x) => x.group === group).map((x) => (
              <option key={x.id} value={x.id} className="bg-neutral-900">
                {x.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="text-neutral-500">
        {f.width} × {f.height}
      </span>
      <span className="h-3 w-px bg-white/10" />
      <QualityPicker />
      {hasSafe && (
        <button
          type="button"
          onClick={() => setSafeAreas(!safeAreas)}
          title="Show the margins the platform's own interface covers"
          className={`rounded-full px-2 py-0.5 text-[11px] transition ${
            safeAreas ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-neutral-400 hover:bg-white/20"
          }`}
        >
          Safe
        </button>
      )}
    </div>
  );
}

/**
 * Draws the margins covered by captions, profile chrome and buttons on the
 * platform this format targets. Purely a guide, never exported.
 */
function SafeAreaOverlay() {
  const formatId = useEditor((s) => s.project.formatId);
  const enabled = useEditor((s) => s.safeAreas);
  const area = safeAreaFor(formatId);
  if (!enabled || !area) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute border border-dashed border-white/40"
        style={{
          top: `${area.top * 100}%`,
          bottom: `${area.bottom * 100}%`,
          left: `${area.left * 100}%`,
          right: `${area.right * 100}%`,
        }}
      />
      {(
        [
          { top: 0, left: 0, right: 0, height: `${area.top * 100}%` },
          { bottom: 0, left: 0, right: 0, height: `${area.bottom * 100}%` },
          { top: `${area.top * 100}%`, bottom: `${area.bottom * 100}%`, left: 0, width: `${area.left * 100}%` },
          { top: `${area.top * 100}%`, bottom: `${area.bottom * 100}%`, right: 0, width: `${area.right * 100}%` },
        ] as React.CSSProperties[]
      ).map((style, i) => (
        <div key={i} className="absolute bg-black/35" style={style} />
      ))}
    </div>
  );
}

function SceneContent() {
  const objects = useEditor((s) => s.project.objects);
  const staging = useEditor((s) => s.project.staging);
  const selectedId = useEditor((s) => s.selectedId);
  const transformMode = useEditor((s) => s.transformMode);
  const setTransform = useEditor((s) => s.setTransform);
  const setCamera = useEditor((s) => s.setCamera);
  const cameraState = useEditor((s) => s.project.camera);
  const selectedLocked = useEditor(
    (s) => s.project.objects.find((o) => o.id === s.selectedId)?.locked ?? false,
  );
  const selectedObj3D = useRuntime((s) => (selectedId ? s.objects[selectedId] : undefined));
  const resetSignal = useRuntime((s) => s.resetCameraSignal);

  const { gl, scene, camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    useRuntime.getState().setRenderer(gl, scene, camera as THREE.PerspectiveCamera);
    if (process.env.NODE_ENV !== "production") {
      // Debug handle for the browser console.
      (window as unknown as { __endless?: unknown }).__endless = {
        runtime: useRuntime,
        editor: useEditor,
        renderImage,
        presets: OBJECT_PRESETS,
        defaultParams,
        thumbnailFor,
        effects: EFFECTS,
        renderVideo,
        sceneClock,
        dofPass: DepthOfFieldPass,
        batch: { exportImageSet, exportVideoSet, zipFiles, frameForAspect },
      };
    }
  }, [gl, scene, camera]);

  useEffect(() => {
    const cam = useRuntime.getState().camera;
    if (!cam) return;
    // Focal length is the control the designer sees; the field of view follows it.
    cam.fov = focalToFov(staging.focalLength);
    cam.updateProjectionMatrix();
  }, [staging.focalLength]);

  // Restore or reset the camera.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    camera.position.set(...cameraState.position);
    c.target.set(...cameraState.target);
    c.update();
    // Only run when the reset signal changes or on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  return (
    <>
      <ClockDriver />
      <SceneRenderer staging={staging} />
      {!staging.transparent && !staging.envAsBackground && (
        <color attach="background" args={[staging.background]} />
      )}
      <Suspense fallback={null}>
        <SceneEnvironment staging={staging} />
      </Suspense>
      <SceneLights staging={staging} />
      {staging.shadows && (
        <ContactShadows
          position={[0, staging.floorY, 0]}
          opacity={staging.shadowOpacity}
          blur={staging.shadowBlur}
          scale={20}
          far={6}
          resolution={1024}
          frames={Infinity}
        />
      )}

      <Suspense fallback={null}>
        {objects.map((o) => (
          <ObjectNode key={o.id} obj={o} />
        ))}
      </Suspense>

      {selectedObj3D && !selectedLocked && (
        <TransformControls
          object={selectedObj3D}
          mode={transformMode}
          onMouseDown={() => useRuntime.getState().setInteracting(true)}
          onMouseUp={() => {
            useRuntime.getState().setInteracting(false);
            const o = selectedObj3D;
            if (!selectedId) return;
            setTransform(selectedId, {
              position: o.position.toArray() as [number, number, number],
              rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
              scale: o.scale.toArray() as [number, number, number],
            });
          }}
        />
      )}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        onStart={() => useRuntime.getState().setInteracting(true)}
        onEnd={() => {
          useRuntime.getState().setInteracting(false);
          const c = controls.current;
          if (!c) return;
          setCamera(
            camera.position.toArray() as [number, number, number],
            c.target.toArray() as [number, number, number],
          );
        }}
      />
    </>
  );
}

const SINGLE_PART: PartInfo[] = [{ id: "body", name: "Body" }];

function ObjectNode({ obj }: { obj: SceneObject }) {
  const ref = useRef<THREE.Group>(null);
  const select = useEditor((s) => s.select);
  const register = useRuntime((s) => s.register);
  const unregister = useRuntime((s) => s.unregister);
  const setParts = useRuntime((s) => s.setParts);
  const setError = useRuntime((s) => s.setError);

  useEffect(() => {
    if (ref.current) register(obj.id, ref.current);
    return () => unregister(obj.id);
  }, [obj.id, register, unregister]);

  // Text and shapes are single-mesh; models publish their own list from ModelMesh.
  useEffect(() => {
    if (obj.kind !== "model") setParts(obj.id, SINGLE_PART);
  }, [obj.id, obj.kind, setParts]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (obj.locked) return;
    e.stopPropagation();

    // Pulling focus reads the distance to the exact point under the cursor, the
    // way a focus puller marks an actor rather than the middle of their body.
    if (useRuntime.getState().focusPicking) {
      useEditor.getState().setStaging({ focusDistance: e.distance }, false);
      useRuntime.getState().setFocusPicking(false);
      return;
    }

    // Shift-click drills into the individual mesh so it can take its own material.
    const partId = e.shiftKey ? ((e.object.userData?.partId as string | undefined) ?? "body") : null;
    select(obj.id, partId);
  };

  return (
    <group
      ref={ref}
      position={obj.transform.position}
      rotation={obj.transform.rotation}
      scale={obj.transform.scale}
      visible={obj.visible}
      raycast={obj.locked ? () => null : undefined}
      onClick={onClick}
    >
      {/* Motion lives on an inner group so the gizmo still drives the base transform. */}
      <MotionGroup motion={obj.kind === "label" ? undefined : obj.motion}>
        <ObjectBoundary objectId={obj.id} onError={setError}>
          <Suspense fallback={null}>
            {obj.kind === "text" ? (
              <TextMesh obj={obj} />
            ) : obj.kind === "shape" ? (
              <ShapeMesh obj={obj} />
            ) : obj.kind === "cover" ? (
              <CoverMesh obj={obj} />
            ) : obj.kind === "label" ? (
              <LabelMesh obj={obj} />
            ) : (
              <ModelMesh obj={obj} />
            )}
          </Suspense>
        </ObjectBoundary>
      </MotionGroup>
    </group>
  );
}

function MotionGroup({ motion, children }: { motion: Motion | undefined; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    // A project saved before motion existed can still be missing the field.
    if (group.current && motion) applyMotion(group.current, motion, sceneClock.time);
  });
  return <group ref={group}>{children}</group>;
}

/** Advances the shared clock once per frame, ahead of everything that reads it. */
function ClockDriver() {
  useFrame((_, delta) => sceneClock.advance(delta), -1000);
  return null;
}

/**
 * Takes over the render so the frame can pass through depth of field. Priority
 * above zero also means every other useFrame, including the cover effect
 * chains, has already run by the time this draws.
 */
function SceneRenderer({ staging }: { staging: Staging }) {
  const pass = useMemo(() => new DepthOfFieldPass(), []);
  const look = useMemo(() => new LookPass(), []);
  const quality = useEditor((s) => s.quality);
  useEffect(
    () => () => {
      pass.dispose();
      look.dispose();
    },
    [pass, look],
  );

  useFrame(({ gl, scene, camera }) => {
    // Depth of field is the most expensive thing in the frame and the least
    // useful mid-drag, when the eye follows motion rather than judging an edge.
    // Fine keeps it on regardless, for the moment just before an export.
    const busy = quality !== "fine" && useRuntime.getState().interacting;
    const blur = staging.depthOfField && !busy;
    const finish = lookIsActive(staging.look);

    if (!blur && !finish) {
      gl.render(scene, camera);
      return;
    }

    // The gizmo must not be blurred or printed with the picture. It is kept
    // out of the frame and drawn over the finished result at the end.
    const helpers = hideEditorHelpers(scene);
    const drawScene = () => {
      if (!blur) {
        gl.render(scene, camera);
        return;
      }
      pass.render(gl, scene, camera as THREE.PerspectiveCamera, {
        focus: staging.focusDistance,
        aperture: staging.aperture,
        focalLength: staging.focalLength,
        maxBlur: staging.maxBlur,
        blades: staging.blades,
        bladeAngle: (staging.bladeAngle * Math.PI) / 180,
        highlight: staging.bokehHighlight,
        worldMm: staging.sceneScale,
      });
    };

    // The look stays on while the camera moves: it is the picture, not a polish
    // on it, and a print that flickered back to a render would be disorienting.
    if (finish) look.render(gl, drawScene, staging.look, sceneClock.time);
    else drawScene();

    for (const o of helpers) o.visible = true;
    drawHelpersOnTop(gl, scene, camera);
  }, 1);

  return null;
}
