"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { currentFormat, useEditor } from "../store";
import { useRuntime } from "../runtime";
import type { Motion, PartInfo, SceneObject, Staging } from "../types";
import { DepthOfFieldPass, focalToFov } from "../lib/postFx";
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

/** Sizes the canvas to the active format's aspect ratio inside the available area. */
export function Viewport() {
  const project = useEditor((s) => s.project);
  const format = currentFormat(project);
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
        <Canvas
          shadows
          dpr={[1, 2]}
          // The drawing buffer is kept so video export can read frames back after awaiting the encoder.
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{ fov: project.staging.fov, position: project.camera.position, near: 0.1, far: 200 }}
          onPointerMissed={() => useEditor.getState().select(null)}
        >
          <SceneContent />
        </Canvas>
      </div>
      <FormatBadge />
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
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-neutral-900/90 px-3 py-1.5 text-xs text-neutral-300 ring-1 ring-white/10 backdrop-blur">
      <select
        value={project.formatId}
        onChange={(e) => setFormat(e.target.value)}
        className="bg-transparent outline-none"
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
      {hasSafe && (
        <button
          type="button"
          onClick={() => setSafeAreas(!safeAreas)}
          title="Show the margins the platform's own interface covers"
          className={`rounded-full px-2 py-0.5 text-[11px] transition ${
            safeAreas ? "bg-white text-black" : "bg-white/10 text-neutral-400 hover:bg-white/20"
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

  const az = THREE.MathUtils.degToRad(staging.lightAzimuth);
  const el = THREE.MathUtils.degToRad(staging.lightElevation);
  const lightPos: [number, number, number] = [
    Math.cos(el) * Math.sin(az) * 8,
    Math.sin(el) * 8,
    Math.cos(el) * Math.cos(az) * 8,
  ];

  return (
    <>
      <ClockDriver />
      <SceneRenderer staging={staging} />
      {!staging.transparent && !staging.envAsBackground && (
        <color attach="background" args={[staging.background]} />
      )}
      <Suspense fallback={null}>
        <Environment
          preset={staging.environment}
          background={staging.envAsBackground}
          backgroundBlurriness={staging.envBlur}
          environmentIntensity={staging.envIntensity}
          environmentRotation={[0, staging.envRotation, 0]}
          backgroundRotation={[0, staging.envRotation, 0]}
        />
      </Suspense>
      <directionalLight
        position={lightPos}
        color={staging.lightColor}
        intensity={staging.lightIntensity}
        castShadow={staging.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      >
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.1, 30]} />
      </directionalLight>
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
          onMouseUp={() => {
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
        onEnd={() => {
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
  useEffect(() => () => pass.dispose(), [pass]);

  useFrame(({ gl, scene, camera }) => {
    if (!staging.depthOfField) {
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
    });
  }, 1);

  return null;
}
