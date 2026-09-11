"use client";

import { use, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { LightType, SceneLight, Staging } from "../types";
import { isImportedEnvironment, loadEnvironment } from "../lib/hdri";

/** The distance a sun is placed at: far enough that its shadow frames the whole scene. */
const SUN_DISTANCE = 14;

/**
 * Where a sun's marker is drawn. The light itself sits further out, but a
 * marker that far away would be off every screen; its direction is all that
 * matters, and that reads the same from here.
 */
const SUN_MARKER_DISTANCE = 6;

const ACCENT = "#cdf04c";

function onSphere(azimuth: number, elevation: number, d: number): [number, number, number] {
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  return [Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d];
}

/**
 * Where a light sits, from its azimuth and height on the sphere around the
 * origin. Azimuth zero is in front of the subject, positive to the right,
 * which is the convention the single light always had.
 */
export function lightPosition(light: SceneLight): [number, number, number] {
  return onSphere(light.azimuth, light.elevation, light.type === "sun" ? SUN_DISTANCE : light.distance);
}

export function markerPosition(light: SceneLight): [number, number, number] {
  return onSphere(light.azimuth, light.elevation, light.type === "sun" ? SUN_MARKER_DISTANCE : light.distance);
}

/**
 * The reverse: a marker dragged to a point becomes an azimuth, a height and a
 * distance, kept within what the panel's sliders can show. A light always
 * aims at the subject, so dragging it around is all the placing there is.
 */
export function placementFromPosition(p: THREE.Vector3, type: LightType): Pick<SceneLight, "azimuth" | "elevation" | "distance"> {
  const length = Math.max(0.001, p.length());
  const elevation = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.asin(p.y / length)), -30, 90);
  const azimuth = THREE.MathUtils.radToDeg(Math.atan2(p.x, p.z));
  const distance = type === "sun" ? SUN_DISTANCE : THREE.MathUtils.clamp(length, 1, 30);
  return { azimuth, elevation, distance };
}

export function SceneLights({ staging }: { staging: Staging }) {
  return (
    <>
      {staging.lights
        .filter((l) => l.enabled)
        .map((light) => (
          <LightNode key={light.id} light={light} shadows={staging.castShadows && light.castShadow} />
        ))}
      {staging.castShadows && staging.shadowCatcher && (
        <ShadowCatcher y={staging.floorY} opacity={staging.shadowOpacity} />
      )}
    </>
  );
}

function LightNode({ light, shadows }: { light: SceneLight; shadows: boolean }) {
  const position = lightPosition(light);
  const scene = useThree((s) => s.scene);
  const ref = useRef<THREE.DirectionalLight | THREE.SpotLight>(null);

  // A sun or a spot aims at a target object; that object has to be in the
  // scene for three to update it, and it stays at the origin.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.target.position.set(0, 0, 0);
    scene.add(node.target);
    return () => {
      scene.remove(node.target);
    };
  }, [scene, light.type]);

  const common = {
    color: light.color,
    intensity: light.intensity,
    castShadow: shadows,
    "shadow-mapSize": [2048, 2048] as [number, number],
    "shadow-bias": -0.0003,
    "shadow-normalBias": 0.02,
    "shadow-radius": light.softness,
  };

  if (light.type === "sun") {
    return (
      <directionalLight ref={ref as React.RefObject<THREE.DirectionalLight>} position={position} {...common}>
        <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 0.1, SUN_DISTANCE * 2.5]} />
      </directionalLight>
    );
  }
  if (light.type === "spot") {
    return (
      <spotLight
        ref={ref as React.RefObject<THREE.SpotLight>}
        position={position}
        angle={THREE.MathUtils.degToRad(light.angle / 2)}
        penumbra={light.penumbra}
        // No falloff with distance: the slider means brightness, not watts, and
        // a light stays as bright when it is pulled back to soften its shadow.
        decay={0}
        {...common}
      />
    );
  }
  return <pointLight position={position} decay={0} {...common} />;
}

/**
 * Line drawings for the markers, in a frame whose +Z points at the subject:
 * a sun is a disc with rays and an arrow, a spot is its cone, a point is a
 * small sphere. Pairs of points, for LineSegments.
 */
