import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { CreateWorkspaceModal } from './components/workspace/CreateWorkspaceModal'
import { OnboardingFlow } from './components/onboarding/OnboardingFlow'
import { ActivityPage } from './pages/app/ActivityPage'
import { AdminDashboard } from './pages/app/AdminDashboard'
import { FilesPage } from './pages/app/FilesPage'
import { MessagesPage } from './pages/app/MessagesPage'
import { NotificationsPage } from './pages/app/NotificationsPage'
import { ProjectsPage } from './pages/app/ProjectsPage'
import { SettingsPage } from './pages/app/SettingsPage'
import { TeamsPage } from './pages/app/TeamsPage'
import { LoginPage } from './pages/public/LoginPage'
import { applyTheme } from './lib/theme'
import { getActiveSession, signOut } from './services/authService'
import { getUnreadNotificationCount, subscribeToNotifications } from './services/notificationService'
import { subscribeToWorkspacePresence } from './services/presenceService'
import { getUserPreferences, listMyWorkspaces, updateWorkspace } from './services/workspaceService'
import './App.css'

const SIGNUP_INTENT_STORAGE_KEY = 'teamhub-signup-intent'

// A "join a workspace" signup still gets the auto-provisioned personal workspace from
// handle_new_user() (the existing, unchanged signup trigger) — this marks it already-onboarded so
// the owner-setup wizard doesn't intercept someone who came here to accept an invitation, which
// the existing pending-invitations banner on the dashboard already surfaces by email match.
async function consumeSignupIntent(workspaceList) {
  let intent = null
  try {
    intent = localStorage.getItem(SIGNUP_INTENT_STORAGE_KEY)
    localStorage.removeItem(SIGNUP_INTENT_STORAGE_KEY)
  } catch {
    return false
  }
  if (intent !== 'join') return false

  const ownedUnfinished = workspaceList.find((workspace) => workspace.role === 'owner' && !workspace.onboarding_completed_at)
  if (!ownedUnfinished) return false

  try {
    await updateWorkspace(ownedUnfinished.id, { onboarding_completed_at: new Date().toISOString() })
    return true
  } catch {
    return false
  }
}

const appPages = {
  activity: ActivityPage,
  dashboard: AdminDashboard,
  files: FilesPage,
  messages: MessagesPage,
  notifications: NotificationsPage,
  projects: ProjectsPage,
  settings: SettingsPage,
  teams: TeamsPage,
}

