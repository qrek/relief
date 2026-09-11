"use client";

import { useEffect, useState } from "react";
import { sceneClock } from "../lib/clock";

/**
 * The clock is not React state: it ticks sixty times a second and nothing in
 * the panels needs that. This samples it a few times a second for a readout,
 * and re-renders only when the rounded value changes.
 */
export function useClockTick(hz = 12): { time: number; playing: boolean } {
  const [state, setState] = useState(() => ({ time: sceneClock.clipTime, playing: sceneClock.playing }));
  useEffect(() => {
    const id = setInterval(() => {
      const time = Math.round(sceneClock.clipTime * 100) / 100;
      setState((prev) => (prev.time === time && prev.playing === sceneClock.playing ? prev : { time, playing: sceneClock.playing }));
    }, 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return state;
}