function markerGeometry(type: LightType, angle: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const seg = (a: [number, number, number], b: [number, number, number]) => {
    pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
  };
  const ring = (n: number, at: (c: number, s: number) => [number, number, number]) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = ((i + 1) / n) * Math.PI * 2;
      seg(at(Math.cos(a), Math.sin(a)), at(Math.cos(b), Math.sin(b)));
    }
  };
  if (type === "sun") {
    ring(24, (c, s) => [c * 0.3, s * 0.3, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      seg([Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0], [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0]);
    }
    seg([0, 0, 0], [0, 0, 1.6]);
    seg([0, 0, 1.6], [0.12, 0, 1.38]);
    seg([0, 0, 1.6], [-0.12, 0, 1.38]);
  } else if (type === "spot") {
    const length = 1.6;
    const r = length * Math.tan(THREE.MathUtils.degToRad(angle) / 2);
    ring(24, (c, s) => [c * r, s * r, length]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      seg([0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, length]);
    }
    ring(12, (c, s) => [c * 0.12, s * 0.12, 0]);
  } else {
    ring(24, (c, s) => [c * 0.28, s * 0.28, 0]);
    ring(24, (c, s) => [c * 0.28, 0, s * 0.28]);
    ring(24, (c, s) => [0, c * 0.28, s * 0.28]);
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/**
 * The lights, drawn in the set where a designer can see and grab them, the
 * way Blender shows a lamp. Overlays: never exported, and drawn crisp over a
 * blurred or printed frame. The selected one carries the gizmo.
 */
export function LightMarkers({
  lights,
  selectedId,
  onSelect,
  bindSelected,
}: {
  lights: SceneLight[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Hands the selected marker's object to the gizmo, and null when it goes. */
  bindSelected: (obj: THREE.Object3D | null) => void;
}) {
  return (
    <>
      {lights.map((light) => (
        <LightMarker
          key={light.id}
          light={light}
          selected={light.id === selectedId}
          onSelect={onSelect}
          bindSelected={bindSelected}
        />
      ))}
    </>
  );
}

function LightMarker({
  light,
  selected,
  onSelect,
  bindSelected,
}: {
  light: SceneLight;
  selected: boolean;
  onSelect: (id: string) => void;
  bindSelected: (obj: THREE.Object3D | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const position = markerPosition(light);
  const geometry = useMemo(() => markerGeometry(light.type, light.angle), [light.type, light.angle]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const aim = useMemo(() => {
    const length = Math.hypot(...position);
    return new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, length)]);
    // The aim line only needs to reach the subject; its length follows the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1], position[2]]);
  useEffect(() => () => aim.dispose(), [aim]);

  useLayoutEffect(() => {
    if (!selected) return;
    bindSelected(group.current);
    return () => bindSelected(null);
  }, [selected, bindSelected]);

  // The marker faces the subject, so its cone or its arrow points where the
  // light points, including while it is being dragged.
  useFrame(() => group.current?.lookAt(0, 0, 0));

  const color = selected ? ACCENT : light.enabled ? "#e6e6e6" : "#666666";
  return (
    <group ref={group} position={position} userData={{ overlay: true }}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={color} transparent opacity={selected ? 1 : 0.7} depthTest={false} depthWrite={false} />
      </lineSegments>
      {selected && (
        <lineSegments geometry={aim}>
          <lineBasicMaterial color={ACCENT} transparent opacity={0.3} depthTest={false} depthWrite={false} />
        </lineSegments>
      )}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(light.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.4, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** An invisible floor that only shows the shadows falling on it. */
function ShadowCatcher({ y, opacity }: { y: number; opacity: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow raycast={() => null}>
      <planeGeometry args={[60, 60]} />
      <shadowMaterial transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/**
 * The environment: one of the presets, or a map the designer imported. Both
 * light the scene and, when asked, fill the background.
 */
export function SceneEnvironment({ staging }: { staging: Staging }) {
  const shared = {
    background: staging.envAsBackground,
    backgroundBlurriness: staging.envBlur,
    environmentIntensity: staging.envIntensity,
    environmentRotation: [0, staging.envRotation, 0] as [number, number, number],
    backgroundRotation: [0, staging.envRotation, 0] as [number, number, number],
  };
  if (isImportedEnvironment(staging.environment)) {
    return <ImportedEnvironment id={staging.environment} {...shared} />;
  }
  return <Environment preset={staging.environment as PresetName} {...shared} />;
}

type PresetName = NonNullable<Parameters<typeof Environment>[0]["preset"]>;

function ImportedEnvironment({
  id,
  ...shared
}: {
  id: string;
  background: boolean;
  backgroundBlurriness: number;
  environmentIntensity: number;
  environmentRotation: [number, number, number];
  backgroundRotation: [number, number, number];
}) {
  const map = use(loadEnvironment(id));
  return <Environment map={map} {...shared} />;
}
