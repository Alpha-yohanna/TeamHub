import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/formatters'
import { describeActivity, listActivity, logActivity } from '../../services/activityService'
import { formatFileSize, listRecentFiles } from '../../services/fileService'
import { listRecentWorkspaceMessages } from '../../services/messageService'
import { getWorkspaceProjectStats } from '../../services/projectService'
import { listMyAssignedTasks, listUpcomingDeadlines } from '../../services/taskService'
import {
  acceptInvitation,
  declineInvitation,
  getWorkspaceStats,
  inviteToWorkspace,
  listMyPendingInvitations,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  revokeInvitation,
  updateMemberRole,
} from '../../services/workspaceService'

const MEMBER_ROLE_OPTIONS = ['admin', 'manager', 'member']

export function AdminDashboard({
  authSource,
  currentUser,
  onWorkspacesChanged,
  onlineUserIds = new Set(),
  role,
  workspace,
}) {
  const isLive = authSource === 'supabase'
  const effectiveRole = isLive ? workspace?.role : role
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'owner'
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState(null)
  const [projectStats, setProjectStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [recentMessages, setRecentMessages] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([])
  const [sentInvitations, setSentInvitations] = useState([])
  const [myInvitations, setMyInvitations] = useState([])
  const [isLoading, setIsLoading] = useState(isLive)
  const [error, setError] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')

  useEffect(() => {
    if (!isLive || !workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    Promise.all([
      listWorkspaceMembers(workspace.id),
      getWorkspaceStats(workspace.id),
      getWorkspaceProjectStats(workspace.id),
      listActivity(workspace.id, 5),
      listRecentWorkspaceMessages(workspace.id, 5),
      listRecentFiles(workspace.id, 5),
      listMyAssignedTasks(workspace.id, currentUser.id, 5),
      listUpcomingDeadlines(workspace.id, 5),
      listMyPendingInvitations(currentUser.email),
    ])
      .then(
        ([
          membersResult,
          statsResult,
          projectStatsResult,
          activityResult,
          messagesResult,
          filesResult,
          myTasksResult,
          upcomingResult,
          myInvitesResult,
        ]) => {
          if (!isMounted) return
          setMembers(membersResult)
          setStats(statsResult)
          setProjectStats(projectStatsResult)
          setRecentActivity(activityResult)
          setRecentMessages(messagesResult)
          setRecentFiles(filesResult)
          setMyTasks(myTasksResult)
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

  useEffect(() => {
    if (!isLive || !isAdmin || !workspace?.id) {
      setSentInvitations([])
      return
    }

    let isMounted = true
    listWorkspaceInvitations(workspace.id)
      .then((result) => {
        if (isMounted) setSentInvitations(result)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    return () => {
      isMounted = false
    }
  }, [isLive, isAdmin, workspace?.id])

  async function handleInvite(event) {
    event.preventDefault()
    if (!inviteEmail.trim() || !workspace?.id) return
    setError('')
    setInviteMessage('')

    try {
      const invite = await inviteToWorkspace({
        workspaceId: workspace.id,
        email: inviteEmail.trim(),
        invitedBy: currentUser.id,
      })
      setInviteMessage(
        invite.emailSent
          ? `Invite email sent to ${inviteEmail.trim()}.`
          : `Invitation saved for ${inviteEmail.trim()}, but the email couldn't be sent. They'll still join automatically once they accept.`
      )
      setSentInvitations((prev) => [invite, ...prev])
      setStats((prev) => (prev ? { ...prev, pendingInviteCount: prev.pendingInviteCount + 1 } : prev))
      setInviteEmail('')
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'member.invited',
        targetType: 'member',
        metadata: { name: inviteEmail.trim() },
      })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRevokeInvite(invitationId) {
    setError('')
    try {
      await revokeInvitation(invitationId)
      setSentInvitations((prev) => prev.filter((invite) => invite.id !== invitationId))
      setStats((prev) => (prev ? { ...prev, pendingInviteCount: Math.max(0, prev.pendingInviteCount - 1) } : prev))
    } catch (err) {
      setError(err.message)
    }
  }

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

  async function handleRoleChange(member, nextRole) {
    setError('')
    try {
      await updateMemberRole({ membershipId: member.membershipId, role: nextRole })
      setMembers((prev) =>
        prev.map((item) => (item.membershipId === member.membershipId ? { ...item, workspaceRole: nextRole } : item))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.full_name} from ${workspace?.name}?`)) return
    setError('')

    try {
      await removeWorkspaceMember(member.membershipId)
      setMembers((prev) => prev.filter((item) => item.membershipId !== member.membershipId))
      setStats((prev) => (prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev))
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'member.removed',
        targetType: 'member',
        targetId: member.id,
        metadata: { name: member.full_name },
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const displayStats =
    stats && projectStats
      ? [
          { label: 'Members', value: stats.memberCount },
          { label: 'Teams', value: stats.teamCount },
          { label: 'Projects', value: projectStats.projectCount },
          { label: 'Active projects', value: projectStats.activeProjectCount },
          { label: 'Open tasks', value: projectStats.openTaskCount },
          { label: 'Completed tasks', value: projectStats.completedTaskCount },
          { label: 'Files shared', value: stats.fileCount },
          { label: 'Messages', value: stats.messageCount },
          { label: 'Pending invites', value: stats.pendingInviteCount },
        ]
      : []

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{isAdmin ? 'Admin dashboard' : 'Member dashboard'}</p>
          <h1 id="dashboard-title">
            {isAdmin ? 'Workspace control center' : 'Your TeamHub workspace'}
          </h1>
          <p>
            {isAdmin
              ? 'Review users, workspace activity, shared files, and team growth from one screen.'
              : 'See your team updates, messages, files, and upcoming work.'}
          </p>
        </div>
        <span className="role-pill">
          {isLive && effectiveRole
            ? `${effectiveRole.charAt(0).toUpperCase()}${effectiveRole.slice(1)} view`
            : isAdmin
              ? 'Admin view'
              : 'Member view'}
        </span>
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
                  <button
                    className="text-button danger"
                    onClick={() => handleDeclineMyInvite(invite.id)}
                    type="button"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      <div className="stats-grid">
        {isLive && isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <article className="stat-card skeleton-card" key={index} aria-hidden="true" />
            ))
          : displayStats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.change && <small>{stat.change}</small>}
              </article>
            ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel-card">
          <div className="panel-header">
            <h2>Recent activity</h2>
          </div>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <p className="empty-state-inline">No activity yet.</p>
            ) : (
              recentActivity.map((entry) => (
                <div className="activity-item" key={entry.id}>
                  <span className="feature-dot" aria-hidden="true" />
                  <p>{describeActivity(entry)}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <h2>{isAdmin ? 'User management' : 'Team members'}</h2>
            {isAdmin && isLive && workspace && (
              <button className="small-action" onClick={() => setIsInviting((open) => !open)} type="button">
                {isInviting ? 'Cancel' : 'Invite user'}
              </button>
            )}
          </div>

          {isInviting && (
            <form className="inline-form" onSubmit={handleInvite}>
              <input
                aria-label="Email to invite"
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@company.com"
                required
                type="email"
                value={inviteEmail}
              />
              <Button type="submit">Send invite</Button>
            </form>
          )}

          {inviteMessage && <p className="auth-note">{inviteMessage}</p>}

          <div className="user-list">
            {isLoading ? (
              <p className="empty-state-inline">Loading members…</p>
            ) : members.length === 0 ? (
              <p className="empty-state-inline">No members yet.</p>
            ) : (
              members.map((member) => (
                <div className="user-row" key={member.id}>
                  <span className="avatar-wrap">
                    <span className="avatar">
                      {(member.full_name || member.username || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <span className={`status-dot${onlineUserIds.has(member.id) ? ' online' : ''}`} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{member.full_name}</strong>
                    <span>{member.username}</span>
                  </div>
                  {isAdmin && member.workspaceRole !== 'owner' && member.id !== currentUser.id ? (
                    <div className="row-actions">
                      <select
                        aria-label={`Change role for ${member.full_name}`}
                        className="role-select"
                        onChange={(event) => handleRoleChange(member, event.target.value)}
                        value={member.workspaceRole}
                      >
                        {MEMBER_ROLE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-button danger"
                        onClick={() => handleRemoveMember(member)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <em>{member.workspaceRole}</em>
                  )}
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      {isLive && (
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
              <h2>Recent files</h2>
            </div>
            {isLoading ? (
              <p className="empty-state-inline">Loading…</p>
            ) : recentFiles.length === 0 ? (
              <p className="empty-state-inline">No files uploaded yet.</p>
            ) : (
              <div className="user-list">
                {recentFiles.map((file) => (
                  <div className="user-row" key={file.id}>
                    <span className="avatar">{file.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{file.name}</strong>
                      <span>
                        {formatFileSize(file.size_bytes)} · {file.profiles?.full_name || 'Unknown'}
                      </span>
                    </div>
                    <em>{timeAgo(file.created_at)}</em>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      )}

      {isLive && (
        <div className="dashboard-grid">
          <article className="panel-card">
            <div className="panel-header">
              <h2>My assigned tasks</h2>
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

      {isLive && isAdmin && (
        <article className="panel-card">
          <div className="panel-header">
            <h2>Pending invitations</h2>
          </div>
          {sentInvitations.length === 0 ? (
            <p className="empty-state-inline">No pending invitations.</p>
          ) : (
            <div className="user-list">
              {sentInvitations.map((invite) => (
                <div className="user-row" key={invite.id}>
                  <div>
                    <strong>{invite.email}</strong>
                    <span>Invited {timeAgo(invite.created_at)} · {invite.role}</span>
                  </div>
                  <button className="text-button danger" onClick={() => handleRevokeInvite(invite.id)} type="button">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </section>
  )
}
