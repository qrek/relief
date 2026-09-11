/**
 * The single time source for everything that moves: object motion and animated
 * effects. It normally follows real time, but during a video export it is pinned
 * to exact frame times so every frame renders deterministically.
 */
class SceneClock {
  private elapsed = 0;
  private pinned: number | null = null;
  /** Length of the keyframed clip in seconds; the clip time wraps on it. */
  duration = 4;
  /** False while the designer has paused the scene to work on a moment of it. */
  playing = true;

  /** Seconds the scene should render at right now. */
  get time(): number {
    return this.pinned ?? this.elapsed;
  }

  /** Where in the clip the scene is: the time, wrapped on the clip's length. */
  get clipTime(): number {
    const d = Math.max(0.01, this.duration);
    return ((this.time % d) + d) % d;
  }

  get isPinned(): boolean {
    return this.pinned !== null;
  }

  /** Called once per frame by the viewport while running live. */
  advance(delta: number) {
    if (this.pinned === null && this.playing) this.elapsed += delta;
  }

  /** Jumps to a moment of the clip. Motion and effects jump with it, so what is seen is one instant. */
  seek(clipTime: number) {
    this.elapsed = Math.max(0, clipTime);
  }

  play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    this.playing = !this.playing;
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
