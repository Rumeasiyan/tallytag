// Four tally strokes and the diagonal that closes the count of five.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M7 5v22M13 5v22M19 5v22M25 5v22" />
      <path d="M3 22L29 10" stroke="#e6a800" />
    </svg>
  );
}
