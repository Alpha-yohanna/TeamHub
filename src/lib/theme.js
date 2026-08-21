const STORAGE_KEY = 'teamhub-theme'
const VALID_THEMES = ['light', 'dark', 'system']

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return VALID_THEMES.includes(value) ? value : 'system'
  } catch {
    return 'system'
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
