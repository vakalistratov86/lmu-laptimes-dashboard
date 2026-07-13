export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="LMU Dashboard"
      className="text-primary"
    >
      {/* Стилизованный спидометр / трасса */}
      <path
        d="M16 3 A13 13 0 1 0 29 16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 9 L16 16 L22 20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}
