"use client";

import { use, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import * as THREE from "three";
import type { LabelObject, PartInfo } from "../../types";
import { useRuntime } from "../../runtime";
import { fontById } from "../../presets/fonts";
import { loadTypeface } from "../../lib/ttf";

const LABEL_PARTS: PartInfo[] = [{ id: "body", name: "Text" }];

/** Close enough to the camera to sit in front of the scene, far enough to avoid the near plane. */
const LABEL_DISTANCE = 5;
/**
 * Far enough back that the scene passes in front of it, but short of a backdrop
 * cover, which sits at forty. The type is scaled by the distance it is placed
 * at, so it fills the same share of the frame either way.
 */
const BEHIND_DISTANCE = 30;

const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _axis = new THREE.Vector3(0, 0, 1);

export function LabelMesh({ obj }: { obj: LabelObject }) {
  const setParts = useRuntime((s) => s.setParts);
  useEffect(() => {
    setParts(obj.id, LABEL_PARTS);
  }, [obj.id, setParts]);

  const font = fontById(obj.fontId);
  const data = use(loadTypeface(font.url)) as unknown as ComponentFont;
  const group = useRef<THREE.Group>(null);

  const value =
    obj.textCase === "upper"
      ? obj.text.toUpperCase()
      : obj.textCase === "lower"
        ? obj.text.toLowerCase()
        : obj.text;

  useFrame((state) => {
    const node = group.current;
    if (!node) return;
    const camera = state.camera as THREE.PerspectiveCamera;

    // The label lives on the frame, so its placement is derived from the camera
    // every frame rather than from its own transform.
    node.matrixAutoUpdate = false;
    node.matrixWorldAutoUpdate = false;

    const distance = obj.depth === "behind" ? BEHIND_DISTANCE : LABEL_DISTANCE;
    const frameHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
    const frameWidth = frameHeight * camera.aspect;

    _position
      .set(obj.anchorX * frameWidth, obj.anchorY * frameHeight, -distance)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);

    _tilt.setFromAxisAngle(_axis, THREE.MathUtils.degToRad(-obj.tilt));
    _quaternion.copy(camera.quaternion).multiply(_tilt);

    const unit = frameHeight * obj.size;
    _scale.set(unit, unit, unit);
    node.matrixWorld.compose(_position, _quaternion, _scale);
  });

  const behind = obj.depth === "behind";
  const lines = (value || " ").split("\n");
  // Each line is set on its own, so alignment holds line by line the way it
  // does on a page: a centred caption is centred on every line, not as a block
  // with a ragged right edge. The block is then lifted so its middle sits on
  // the anchor; 0.36 is about half a cap height at size one.
  const blockShift = ((lines.length - 1) * obj.lineHeight) / 2 - 0.36;

  return (
    <group ref={group}>
      <group position={[0, blockShift, 0]}>
        {lines.map((line, i) => (
          /*
            drei's Center places the content on the named side of the origin,
            so a left-aligned line, which should run rightward from its anchor,
            needs the opposite flag.
          */
          <Center
            key={i}
            cacheKey={[line, font.id, obj.letterSpacing, obj.align].join("|")}
            right={obj.align === "left"}
            left={obj.align === "right"}
            disableY
            disableZ
            position={[0, -i * obj.lineHeight, 0]}
          >
            <Text3D
              font={data}
              size={1}
              height={0.02}
              letterSpacing={obj.letterSpacing}
              bevelEnabled={false}
              curveSegments={6}
              renderOrder={behind ? -10 : 10}
              userData={{ partId: "body", isLabel: true }}
            >
              {line || " "}
              <meshBasicMaterial
                color={obj.color}
                transparent
                opacity={obj.opacity}
                toneMapped={false}
                // In front, the type is a caption laid over the picture and
                // ignores depth. Behind, it is a sheet at the back of the room
                // that the subject occludes, so it takes part in the depth test.
                depthTest={behind}
                depthWrite={behind}
                side={THREE.DoubleSide}
              />
            </Text3D>
          </Center>
        ))}
      </group>
    </group>
  );
}

type ComponentFont = Parameters<typeof Text3D>[0]["font"];
