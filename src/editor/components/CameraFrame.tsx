"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const ACCENT = "#cdf04c";
const SEGMENTS = 16;

/**
 * The shot camera, drawn as an object in the free view: a small body, four
 * rays, and the frame they open onto at the given distance, which is the
 * plane of focus when depth of field is on. A tick on top says which way is
 * up. Rebuilt every frame from the camera itself, so it never lags a drag.
 */
export function CameraFrame({ distance }: { distance: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(SEGMENTS * 2 * 3), 3));
    const material = new THREE.LineBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });
    const object = new THREE.LineSegments(geometry, material);
    object.frustumCulled = false;
    object.userData.overlay = true;
    return object;
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(() => {
    const d = Math.max(0.2, distance);
    const h = Math.tan((camera.fov * Math.PI) / 360) * d;
    const w = h * camera.aspect;
    const out: number[] = [];
    const seg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => out.push(ax, ay, az, bx, by, bz);

    // The frame.
    seg(-w, -h, -d, w, -h, -d);
    seg(w, -h, -d, w, h, -d);
    seg(w, h, -d, -w, h, -d);
    seg(-w, h, -d, -w, -h, -d);
    // The rays from the camera to its corners.
    seg(0, 0, 0, -w, -h, -d);
    seg(0, 0, 0, w, -h, -d);
    seg(0, 0, 0, w, h, -d);
    seg(0, 0, 0, -w, h, -d);
    // Up.
    const tick = Math.min(w, h) * 0.22;
    seg(-tick, h, -d, 0, h + tick, -d);
    seg(0, h + tick, -d, tick, h, -d);
    // The body: a small box just behind the lens.
    const b = 0.16;
    const back = 0.28;
    seg(-b, -b, back, b, -b, back);
    seg(b, -b, back, b, b, back);
    seg(b, b, back, -b, b, back);
    seg(-b, b, back, -b, -b, back);
    while (out.length < SEGMENTS * 6) out.push(0, 0, 0, 0, 0, 0);

    const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    (attr.array as Float32Array).set(out);
    attr.needsUpdate = true;
    line.position.copy(camera.position);
    line.quaternion.copy(camera.quaternion);
  });

  return <primitive object={line} />;
}
