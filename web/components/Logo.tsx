// Icon: a bold "S" (for Studdy) with a pencil laid diagonally across it —
// sharpened tip top-right, eraser end bottom-left, both poking out past the
// letter so the pencil reads as its own object rather than fusing into the
// S. The two duplicate paths per pencil piece aren't a mistake: the first
// (fill = background color, stroked slightly wider) is a knockout halo that
// carves a thin gap into the S wherever the pencil crosses it; the second
// (white, no stroke) is the actual pencil drawn on top. Without the halo,
// pencil and letter would just merge into one white shape where they
// overlap. One shape, reused everywhere (nav, favicon, homepage hero) so
// the mark stays recognizable at any size.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="brand-mark"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#1E40AF" />
      <path
        d="M20 11 A4 4 0 1 0 15 15 A4 4 0 1 1 12 21"
        stroke="#ffffff"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10.67 24.55 L25.07 8.95 L26 6 L23.15 7.19 L8.75 22.79 Z"
        fill="#1E40AF"
        stroke="#1E40AF"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M10.07 25.22 L9.46 25.88 L7.54 24.12 L8.15 23.46 Z"
        fill="#1E40AF"
        stroke="#1E40AF"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M10.67 24.55 L25.07 8.95 L26 6 L23.15 7.19 L8.75 22.79 Z" fill="#ffffff" />
      <path d="M10.07 25.22 L9.46 25.88 L7.54 24.12 L8.15 23.46 Z" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ size = 26, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <>
      <LogoMark size={size} />
      {withWordmark && <span>Studdy</span>}
    </>
  );
}
