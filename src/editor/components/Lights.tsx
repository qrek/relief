"use client";

import { use, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { SceneLight, Staging } from "../types";
import { isImportedEnvironment, loadEnvironment } from "../lib/hdri";

/** The distance a sun is placed at: far enough that its shadow frames the whole scene. */
const SUN_DISTANCE = 14;

/**
 * Where a light sits, from its azimuth and height on the sphere around the
 * origin. Azimuth zero is in front of the subject, positive to the right,
 * which is the convention the single light always had.
 */
export function lightPosition(light: SceneLight): [number, number, number] {
  const az = THREE.MathUtils.degToRad(light.azimuth);
  const el = THREE.MathUtils.degToRad(light.elevation);
  const d = light.type === "sun" ? SUN_DISTANCE : light.distance;
  return [Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d];
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
