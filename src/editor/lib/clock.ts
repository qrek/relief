/**
 * The single time source for everything that moves: object motion and animated
 * effects. It normally follows real time, but during a video export it is pinned
 * to exact frame times so every frame renders deterministically.
 */
class SceneClock {
  private elapsed = 0;
  private pinned: number | null = null;

  /** Seconds the scene should render at right now. */
  get time(): number {
    return this.pinned ?? this.elapsed;
  }

  get isPinned(): boolean {
    return this.pinned !== null;
  }

  /** Called once per frame by the viewport while running live. */
  advance(delta: number) {
    if (this.pinned === null) this.elapsed += delta;
  }

  /** Pins the clock to an exact time, for frame-by-frame rendering. */
  pin(time: number) {
    this.pinned = time;
  }

  release() {
    this.pinned = null;
  }

  reset() {
    this.elapsed = 0;
  }
}

export const sceneClock = new SceneClock();

export const TAU = Math.PI * 2;
