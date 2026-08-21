import { useEffect, useState } from 'react'
import { timeAgo } from '../../lib/formatters'
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../../services/notificationService'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
]

function groupByDate(notifications) {
  const groups = new Map()
  const now = new Date()
  const todayKey = now.toDateString()
  const yesterdayKey = new Date(now.getTime() - 86400000).toDateString()

  for (const notification of notifications) {
    const date = new Date(notification.created_at)
    const dateKey = date.toDateString()
    const label = dateKey === todayKey ? 'Today' : dateKey === yesterdayKey ? 'Yesterday' : 'Earlier'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(notification)
  }

  return Array.from(groups.entries())
}

export function NotificationsPage({ currentUser, onFocusConsumed, onNavigateToNotificationTarget, onNotificationsChanged, workspace }) {
  const [notifications, setNotifications] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspace?.id) {
      setNotifications([])
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    listNotifications(currentUser.id, { readState: activeTab === 'all' ? undefined : activeTab, workspaceId: workspace.id })
      .then((data) => {
        if (isMounted) setNotifications(data)
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
  }, [currentUser.id, activeTab, workspace?.id])

  useEffect(() => {
    if (!workspace?.id) return

    const unsubscribe = subscribeToNotifications(currentUser.id, {
      onInsert: (row) => {
        if (row.workspace_id !== workspace.id) return
        if (activeTab === 'read') return
        setNotifications((prev) => (prev.some((item) => item.id === row.id) ? prev : [{ ...row, profiles: null }, ...prev]))
        onNotificationsChanged?.()
      },
      onUpdate: (row) => {
        if (row.workspace_id !== workspace.id) return
        setNotifications((prev) =>
          activeTab === 'all'
            ? prev.map((item) => (item.id === row.id ? { ...item, read_at: row.read_at } : item))
            : prev.filter((item) => item.id !== row.id)
        )
        onNotificationsChanged?.()
      },
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, activeTab, workspace?.id])

  async function handleClick(notification) {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((prev) =>
          activeTab === 'unread'
            ? prev.filter((item) => item.id !== notification.id)
            : prev.map((item) => (item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
        )
        onNotificationsChanged?.()
      } catch (err) {
        setError(err.message)
      }
    }

    onNavigateToNotificationTarget?.(notification)
  }

  async function handleMarkAllRead() {
    setError('')
    try {
      await markAllNotificationsRead(currentUser.id, workspace?.id)
      setNotifications((prev) =>
        activeTab === 'unread' ? [] : prev.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
      )
      onNotificationsChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(event, notification) {
    event.stopPropagation()
    try {
      await deleteNotification(notification.id)
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
      if (!notification.read_at) {
        onNotificationsChanged?.()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    return () => onFocusConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasUnread = notifications.some((notification) => !notification.read_at)
  const grouped = groupByDate(notifications)

  return (
    <section className="dashboard-page" aria-labelledby="notifications-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personal</p>
          <h1 id="notifications-title">Notifications</h1>
          <p>Mentions, task assignments, team invites, and workspace alerts.</p>
        </div>
        {hasUnread && (
          <button className="small-action" onClick={handleMarkAllRead} type="button">
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <nav className="team-tabs" aria-label="Notification filter" style={{ maxWidth: '320px' }}>
        {TABS.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </nav>

      <article className="panel-card">
        {isLoading ? (
          <p className="empty-state-inline">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <p className="empty-state-inline">
            {activeTab === 'unread' ? "You're all caught up." : 'No notifications yet.'}
          </p>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label} style={{ marginBottom: '1.25rem' }}>
              <p className="sidebar-group-label" style={{ color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                {label}
              </p>
              <div className="activity-list">
                {items.map((notification) => (
                  <div
                    className={`notification-row${notification.read_at ? '' : ' unread'}`}
                    key={notification.id}
                    onClick={() => handleClick(notification)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleClick(notification)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="feature-dot" aria-hidden="true" />
                    <div style={{ flex: 1 }}>
                      <strong>{notification.title}</strong>
                      {notification.message && <p>{notification.message}</p>}
                      <small>{timeAgo(notification.created_at)}</small>
                    </div>
                    <button className="text-button danger" onClick={(event) => handleDelete(event, notification)} type="button">
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </article>
    </section>
  )
}
