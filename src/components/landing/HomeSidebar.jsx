import { TeamHubMark } from '../ui/Logo'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'
import {
  ActivityIcon,
  DashboardIcon,
  FilesIcon,
  MessagesIcon,
  NotificationsIcon,
  ProfileIcon,
  ProjectsIcon,
  SettingsIcon,
  SignOutIcon,
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
      { icon: ActivityIcon, label: 'Activity', page: 'activity' },
    ],
  },
  {
    title: 'Personal',
    items: [
      { icon: NotificationsIcon, label: 'Notifications', page: 'notifications' },
      { icon: SettingsIcon, label: 'Settings', page: 'settings' },
    ],
  },
  {
    title: 'Account',
    items: [{ icon: ProfileIcon, label: 'Profile', page: 'settings' }, { icon: SignOutIcon, label: 'Sign out', action: 'sign-out' }],
  },
]

export function HomeSidebar({
  activePage = 'dashboard',
  activeWorkspace,
  currentUser,
  mode = 'home',
  onCreateWorkspace,
  onNavigate,
  onSignOut,
  onSwitchWorkspace,
  onlineUserIds = new Set(),
  unreadCount = 0,
  workspaces = [],
}) {
  function handleNavigation(event, page) {
    event.preventDefault()
    onNavigate?.(page)
  }

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

      {mode === 'app' ? (
        <div className="workspace-switcher-actions">
          <WorkspaceSwitcher activeWorkspace={activeWorkspace} onSwitchWorkspace={onSwitchWorkspace} workspaces={workspaces} />
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
            {group.items.map((item) =>
              item.action === 'sign-out' ? (
                <button key={item.label} onClick={() => onSignOut?.()} type="button">
                  <span aria-hidden="true">
                    <item.icon />
                  </span>
                  {item.label}
                </button>
              ) : (
                <a
                  className={activePage === item.page ? 'active' : ''}
                  href={`#${item.page}`}
                  key={item.label}
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
              )
            )}
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