export default function App() {
  const [page, setPage] = useState('login')
  const [role, setRole] = useState('admin')
  const [currentUser, setCurrentUser] = useState(null)
  const [authSource, setAuthSource] = useState('demo')
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [initialFocus, setInitialFocus] = useState(null)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const isAppPage = page !== 'login'

  async function loadWorkspaces(userId) {
    try {
      let list = await listMyWorkspaces(userId)
      const didConsumeIntent = await consumeSignupIntent(list)
      if (didConsumeIntent) {
        list = await listMyWorkspaces(userId)
      }
      setWorkspaces(list)
      setActiveWorkspaceId((current) => current ?? list[0]?.id ?? null)
      return list
    } catch {
      setWorkspaces([])
      return []
    }
  }

  async function refreshUnreadCount(userId, workspaceId) {
    try {
      setUnreadCount(await getUnreadNotificationCount(userId, workspaceId))
    } catch {
      setUnreadCount(0)
    }
  }

  async function applyStoredThemePreference(userId) {
    try {
      const preferences = await getUserPreferences(userId)
      applyTheme(preferences.theme || 'system')
    } catch {
      // Fall back to whatever initTheme() already applied from localStorage.
    }
  }

  useEffect(() => {
    let isMounted = true

    getActiveSession()
      .then(async (session) => {
        if (!isMounted || !session) {
          return
        }

        setRole(session.user.role)
        setCurrentUser(session.user)
        setAuthSource(session.source)
        setPage('dashboard')

        if (session.source === 'supabase') {
          await Promise.all([loadWorkspaces(session.user.id), applyStoredThemePreference(session.user.id)])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoringSession(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (authSource !== 'supabase' || !activeWorkspaceId || !currentUser?.id) {
      setOnlineUserIds(new Set())
      return
    }

    const unsubscribe = subscribeToWorkspacePresence(activeWorkspaceId, currentUser.id, setOnlineUserIds)
    return unsubscribe
  }, [activeWorkspaceId, authSource, currentUser?.id])

  // Notifications are scoped to the active workspace (Phase 8): switching workspaces re-fetches
  // the badge count and re-scopes which realtime events are allowed to move it.
  useEffect(() => {
    if (authSource !== 'supabase' || !currentUser?.id || !activeWorkspaceId) {
      setUnreadCount(0)
      return
    }

    refreshUnreadCount(currentUser.id, activeWorkspaceId)

    const unsubscribe = subscribeToNotifications(currentUser.id, {
      onInsert: (row) => {
        if (row.workspace_id === activeWorkspaceId) setUnreadCount((count) => count + 1)
      },
      onUpdate: (row) => {
        if (row.workspace_id === activeWorkspaceId && row.read_at) setUnreadCount((count) => Math.max(0, count - 1))
      },
    })
    return unsubscribe
  }, [authSource, currentUser?.id, activeWorkspaceId])

  async function handleLogin(session) {
    setRole(session.role)
    setCurrentUser(session.user)
    setAuthSource(session.source)
    setPage('dashboard')

    if (session.source === 'supabase') {
      await Promise.all([loadWorkspaces(session.user.id), applyStoredThemePreference(session.user.id)])
    }
  }

  function handleSwitchWorkspace(workspaceId) {
    setActiveWorkspaceId(workspaceId)
    setInitialFocus(null)
  }

  async function handleWorkspaceCreated(workspaceId) {
    await loadWorkspaces(currentUser.id)
    setActiveWorkspaceId(workspaceId)
  }

  async function handleLogout() {
    await signOut()
    setCurrentUser(null)
    setAuthSource('demo')
    setWorkspaces([])
    setActiveWorkspaceId(null)
    setUnreadCount(0)
    setPage('login')
  }

  function handleProfileUpdated(updates) {
    setCurrentUser((user) => (user ? { ...user, ...updates } : user))
  }

  function handleNotificationNavigate(notification) {
    const targetType = notification.target_type
    const targetId = notification.target_id
    if (!targetType || !targetId) return

    const pageByType = {
      team: 'teams',
      project: 'projects',
      task: 'projects',
      channel: 'messages',
      file: 'files',
      folder: 'files',
      member: 'dashboard',
      workspace: 'dashboard',
    }

    const nextPage = pageByType[targetType]
    if (!nextPage) return

    setInitialFocus({ type: targetType, id: targetId, metadata: notification.metadata ?? {} })
    setPage(nextPage)
  }

  if (isRestoringSession) {
    return null
  }

  if (!isAppPage) {
    return <LoginPage onLogin={handleLogin} />
  }

  const PageComponent = appPages[page]
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null
  const focusPageByType = {
    team: 'teams',
    project: 'projects',
    task: 'projects',
    channel: 'messages',
    file: 'files',
    folder: 'files',
    member: 'dashboard',
    workspace: 'dashboard',
  }
  const activeFocus = initialFocus && focusPageByType[initialFocus.type] === page ? initialFocus : null

  const showOnboarding =
    authSource === 'supabase' && activeWorkspace && activeWorkspace.role === 'owner' && !activeWorkspace.onboarding_completed_at

  return (
    <AppShell
      activePage={page}
      activeWorkspace={activeWorkspace}
      currentUser={currentUser}
      onCreateWorkspace={() => setIsCreatingWorkspace(true)}
      onNavigate={setPage}
      onNavigateToTarget={handleNotificationNavigate}
      onSwitchWorkspace={handleSwitchWorkspace}
      onlineUserIds={onlineUserIds}
      role={role}
      unreadCount={unreadCount}
      workspaces={workspaces}
    >
      {PageComponent ? (
        <PageComponent
          authSource={authSource}
          currentUser={currentUser}
          initialFocus={activeFocus}
          onFocusConsumed={() => setInitialFocus(null)}
          onLogout={handleLogout}
          onNavigateToNotificationTarget={handleNotificationNavigate}
          onNotificationsChanged={() => refreshUnreadCount(currentUser.id, activeWorkspaceId)}
          onProfileUpdated={handleProfileUpdated}
          onWorkspacesChanged={() => loadWorkspaces(currentUser.id)}
          onlineUserIds={onlineUserIds}
          role={role}
          workspace={activeWorkspace}
          workspaces={workspaces}
        />
      ) : (
        <p className="eyebrow">Coming soon.</p>
      )}

      {isCreatingWorkspace && (
        <CreateWorkspaceModal
          currentUser={currentUser}
          onClose={() => setIsCreatingWorkspace(false)}
          onCreated={handleWorkspaceCreated}
        />
      )}

      {!isCreatingWorkspace && showOnboarding && (
        <OnboardingFlow
          currentUser={currentUser}
          onComplete={() => loadWorkspaces(currentUser.id)}
          onWorkspaceUpdated={() => loadWorkspaces(currentUser.id)}
          workspace={activeWorkspace}
        />
      )}
    </AppShell>
  )
}
