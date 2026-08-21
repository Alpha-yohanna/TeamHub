// Glyph only, no background — drop it inside a colored square (e.g. .brand-mark, .auth-logo)
// so it inherits that container's color as the stroke via currentColor.
export function TeamHubMark({ size = 36 }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 6.5h14M12 6.5v11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.1"
      />
    </svg>
  )
}
