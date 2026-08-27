import { timeAgo } from '../../lib/formatters'
import { describeActivity } from '../../services/activityService'

export function RecentActivityList({ items, isLoading }) {
  return (
    <article className="panel-card">
      <div className="panel-header">
        <h2>Recent activity</h2>
      </div>
      <div className="activity-list">
        {isLoading ? (
          <p className="empty-state-inline">Loading…</p>
        ) : items.length === 0 ? (
          <p className="empty-state-inline">No activity yet.</p>
        ) : (
          items.map((entry) => (
            <div className="activity-item" key={entry.id}>
              <span className="feature-dot" aria-hidden="true" />
              <div>
                <p>{describeActivity(entry)}</p>
                <span className="activity-item-time">{timeAgo(entry.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  )
}
