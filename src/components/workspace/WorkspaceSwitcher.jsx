import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon } from '../ui/NavIcons'

// Rendered via a portal into document.body rather than nested in the sidebar: the mobile drawer
// (.sidebar-wrap) is `position: fixed` with a `transform`, which — per the CSS spec — makes it the
// containing block for any `position: fixed` descendant. A popover nested inside it would then be
// positioned relative to the drawer instead of the viewport, and would additionally get clipped by
// the sidebar's `overflow-y: auto` (added so the drawer's nav list can scroll on short screens).
// Escaping to body sidesteps both problems on desktop and mobile alike.
export function WorkspaceSwitcher({ activeWorkspace, onSwitchWorkspace, workspaces = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const hasWorkspaces = workspaces.length > 0

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPopoverStyle({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 260),
    })
    setIsOpen(true)
  }

  function closePopover() {
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event) {
      if (triggerRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) {
        return
      }
      closePopover()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') closePopover()
    }

    // A stale position looks worse than a closed menu — the trigger can scroll (sidebar list) or
    // the viewport can resize (rotation) while the popover is open.
    function handleReposition() {
      closePopover()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [isOpen])

  function handleSelect(workspaceId) {
    if (workspaceId !== activeWorkspace?.id) {
      onSwitchWorkspace?.(workspaceId)
    }
    closePopover()
  }

  return (
    <div className="workspace-pill workspace-switcher">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Switch workspace"
        className="workspace-switcher-trigger"
        disabled={!hasWorkspaces}
        onClick={() => (isOpen ? closePopover() : openPopover())}
        ref={triggerRef}
        type="button"
      >
        <span className="workspace-avatar">{(activeWorkspace?.name || 'W').charAt(0).toUpperCase()}</span>
        <div>
          {hasWorkspaces ? (
            <>
              <strong>{activeWorkspace?.name}</strong>
              <span>{activeWorkspace?.memberCount ?? 1} member{activeWorkspace?.memberCount === 1 ? '' : 's'}</span>
            </>
          ) : (
            <strong>Loading workspace…</strong>
          )}
        </div>
        {hasWorkspaces && (
          <ChevronDownIcon aria-hidden="true" className={`workspace-switcher-chevron${isOpen ? ' open' : ''}`} />
        )}
      </button>

      {isOpen &&
        popoverStyle &&
        createPortal(
          <div
            className="workspace-switcher-popover"
            ref={popoverRef}
            role="menu"
            style={{ top: popoverStyle.top, left: popoverStyle.left, width: popoverStyle.width }}
          >
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspace?.id
              return (
                <button
                  aria-checked={isActive}
                  className={`workspace-switcher-option${isActive ? ' active' : ''}`}
                  key={workspace.id}
                  onClick={() => handleSelect(workspace.id)}
                  role="menuitemradio"
                  type="button"
                >
                  <span className="workspace-avatar workspace-switcher-option-avatar">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="workspace-switcher-option-text">
                    <strong>{workspace.name}</strong>
                    <small>{workspace.memberCount ?? 1} member{workspace.memberCount === 1 ? '' : 's'}</small>
                  </span>
                  {isActive && <CheckIcon aria-hidden="true" className="workspace-switcher-option-check" />}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
