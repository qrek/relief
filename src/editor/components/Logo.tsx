/**
 * The mark: a heavy R standing off its tile. The letter is drawn twice, once
 * pushed down and to the right in a deeper tone and once on top, so it reads
 * as a raised letterform, which is what relief means. Drawn as a path rather
 * than set in a font, so it is the same everywhere and holds at sixteen pixels.
 */
const R_PATH = "M7.2 19.2V5h6.1a4.05 4.05 0 0 1 0 8.1H7.2m5.4 0 5.2 6.1";

export function ReliefMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-label="Relief"
      role="img"
    >
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={R_PATH} stroke="var(--accent-ink)" opacity="0.32" transform="translate(1.7 1.7)" />
        <path d={R_PATH} stroke="var(--accent-ink)" />
      </g>
    </svg>
  );
}
