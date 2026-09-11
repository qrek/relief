/**
 * The mark: a scrap of a map. Contour lines around a summit set high and to
 * the right, bunched on that side where the ground is steep and spread wide
 * toward the lower left where it eases off. The outer ones run off the tile,
 * so it reads as a crop of real ground rather than a symbol on a badge.
 * Relief, drawn the way a cartographer draws it.
 */
export const MARK_CONTOURS = [
  // The summit.
  "M15 6.6c1.5-.5 3 .3 3.1 1.6.1 1.3-1.2 2.3-2.7 2.1-1.4-.2-2.2-1.2-1.8-2.3.2-.7.7-1.2 1.4-1.4z",
  "M13.2 4.9c2.9-1.2 6.3-.3 6.9 2.1.6 2.6-1.6 5.4-5 6.4-3 .9-6.3-.1-6.9-2.5-.5-2.2 1.5-4.5 5-6z",
  "M11.5 3.2c4.4-1.9 9.5-.6 10.3 2.5.9 3.6-2.4 7.9-7.7 9.7-4.6 1.6-9.4.5-10.6-2.5-1.1-2.9 2-6.9 8-9.7z",
  // Mostly beyond the tile: only its lower-left sweep shows.
  "M9.5.8C16-2.2 23.8 0 24.6 4.3c.9 4.8-3.6 10.7-10.6 13.3C7.4 20 1.2 18.9-.4 15.3-1.9 11.6 2 5.3 9.5.8z",
  // A second rise, its shoulder in the corner.
  "M-1.5 20.2c3.3-1.6 6.6-.4 8.3 3.6",
];

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
      <defs>
        <clipPath id="relief-tile">
          <rect width="24" height="24" rx="6" />
        </clipPath>
      </defs>
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <g
        clipPath="url(#relief-tile)"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MARK_CONTOURS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
