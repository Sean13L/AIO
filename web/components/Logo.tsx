// Icon: a rounded-square "page" with a folded corner and a checkmark —
// reads as both "document" (syllabus) and "done" (deadline tracking)
// without needing a wordmark to explain it. One shape, reused everywhere
// (nav, favicon, homepage hero) so the mark stays recognizable at any size.
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
      <rect width="32" height="32" rx="9" fill="#6C5CE7" />
      <path
        d="M11 16.5L14.5 20L21.5 12.5"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 26, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <>
      <LogoMark size={size} />
      {withWordmark && <span>Studently</span>}
    </>
  );
}
