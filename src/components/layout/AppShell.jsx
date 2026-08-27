import { useEffect, useState } from 'react'
import { HomeSidebar } from '../landing/HomeSidebar'
import { GlobalSearch } from '../search/GlobalSearch'
import { PWAInstallButton } from '../ui/PWAInstallButton'
import { SearchIcon } from '../ui/NavIcons'

const isAppleClient = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent ?? '')

export function AppShell({
  activePage,
  activeWorkspace,
  children,
  currentUser,
  onCreateWorkspace,
  onNavigate,
  onNavigateToTarget,
  onSwitchWorkspace,
  onlineUserIds,
  role,
  unreadCount,
  workspaces,
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleNavigate(page) {
    setIsMobileNavOpen(false)
    onNavigate(page)
  }

  return (
    <main className="app-shell">
      <button
        aria-expanded={isMobileNavOpen}
        aria-label="Toggle navigation menu"
        className="mobile-nav-toggle"
        onClick={() => setIsMobileNavOpen((open) => !open)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      {isMobileNavOpen && (
        <button
          aria-label="Close navigation menu"
          className="mobile-nav-backdrop"
          onClick={() => setIsMobileNavOpen(false)}
          type="button"
        />
      )}

      <div className={`sidebar-wrap${isMobileNavOpen ? ' open' : ''}`}>
        <HomeSidebar
          activePage={activePage}
          activeWorkspace={activeWorkspace}
          currentUser={currentUser}
          mode="app"
          onCreateWorkspace={onCreateWorkspace}
          onNavigate={handleNavigate}
          onSwitchWorkspace={onSwitchWorkspace}
          onlineUserIds={onlineUserIds}
          unreadCount={unreadCount}
          workspaces={workspaces}
        />
      </div>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="preview-label">{activeWorkspace?.name || 'Your workspace'}</span>
            <strong>{activeWorkspace?.role ? `${capitalize(activeWorkspace.role)} access` : role === 'admin' ? 'Admin access' : 'Member access'}</strong>
            <small className="topbar-meta">{currentUser?.email}</small>
          </div>
          <div className="topbar-actions">
            <button className="search-button" onClick={() => setIsSearchOpen(true)} type="button">
              <SearchIcon aria-hidden="true" height="16" width="16" />
              <span>Search messages, files, people…</span>
              <kbd className="search-shortcut-hint" aria-hidden="true">
                {isAppleClient ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
            <PWAInstallButton />
          </div>
        </header>
        {children}
      </div>

      {isSearchOpen && activeWorkspace && (
        <GlobalSearch
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(target) => {
            setIsSearchOpen(false)
            onNavigateToTarget?.(target)
          }}
          workspace={activeWorkspace}
        />
      )}
    </main>
  )
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
