import { useEffect, useMemo, useRef, useState } from 'react'
import { timeAgo } from '../../lib/formatters'
import { addRecentSearch, clearRecentSearches, getRecentSearches, searchWorkspace } from '../../services/searchService'
import { formatFileSize } from '../../services/fileService'
import { SearchIcon } from '../ui/NavIcons'

const GROUPS = [
  { key: 'messages', label: 'Messages' },
  { key: 'people', label: 'People' },
  { key: 'files', label: 'Files' },
  { key: 'teams', label: 'Teams' },
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'Tasks' },
]

function targetFor(groupKey, item) {
  switch (groupKey) {
    case 'messages':
      return { type: 'channel', id: item.channel_id, metadata: {} }
    case 'people':
      return { type: 'member', id: item.id, metadata: {} }
    case 'files':
      return { type: 'file', id: item.id, metadata: {} }
    case 'teams':
      return { type: 'team', id: item.id, metadata: {} }
    case 'projects':
      return { type: 'project', id: item.id, metadata: {} }
    case 'tasks':
      return { type: 'task', id: item.id, metadata: { projectId: item.projectId } }
    default:
      return null
  }
}

function ResultRow({ groupKey, isActive, item, onSelect, rowRef }) {
  let title, context

  if (groupKey === 'messages') {
    title = item.profiles?.full_name ?? 'Someone'
    context = `${item.content} · ${item.channels?.type === 'channel' ? '#' : ''}${item.channels?.name ?? 'conversation'} · ${timeAgo(item.created_at)}`
  } else if (groupKey === 'people') {
    title = item.full_name
    context = item.email ?? item.username ?? ''
  } else if (groupKey === 'files') {
    title = item.name
    context = `${formatFileSize(item.size_bytes ?? 0)} · ${item.folderName ?? 'Root'} · ${item.profiles?.full_name ?? 'Unknown'}`
  } else if (groupKey === 'teams') {
    title = item.name
    context = `${item.description ?? 'No description'} · ${item.memberCount} member${item.memberCount === 1 ? '' : 's'}`
  } else if (groupKey === 'projects') {
    title = item.name
    context = `${item.status} · ${item.teamName ?? 'No team'}`
  } else if (groupKey === 'tasks') {
    title = item.title
    context = `${item.status} · ${item.assignee?.full_name ?? 'Unassigned'} · ${item.projectName ?? 'Project'}`
  }

  return (
    <div
      className={`search-result-row${isActive ? ' active' : ''}`}
      onClick={() => onSelect(groupKey, item)}
      onMouseEnter={(event) => event.currentTarget.focus()}
      ref={isActive ? rowRef : null}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
    >
      <strong>{title}</strong>
      <span>{context}</span>
    </div>
  )
}

export function GlobalSearch({ onClose, onNavigate, workspace }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches())
  const inputRef = useRef(null)
  const activeRowRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || !workspace?.id) {
      setResults(null)
      setError('')
      return
    }

    let isMounted = true
    setIsLoading(true)
    const timeoutId = setTimeout(() => {
      searchWorkspace(workspace.id, trimmed)
        .then((data) => {
          if (!isMounted) return
          setResults(data)
          setError(data.hasError ? 'Some results may be incomplete.' : '')
          setActiveIndex(0)
        })
        .catch((err) => {
          if (isMounted) setError(err.message)
        })
        .finally(() => {
          if (isMounted) setIsLoading(false)
        })
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [query, workspace?.id])

  const flatResults = useMemo(() => {
    if (!results) return []
    return GROUPS.flatMap((group) => (results[group.key] ?? []).map((item) => ({ groupKey: group.key, item })))
  }, [results])

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleSelect(groupKey, item) {
    const target = targetFor(groupKey, item)
    addRecentSearch(query)
    setRecentSearches(getRecentSearches())
    if (target?.id) {
      onNavigate?.({ target_type: target.type, target_id: target.id, metadata: target.metadata })
    }
    onClose?.()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      onClose?.()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, flatResults.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const entry = flatResults[activeIndex]
      if (entry) handleSelect(entry.groupKey, entry.item)
    }
  }

  const trimmedQuery = query.trim()
  const hasAnyResults = flatResults.length > 0
  let rowCursor = -1

  return (
    <div className="modal-backdrop search-modal-backdrop" onClick={onClose}>
      <div className="global-search-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Search TeamHub" aria-modal="true">
        <div className="global-search-input-row">
          <SearchIcon aria-hidden="true" className="global-search-icon" height="18" width="18" />
          <input
            aria-label="Search messages, files, people, teams, projects, tasks"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages, files, people, teams, projects, tasks…"
            ref={inputRef}
            value={query}
          />
          <button aria-label="Close search" className="task-modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="global-search-results" role="listbox" aria-label="Search results">
          {!trimmedQuery ? (
            <div className="global-search-recent">
              <div className="panel-header">
                <p className="sidebar-group-label">Recent searches</p>
                {recentSearches.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => {
                      clearRecentSearches()
                      setRecentSearches([])
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <p className="empty-state-inline">Start typing to search {workspace?.name ?? 'your workspace'}.</p>
              ) : (
                recentSearches.map((entry) => (
                  <button className="search-recent-chip" key={entry} onClick={() => setQuery(entry)} type="button">
                    {entry}
                  </button>
                ))
              )}
            </div>
          ) : isLoading && !results ? (
            <p className="empty-state-inline">Searching…</p>
          ) : error && !hasAnyResults ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : !hasAnyResults ? (
            <p className="empty-state-inline">No results for "{trimmedQuery}".</p>
          ) : (
            <>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {GROUPS.map((group) => {
                const items = results?.[group.key] ?? []
                if (items.length === 0) return null
                return (
                  <div className="global-search-group" key={group.key}>
                    <p className="sidebar-group-label">{group.label}</p>
                    {items.map((item) => {
                      rowCursor += 1
                      const index = rowCursor
                      return (
                        <ResultRow
                          groupKey={group.key}
                          isActive={index === activeIndex}
                          item={item}
                          key={item.id ?? index}
                          onSelect={handleSelect}
                          rowRef={activeRowRef}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
