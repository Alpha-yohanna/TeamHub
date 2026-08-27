import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { MetricsGrid } from '../../components/dashboard/MetricsGrid'
import { WorkspaceActivityChart } from '../../components/dashboard/WorkspaceActivityChart'
import { RecentActivityList } from '../../components/dashboard/RecentActivityList'
import { MyWorkPanel } from '../../components/dashboard/MyWorkPanel'
import {
  CheckCircleIcon,
  ChecklistIcon,
  FilesIcon,
  MessagesIcon,
  ProjectsIcon,
  TeamsIcon,
  UsersIcon,
} from '../../components/ui/NavIcons'
import { timeAgo } from '../../lib/formatters'
import { getWeeklyActivityCounts, listActivity } from '../../services/activityService'
import { listRecentFiles } from '../../services/fileService'
import { listConversations, listRecentWorkspaceMessages } from '../../services/messageService'
import { getWorkspaceProjectStats, listMyProjects } from '../../services/projectService'
import { listMyAssignedTasks, listUpcomingDeadlines } from '../../services/taskService'
import { acceptInvitation, declineInvitation, getWorkspaceStats, listMyPendingInvitations } from '../../services/workspaceService'

function greetingForHour(hour) {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function AdminDashboard({
  authSource,
  currentUser,
  onNavigate,
  onWorkspacesChanged,
  role,
  workspace,
}) {
  const isLive = authSource === 'supabase'
  const effectiveRole = isLive ? workspace?.role : role
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'owner'
  const [stats, setStats] = useState(null)
  const [projectStats, setProjectStats] = useState(null)
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [recentMessages, setRecentMessages] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [myProjects, setMyProjects] = useState([])
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([])
  const [myInvitations, setMyInvitations] = useState([])
  const [isLoading, setIsLoading] = useState(isLive)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLive || !workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    Promise.all([
      getWorkspaceStats(workspace.id),
      getWorkspaceProjectStats(workspace.id),
      getWeeklyActivityCounts(workspace.id),
      listActivity(workspace.id, 6),
      listRecentWorkspaceMessages(workspace.id, 5),
      listRecentFiles(workspace.id, 5),
      listMyAssignedTasks(workspace.id, currentUser.id, 5),
      listMyProjects(workspace.id, currentUser.id, 5),
      listConversations(workspace.id, currentUser.id),
      listUpcomingDeadlines(workspace.id, 5),
      listMyPendingInvitations(currentUser.email),
    ])
      .then(
        ([
          statsResult,
          projectStatsResult,
          weeklyActivityResult,
          activityResult,
          messagesResult,
          filesResult,
          myTasksResult,
          myProjectsResult,
          conversationsResult,
          upcomingResult,
          myInvitesResult,
        ]) => {
          if (!isMounted) return
          setStats(statsResult)
          setProjectStats(projectStatsResult)
          setWeeklyActivity(weeklyActivityResult)
          setRecentActivity(activityResult)
          setRecentMessages(messagesResult)
          setRecentFiles(filesResult)
          setMyTasks(myTasksResult)
          setMyProjects(myProjectsResult)
          setUnreadMessageCount(conversationsResult.reduce((sum, conversation) => sum + conversation.unreadCount, 0))
          setUpcomingDeadlines(upcomingResult)
          setMyInvitations(myInvitesResult)
        }
      )
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isLive, workspace?.id, currentUser.email, currentUser.id])

  async function handleAcceptMyInvite(invitationId) {
    setError('')
    try {
      await acceptInvitation(invitationId)
      setMyInvitations((prev) => prev.filter((invite) => invite.id !== invitationId))
      await onWorkspacesChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeclineMyInvite(invitationId) {
    setError('')
    try {
      await declineInvitation(invitationId)
      setMyInvitations((prev) => prev.filter((invite) => invite.id !== invitationId))
    } catch (err) {
      setError(err.message)
    }
  }

  const showLoading = isLive && isLoading

  const adminMetrics =
    stats && projectStats
      ? [
          { key: 'members', label: 'Members', value: stats.memberCount, Icon: UsersIcon, tone: 'primary', onClick: () => onNavigate?.('settings') },
          { key: 'teams', label: 'Teams', value: stats.teamCount, Icon: TeamsIcon, tone: 'primary', onClick: () => onNavigate?.('teams') },
          { key: 'projects', label: 'Projects', value: projectStats.projectCount, Icon: ProjectsIcon, tone: 'primary', onClick: () => onNavigate?.('projects') },
          { key: 'active-projects', label: 'Active projects', value: projectStats.activeProjectCount, Icon: CheckCircleIcon, tone: 'success', onClick: () => onNavigate?.('projects') },
          { key: 'open-tasks', label: 'Open tasks', value: projectStats.openTaskCount, Icon: ChecklistIcon, tone: 'primary', onClick: () => onNavigate?.('projects') },
          { key: 'completed-tasks', label: 'Completed tasks', value: projectStats.completedTaskCount, Icon: CheckCircleIcon, tone: 'success', onClick: () => onNavigate?.('projects') },
          { key: 'files', label: 'Files shared', value: stats.fileCount, Icon: FilesIcon, tone: 'primary', onClick: () => onNavigate?.('files') },
          { key: 'messages', label: 'Messages', value: stats.messageCount, Icon: MessagesIcon, tone: 'primary', onClick: () => onNavigate?.('messages') },
        ]
      : []

  const memberMetrics = [
    { key: 'my-tasks', label: 'My open tasks', value: myTasks.length, Icon: ChecklistIcon, tone: 'primary', onClick: () => onNavigate?.('projects') },
    { key: 'my-projects', label: 'My active projects', value: myProjects.length, Icon: ProjectsIcon, tone: 'primary', onClick: () => onNavigate?.('projects') },
    { key: 'unread', label: 'Unread messages', value: unreadMessageCount, Icon: MessagesIcon, tone: 'primary', onClick: () => onNavigate?.('messages') },
    { key: 'recent-files', label: 'Recent files', value: recentFiles.length, Icon: FilesIcon, tone: 'primary', onClick: () => onNavigate?.('files') },
  ]

  const metrics = isAdmin ? adminMetrics : memberMetrics
  const firstName = (currentUser?.name || '').split(' ')[0] || 'there'
  const timeOfDay = greetingForHour(new Date().getHours())

  return (
    <section className="dashboard-page admin-dashboard-page" aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{isAdmin ? 'Admin dashboard' : 'Your workspace'}</p>
          <h1 id="dashboard-title">
            {isAdmin ? 'Workspace control center' : `Good ${timeOfDay}, ${firstName}`}
          </h1>
          <p>
            {isAdmin
              ? 'Review users, workspace activity, shared files, projects, tasks and team growth from one screen.'
              : "Here's what's happening in your workspace."}
          </p>
        </div>
        {isAdmin && (
          <span className="role-pill">
            {isLive && effectiveRole ? `${effectiveRole.charAt(0).toUpperCase()}${effectiveRole.slice(1)} view` : 'Admin view'}
          </span>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isLive && !workspace && !isLoading && <p className="eyebrow">No workspace found yet.</p>}

      {isLive && myInvitations.length > 0 && (
        <article className="panel-card invite-banner">
          <div className="panel-header">
            <h2>Workspace invitations for you</h2>
          </div>
          <div className="user-list">
            {myInvitations.map((invite) => (
              <div className="user-row" key={invite.id}>
                <div>
                  <strong>{invite.workspaces?.name ?? 'A workspace'}</strong>
                  <span>
                    Invited by {invite.profiles?.full_name ?? 'a teammate'} · {timeAgo(invite.created_at)}
                  </span>
                </div>
                <div className="row-actions">
                  <Button onClick={() => handleAcceptMyInvite(invite.id)} type="button">
                    Accept
                  </Button>
                  <button className="text-button danger" onClick={() => handleDeclineMyInvite(invite.id)} type="button">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      <MetricsGrid isLoading={showLoading} metrics={metrics} />

      {isLive && <WorkspaceActivityChart data={weeklyActivity} onViewAll={() => onNavigate?.('activity')} />}

      <div className="dashboard-grid">
        <RecentActivityList isLoading={showLoading} items={recentActivity} />
        <MyWorkPanel
          isLoading={showLoading}
          myProjects={myProjects}
          myTasks={myTasks}
          onNavigate={onNavigate}
          recentFiles={recentFiles}
          unreadMessageCount={unreadMessageCount}
        />
      </div>

      {isLive && isAdmin && (
        <div className="dashboard-grid">
          <article className="panel-card">
            <div className="panel-header">
              <h2>Recent messages</h2>
            </div>
            {isLoading ? (
              <p className="empty-state-inline">Loading…</p>
            ) : recentMessages.length === 0 ? (
              <p className="empty-state-inline">No messages yet.</p>
            ) : (
              <div className="activity-list">
                {recentMessages.map((message) => (
                  <div className="activity-item" key={message.id}>
                    <span className="feature-dot" aria-hidden="true" />
                    <p>
                      <strong>{message.profiles?.full_name ?? 'Someone'}</strong> in #{message.channels?.name ?? 'channel'}:{' '}
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="panel-card">
            <div className="panel-header">
              <h2>Upcoming deadlines</h2>
            </div>
            {isLoading ? (
              <p className="empty-state-inline">Loading…</p>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="empty-state-inline">No upcoming deadlines.</p>
            ) : (
              <div className="user-list">
                {upcomingDeadlines.map((task) => (
                  <div className="user-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>
                        {task.projectName ?? 'Project'} · {task.assignee?.full_name ?? 'Unassigned'}
                      </span>
                    </div>
                    <em>{task.due_date}</em>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  )
}
