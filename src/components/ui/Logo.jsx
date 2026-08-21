// The real TeamHub mark — same artwork as public/favicon.svg (the browser tab icon), so the
// in-app brand mark and the tab icon match again. It's a complete, self-colored graphic (not a
// currentColor glyph), so it should sit on a plain/transparent background, not a solid swatch.
export function TeamHubMark({ size = 36 }) {
  const width = size
  const height = Math.round((size * 46) / 48)

  return <img alt="" height={height} src="/favicon.svg" width={width} />
}
