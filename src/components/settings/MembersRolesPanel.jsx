import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { timeAgo } from '../../lib/formatters'
import { logActivity } from '../../services/activityService'
import {
  inviteToWorkspace,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  revokeInvitation,
  updateMemberRole,
} from '../../services/workspaceService'

const MEMBER_ROLE_OPTIONS = ['admin', 'manager', 'member']

// Presentation layer only — every action here calls the exact same service functions
// AdminDashboard's "User management" panel uses, so member/role/invite logic lives in one place
// even though it now has two surfaces (Dashboard and Settings > Members & Roles).
export function MembersRolesPanel({ currentUser, isAdmin, workspace }) {
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    Promise.all([listWorkspaceMembers(workspace.id), isAdmin ? listWorkspaceInvitations(workspace.id) : Promise.resolve([])])
      .then(([memberList, inviteList]) => {
        if (!isMounted) return
        setMembers(memberList)
        setInvitations(inviteList)
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
  }, [workspace?.id, isAdmin])

  async function handleInvite(event) {
    event.preventDefault()
    if (!inviteEmail.trim() || !workspace?.id) return
    setError('')
    setInviteMessage('')

    try {
      const invite = await inviteToWorkspace({ workspaceId: workspace.id, email: inviteEmail.trim(), invitedBy: currentUser.id })
      setInviteMessage(invite.emailSent ? `Invite email sent to ${inviteEmail.trim()}.` : `Invitation saved for ${inviteEmail.trim()}.`)
      setInvitations((prev) => [invite, ...prev])
      const invitedEmail = inviteEmail.trim()
      setInviteEmail('')
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'member.invited',
        targetType: 'member',
        metadata: { name: invitedEmail },
      })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRevoke(invitationId) {
    setError('')
    try {
      await revokeInvitation(invitationId)
      setInvitations((prev) => prev.filter((invite) => invite.id !== invitationId))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRoleChange(member, nextRole) {
    setError('')
    try {
      await updateMemberRole({ membershipId: member.membershipId, role: nextRole })
      setMembers((prev) => prev.map((item) => (item.membershipId === member.membershipId ? { ...item, workspaceRole: nextRole } : item)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.full_name} from ${workspace?.name}?`)) return
    setError('')
    try {
      await removeWorkspaceMember(member.membershipId)
      setMembers((prev) => prev.filter((item) => item.membershipId !== member.membershipId))
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

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <article className="panel-card">
        <div className="panel-header">
          <h2>Members</h2>
          {isAdmin && (
            <button className="small-action" onClick={() => setIsInviting((open) => !open)} type="button">
              {isInviting ? 'Cancel' : 'Invite member'}
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

        <div className="user-list" style={{ marginTop: '0.75rem' }}>
          {isLoading ? (
            <p className="empty-state-inline">Loading members…</p>
          ) : (
            members.map((member) => (
              <div className="user-row" key={member.id}>
                <span className="avatar">{(member.full_name || member.username || '?').slice(0, 2).toUpperCase()}</span>
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
                    <button className="text-button danger" onClick={() => handleRemove(member)} type="button">
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

      {isAdmin && (
        <article className="panel-card">
          <div className="panel-header">
            <h2>Pending invitations</h2>
          </div>
          {invitations.length === 0 ? (
            <p className="empty-state-inline">No pending invitations.</p>
          ) : (
            <div className="user-list">
              {invitations.map((invite) => (
                <div className="user-row" key={invite.id}>
                  <div>
                    <strong>{invite.email}</strong>
                    <span>
                      Invited {timeAgo(invite.created_at)} · {invite.role}
                    </span>
                  </div>
                  <button className="text-button danger" onClick={() => handleRevoke(invite.id)} type="button">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </div>
  )
}
