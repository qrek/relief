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

    const frameHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * LABEL_DISTANCE;
    const frameWidth = frameHeight * camera.aspect;

    _position
      .set(obj.anchorX * frameWidth, obj.anchorY * frameHeight, -LABEL_DISTANCE)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);

    _tilt.setFromAxisAngle(_axis, THREE.MathUtils.degToRad(-obj.tilt));
    _quaternion.copy(camera.quaternion).multiply(_tilt);

    const unit = frameHeight * obj.size;
    _scale.set(unit, unit, unit);
    node.matrixWorld.compose(_position, _quaternion, _scale);
  });

  const cacheKey = [value, font.id, obj.letterSpacing, obj.lineHeight, obj.align].join("|");

  return (
    <group ref={group}>
      {/*
        drei's Center places the content on the named side of the origin, so a
        left-aligned line, which should run rightward from its anchor, needs the
        opposite flag.
      */}
      <Center
        cacheKey={cacheKey}
        right={obj.align === "left"}
        left={obj.align === "right"}
        disableZ
      >
        <Text3D
          font={data}
          size={1}
          height={0.02}
          letterSpacing={obj.letterSpacing}
          lineHeight={obj.lineHeight}
          bevelEnabled={false}
          curveSegments={6}
          renderOrder={10}
          userData={{ partId: "body", isLabel: true }}
        >
          {value || " "}
          <meshBasicMaterial
            color={obj.color}
            transparent
            opacity={obj.opacity}
            toneMapped={false}
            // Flat type belongs on top of the render, not inside it.
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </Text3D>
      </Center>
    </group>
  );
}

type ComponentFont = Parameters<typeof Text3D>[0]["font"];
