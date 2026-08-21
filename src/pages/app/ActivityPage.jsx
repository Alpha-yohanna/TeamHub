import { useEffect, useMemo, useState } from 'react'
import { timeAgo } from '../../lib/formatters'
import { ACTIVITY_CATEGORIES, describeActivity, listActivity } from '../../services/activityService'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'teams', label: 'Teams' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'messages', label: 'Messages' },
  { id: 'files', label: 'Files' },
  { id: 'members', label: 'Members' },
]

function initialsFor(name) {
  return (name || '?').slice(0, 2).toUpperCase()
}

export function ActivityPage({ onNavigateToNotificationTarget, workspace }) {
  const [activity, setActivity] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    listActivity(workspace.id, 100, { targetTypes: ACTIVITY_CATEGORIES[activeTab] })
      .then((entries) => {
        if (isMounted) setActivity(entries)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [workspace?.id, activeTab])

  const visibleActivity = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return activity

    return activity.filter((entry) => {
      const actor = entry.profiles?.full_name || entry.profiles?.username || ''
      const description = describeActivity(entry)
      const dateText = new Date(entry.created_at).toLocaleDateString()
      return (
        actor.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        (entry.metadata?.name || '').toLowerCase().includes(query) ||
        dateText.toLowerCase().includes(query)
      )
    })
  }, [activity, search])

  function handleEntryClick(entry) {
    if (!entry.target_type || !entry.target_id) return
    onNavigateToNotificationTarget?.(entry)
  }

  if (!workspace) {
    return <p className="eyebrow">No workspace found yet.</p>
  }

  return (
    <section className="dashboard-page" aria-labelledby="activity-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 id="activity-title">Activity</h1>
          <p>A timeline of what's happened in your workspace.</p>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <nav className="team-tabs" aria-label="Activity filter">
        {TABS.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="task-modal-field" style={{ margin: '0.75rem 0 1rem', maxWidth: '360px' }}>
        <input
          aria-label="Search activity"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by person, resource, or date…"
          type="search"
          value={search}
        />
      </div>

      <article className="panel-card">
        {isLoading ? (
          <p className="empty-state-inline">Loading activity…</p>
        ) : visibleActivity.length === 0 ? (
          <p className="empty-state-inline">{search ? 'No activity matches your search.' : 'No activity yet.'}</p>
        ) : (
          <div className="activity-list">
            {visibleActivity.map((entry) => {
              const isClickable = Boolean(entry.target_type && entry.target_id)
              return (
                <div
                  className={`activity-item${isClickable ? ' notification-row' : ''}`}
                  key={entry.id}
                  onClick={isClickable ? () => handleEntryClick(entry) : undefined}
                  onKeyDown={
                    isClickable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleEntryClick(entry)
                          }
                        }
                      : undefined
                  }
                  role={isClickable ? 'button' : undefined}
                  style={isClickable ? { cursor: 'pointer' } : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
                  <span className="avatar" title={entry.profiles?.full_name || 'Someone'}>
                    {initialsFor(entry.profiles?.full_name || entry.profiles?.username)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p>{describeActivity(entry)}</p>
                    <small>{timeAgo(entry.created_at)}</small>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </article>
    </section>
  )
}
