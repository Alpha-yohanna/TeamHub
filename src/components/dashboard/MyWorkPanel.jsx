import { formatFileSize } from '../../services/fileService'
import { timeAgo } from '../../lib/formatters'

export function MyWorkPanel({ isLoading, myTasks, myProjects, unreadMessageCount, recentFiles, onNavigate }) {
  return (
    <article className="panel-card my-work-card">
      <div className="panel-header">
        <h2>My work</h2>
      </div>

      <div className="my-work-section">
        <div className="my-work-section-heading">
          <h3>My open tasks</h3>
          {onNavigate && (
            <button className="text-button" onClick={() => onNavigate('projects')} type="button">
              View all
            </button>
          )}
        </div>
        {isLoading ? (
          <p className="empty-state-inline">Loading…</p>
        ) : myTasks.length === 0 ? (
          <p className="empty-state-inline">Nothing assigned to you right now.</p>
        ) : (
          <div className="user-list">
            {myTasks.map((task) => (
              <div className="user-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.projectName ?? 'Project'}</span>
                </div>
                <em>{task.due_date ?? 'No due date'}</em>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="my-work-section">
        <div className="my-work-section-heading">
          <h3>My active projects</h3>
        </div>
        {isLoading ? (
          <p className="empty-state-inline">Loading…</p>
        ) : myProjects.length === 0 ? (
          <p className="empty-state-inline">You're not on any active projects yet.</p>
        ) : (
          <div className="user-list">
            {myProjects.map((project) => (
              <div className="user-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.due_date ? `Due ${project.due_date}` : 'No due date'}</span>
                </div>
                <em>{project.status}</em>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="my-work-quick-stats">
        <button
          className="my-work-quick-stat"
          disabled={!onNavigate}
          onClick={() => onNavigate?.('messages')}
          type="button"
        >
          <span>Unread messages</span>
          <strong>{isLoading ? '—' : unreadMessageCount}</strong>
        </button>
        <button
          className="my-work-quick-stat"
          disabled={!onNavigate}
          onClick={() => onNavigate?.('files')}
          type="button"
        >
          <span>Recent files</span>
          <strong>{isLoading ? '—' : recentFiles.length}</strong>
        </button>
      </div>

      {!isLoading && recentFiles.length > 0 && (
        <div className="user-list">
          {recentFiles.slice(0, 3).map((file) => (
            <div className="user-row" key={file.id}>
              <span className="avatar">{file.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{file.name}</strong>
                <span>{formatFileSize(file.size_bytes)}</span>
              </div>
              <em>{timeAgo(file.created_at)}</em>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
