// The real TeamHub mark — same artwork as the login page (public/teamhub-logo.svg), which is
// also what index.html points the browser tab icon at. It's a complete, self-colored graphic
// (not a currentColor glyph), so it should sit on a plain/transparent background, not a solid
// swatch.
export function TeamHubMark({ size = 36 }) {
  return <img alt="" height={size} src="/teamhub-logo.svg" width={size} />
}
