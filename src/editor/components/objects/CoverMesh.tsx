"use client";

import { use, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CoverObject, PartInfo } from "../../types";
import { useRuntime } from "../../runtime";
import { loadMedia } from "../../lib/media";
import { EffectChain, chainSize } from "../../lib/effectChain";
import { effectById, isAnimated } from "../../presets/effects";
import { sceneClock } from "../../lib/clock";

const COVER_PARTS: PartInfo[] = [{ id: "media", name: "Media" }];

/** Distance in front of the camera used by backdrop covers. */
const BACKDROP_DISTANCE = 40;

const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();

export function CoverMesh({ obj }: { obj: CoverObject }) {
  const setParts = useRuntime((s) => s.setParts);
  useEffect(() => {
    setParts(obj.id, COVER_PARTS);
  }, [obj.id, setParts]);

  if (!obj.source) return <Placeholder obj={obj} />;
  return <CoverMedia obj={obj} />;
}

/** An empty media slot, drawn as a visible frame so it reads as "drop something here". */
function Placeholder({ obj }: { obj: CoverObject }) {
  const size = obj.background ? 4 : obj.size;
  const width = size * 1.5;
  const border = Math.max(0.04, size * 0.02);
  return (
    <group userData={{ partId: "media", isCover: true }}>
      <mesh userData={{ partId: "media", isCover: true }}>
        <planeGeometry args={[width, size]} />
        <meshBasicMaterial color="#8f8fa6" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[width - border * 2, size - border * 2]} />
        <meshBasicMaterial color="#1e1e26" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.002]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[size * 0.26, border]} />
        <meshBasicMaterial color="#8f8fa6" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.002]} rotation={[0, 0, -Math.PI / 4]}>
        <planeGeometry args={[size * 0.26, border]} />
        <meshBasicMaterial color="#8f8fa6" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CoverMedia({ obj }: { obj: CoverObject }) {
  if (!obj.source) throw new Error("Cover has no media");
  const media = use(loadMedia(obj.source.assetId));
  const { gl } = useThree();

  const chain = useMemo(() => new EffectChain(), []);
  useEffect(() => () => chain.dispose(), [chain]);

  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const lastSignature = useRef<string>("");

  const target = useMemo(() => chainSize(media.width, media.height), [media.width, media.height]);

  const animated = useMemo(
    () =>
      obj.effects.some((instance) => {
        if (!instance.enabled) return false;
        const def = effectById(instance.effectId);
        return def ? isAnimated(def, instance.params) : false;
      }),
    [obj.effects],
  );

  const signature = useMemo(
    () => JSON.stringify(obj.effects.map((e) => [e.effectId, e.enabled, e.params, e.colors])),
    [obj.effects],
  );

  const isVideo = media.video !== null;
  const isBackdrop = obj.background;
  const aspect = media.aspect * obj.stretch;

  useFrame((state) => {
    const mat = material.current;
    if (mat && (signature !== lastSignature.current || animated || isVideo)) {
      lastSignature.current = signature;
      mat.map = chain.render(gl, media.texture, obj.effects, sceneClock.time, target.width, target.height);
    }

    // A backdrop rides with the camera and fills the frame. Its world matrix is
    // written directly so the object's own transform does not apply.
    const node = mesh.current;
    if (!node) return;
    if (isBackdrop) {
      node.matrixAutoUpdate = false;
      node.matrixWorldAutoUpdate = false;
      const camera = state.camera as THREE.PerspectiveCamera;
      const frameHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * BACKDROP_DISTANCE;
      const frameWidth = frameHeight * camera.aspect;
      const fill = Math.max(frameWidth / aspect, frameHeight);
      _position.set(0, 0, -BACKDROP_DISTANCE).applyQuaternion(camera.quaternion).add(camera.position);
      _scale.set(fill * aspect, fill, 1);
      node.matrixWorld.compose(_position, camera.quaternion, _scale);
    } else if (!node.matrixAutoUpdate) {
      node.matrixAutoUpdate = true;
      node.matrixWorldAutoUpdate = true;
    }
  });

  const plane = useMemo(() => {
    if (isBackdrop) return { width: 1, height: 1 };
    return aspect >= 1
      ? { width: obj.size, height: obj.size / aspect }
      : { width: obj.size * aspect, height: obj.size };
  }, [aspect, isBackdrop, obj.size]);

  return (
    <mesh
      ref={mesh}
      userData={{ partId: "media", isCover: true, isBackdrop }}
      renderOrder={isBackdrop ? -1 : 0}
      frustumCulled={!isBackdrop}
      // A full-frame backdrop would swallow every click, so it is picked from the layers list only.
      raycast={isBackdrop ? () => null : undefined}
    >
      <planeGeometry args={[plane.width, plane.height]} />
      <meshBasicMaterial
        ref={material}
        map={media.texture}
        side={THREE.DoubleSide}
        // A backdrop must stay in the opaque queue: transparent materials draw
        // last, which would put it in front of the scene it sits behind.
        transparent={!isBackdrop}
        // Media should look like the file, not like a lit surface.
        toneMapped={false}
        depthWrite={!isBackdrop}
        depthTest={!isBackdrop}
      />
    </mesh>
  );
}
