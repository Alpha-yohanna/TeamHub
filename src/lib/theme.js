const STORAGE_KEY = 'teamhub-theme'
const VALID_THEMES = ['light', 'dark', 'system']
// New users (nothing in localStorage yet) always start on light — the app must never default
// a first-time visitor into dark mode based on OS preference.
const DEFAULT_THEME = 'light'

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return VALID_THEMES.includes(value) ? value : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme)
  } else {
    root.removeAttribute('data-theme')
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private browsing or storage disabled — the attribute is still applied for this session.
  }
}

// Applies the last-known theme immediately at module load, before auth resolves or React
// mounts, so there's no flash of the wrong theme. The database preference (once loaded after
// login) is the source of truth and overwrites this local cache if it differs.
export function initTheme() {
  applyTheme(getStoredTheme())
}
