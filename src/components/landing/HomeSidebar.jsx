import { TeamHubMark } from '../ui/Logo'
import {
  ActivityIcon,
  DashboardIcon,
  FilesIcon,
  MessagesIcon,
  NotificationsIcon,
  ProjectsIcon,
  SettingsIcon,
  TeamsIcon,
} from '../ui/NavIcons'

const sidebarGroups = [
  {
    title: 'Workspace',
    items: [
      { icon: DashboardIcon, label: 'Dashboard', page: 'dashboard' },
      { icon: MessagesIcon, label: 'Messages', page: 'messages' },
      { icon: TeamsIcon, label: 'Teams', page: 'teams' },
      { icon: ProjectsIcon, label: 'Projects', page: 'projects' },
      { icon: FilesIcon, label: 'Files', page: 'files' },
    ],
  },
  {
    title: 'Personal',
    items: [
      { icon: NotificationsIcon, label: 'Notifications', page: 'notifications' },
      { icon: ActivityIcon, label: 'Activity', page: 'activity' },
      { icon: SettingsIcon, label: 'Settings', page: 'settings' },
    ],
  },
]

export function HomeSidebar({
  activePage = 'dashboard',
  activeWorkspace,
  currentUser,
  mode = 'home',
  onCreateWorkspace,
  onNavigate,
  onSwitchWorkspace,
  onlineUserIds = new Set(),
  unreadCount = 0,
  workspaces = [],
}) {
  function handleNavigation(event, page) {
    event.preventDefault()
    onNavigate?.(page)
  }

  const isLiveApp = mode === 'app' && workspaces.length > 0

  return (
    <aside className="home-sidebar" aria-label="TeamHub home navigation">
      <a
        className="brand sidebar-brand"
        href="/"
        onClick={(event) => handleNavigation(event, mode === 'app' ? 'dashboard' : 'home')}
        aria-label="TeamHub home"
      >
        <span className="brand-mark">
          <TeamHubMark size={22} />
        </span>
        <span>TeamHub</span>
      </a>

      {isLiveApp ? (
        <div className="workspace-switcher-actions">
          <div className="workspace-pill workspace-switcher">
            <span className="workspace-avatar">{(activeWorkspace?.name || 'W').charAt(0).toUpperCase()}</span>
            <div>
              <select
                aria-label="Switch workspace"
                onChange={(event) => onSwitchWorkspace?.(event.target.value)}
                value={activeWorkspace?.id || ''}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <span>{activeWorkspace?.memberCount ?? 1} member{activeWorkspace?.memberCount === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button
            aria-label="Create workspace"
            className="workspace-switcher-new"
            onClick={onCreateWorkspace}
            title="Create workspace"
            type="button"
          >
            +
          </button>
        </div>
      ) : (
        <div className="workspace-pill">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Alpha Workspace</strong>
            <span>Team preview</span>
          </div>
        </div>
      )}

      <nav className="sidebar-nav" aria-label="Workspace preview navigation">
        {sidebarGroups.map((group) => (
          <div className="sidebar-group" key={group.title}>
            <p>{group.title}</p>
            {group.items.map((item) => (
              <a
                className={activePage === item.page ? 'active' : ''}
                href={`#${item.page}`}
                key={item.page}
                onClick={(event) => handleNavigation(event, item.page)}
              >
                <span aria-hidden="true">
                  <item.icon />
                </span>
                {item.label}
                {item.page === 'notifications' && unreadCount > 0 && (
                  <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <span className="avatar-wrap">
          <span className="avatar">{(currentUser?.name || currentUser?.email || 'AO').slice(0, 2).toUpperCase()}</span>
          {currentUser && (
            <span className={`status-dot${onlineUserIds.has(currentUser.id) ? ' online' : ''}`} aria-hidden="true" />
          )}
        </span>
        <div>
          <strong>{currentUser?.name || 'Alpha Okafor'}</strong>
          <span>{currentUser ? currentUser.email : 'Online'}</span>
        </div>
      </div>
    </aside>
  )
}
