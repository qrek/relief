/**
 * The mark: a hill drawn as contour lines, the way relief is drawn on a map.
 * Three closed contours, each shifted a little toward the summit, so the shape
 * leans and reads as a rise rather than a target. It sits in the accent colour
 * and keeps its shape at sixteen pixels.
 */
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
      <g fill="none" stroke="var(--accent-ink)" strokeWidth="1.7" strokeLinecap="round">
        <ellipse cx="11.6" cy="13.4" rx="7.6" ry="5.4" transform="rotate(-14 11.6 13.4)" />
        <ellipse cx="12.8" cy="12.2" rx="4.7" ry="3.2" transform="rotate(-14 12.8 12.2)" />
        <ellipse cx="13.9" cy="11.1" rx="1.9" ry="1.25" transform="rotate(-14 13.9 11.1)" />
      </g>
    </svg>
  );
}
