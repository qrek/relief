import * as THREE from "three";
import { TAU } from "../lib/clock";
import type { Motion, MotionPreset } from "../types";

export type MotionDef = {
  id: MotionPreset;
  name: string;
  /** Which controls make sense for this preset. */
  uses: { amount: boolean; axis: boolean };
  hint: string;
};

export const MOTIONS: MotionDef[] = [
  { id: "none", name: "Still", uses: { amount: false, axis: false }, hint: "No movement." },
  { id: "spin", name: "Spin", uses: { amount: false, axis: true }, hint: "Turns continuously around one axis." },
  { id: "tumble", name: "Tumble", uses: { amount: false, axis: false }, hint: "Turns on two axes at once." },
  { id: "float", name: "Float", uses: { amount: true, axis: true }, hint: "Drifts back and forth along one axis." },
  { id: "orbit", name: "Orbit", uses: { amount: true, axis: false }, hint: "Circles around its own position." },
  { id: "swing", name: "Swing", uses: { amount: true, axis: true }, hint: "Rocks back and forth around one axis." },
  { id: "pulse", name: "Pulse", uses: { amount: true, axis: false }, hint: "Breathes in and out." },
];

export const DEFAULT_MOTION: Motion = {
  preset: "none",
  speed: 0.25,
  amount: 0.4,
  axis: 1,
  phase: 0,
};

export function motionById(id: MotionPreset): MotionDef {
  return MOTIONS.find((m) => m.id === id) ?? MOTIONS[0];
}

/** How long one full cycle takes, so an export can loop seamlessly. */
export function motionPeriod(motion: Motion): number | null {
  if (motion.preset === "none" || motion.speed <= 0) return null;
  return 1 / motion.speed;
}

const _euler = new THREE.Euler();

/**
 * Writes the animated offset for one object onto `target`. Speed is in cycles
 * per second, so a clip lasting one period loops without a seam.
 */
export function applyMotion(target: THREE.Object3D, motion: Motion, time: number) {
  if (motion.preset === "none") {
    target.position.set(0, 0, 0);
    target.rotation.set(0, 0, 0);
    target.scale.set(1, 1, 1);
    return;
  }

  const angle = TAU * (motion.speed * time + motion.phase);
  const wave = Math.sin(angle);
  target.position.set(0, 0, 0);
  _euler.set(0, 0, 0);
  target.scale.set(1, 1, 1);

  switch (motion.preset) {
    case "spin": {
      const axis = ["x", "y", "z"][motion.axis] as "x" | "y" | "z";
      _euler[axis] = angle;
      break;
    }
    case "tumble":
      _euler.set(angle * 0.6, angle, 0);
      break;
    case "float": {
      const axis = ["x", "y", "z"][motion.axis] as "x" | "y" | "z";
      target.position[axis] = wave * motion.amount;
      break;
    }
    case "orbit":
      target.position.set(Math.cos(angle) * motion.amount, 0, Math.sin(angle) * motion.amount);
      break;
    case "swing": {
      const axis = ["x", "y", "z"][motion.axis] as "x" | "y" | "z";
      _euler[axis] = wave * motion.amount;
      break;
    }
    case "pulse": {
      const k = 1 + wave * motion.amount * 0.5;
      target.scale.setScalar(Math.max(0.02, k));
      break;
    }
  }

  target.rotation.copy(_euler);
}
