const ICONS = {
  image: '🖼️',
  pdf: '📕',
  document: '📄',
  spreadsheet: '📊',
  presentation: '📽️',
  text: '📝',
  archive: '🗜️',
  other: '📁',
}

export function FileTypeIcon({ category }) {
  return <span aria-hidden="true">{ICONS[category] ?? ICONS.other}</span>
}
