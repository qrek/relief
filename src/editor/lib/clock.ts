/**
 * The single time source for everything that moves: object motion and animated
 * effects. It normally follows real time, but during a video export it is pinned
 * to exact frame times so every frame renders deterministically.
 */
class SceneClock {
  private elapsed = 0;
  private head = 0;
  private pinned: number | null = null;
  /** Length of the keyframed clip in seconds; the playhead wraps on it. */
  duration = 4;
  /**
   * Whether the playhead runs. Off until asked, like any timeline: opening a
   * scene does not start a performance. Looping motion and animated effects
   * keep their own live time regardless, so the viewport is never frozen.
   */
  playing = false;

  /** Seconds of live time, for looping motion and animated effects. */
  get time(): number {
    return this.pinned ?? this.elapsed;
  }

  /** Where the playhead is in the clip, for keyframes. */
  get clipTime(): number {
    const d = Math.max(0.01, this.duration);
    const t = this.pinned ?? this.head;
    return ((t % d) + d) % d;
  }

  get isPinned(): boolean {
    return this.pinned !== null;
  }

  /** Called once per frame by the viewport while running live. */
  advance(delta: number) {
    if (this.pinned !== null) return;
    this.elapsed += delta;
    if (this.playing) this.head = (this.head + delta) % Math.max(0.01, this.duration);
  }

  /** Moves the playhead. */
  seek(clipTime: number) {
    this.head = Math.max(0, clipTime);
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

  /** Pins both clocks to an exact time, for frame-by-frame rendering. */
  pin(time: number) {
    this.pinned = time;
  }

  release() {
    this.pinned = null;
  }

  reset() {
    this.elapsed = 0;
    this.head = 0;
  }
}

export const sceneClock = new SceneClock();

export const TAU = Math.PI * 2;
