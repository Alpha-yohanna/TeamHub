import { useState } from 'react'
import { logActivity } from '../../services/activityService'
import { getShareableLink } from '../../services/fileService'
import { listTeamMembers } from '../../services/teamService'
import { createNotification } from '../../services/notificationService'
import { Button } from '../ui/Button'

export function ShareFileModal({ file, workspace, currentUser, workspaceMembers, teams, onClose }) {
  const [memberIds, setMemberIds] = useState([])
  const [teamId, setTeamId] = useState('')
  const [link, setLink] = useState(null)
  const [isSharing, setIsSharing] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [error, setError] = useState('')

  async function handleGetLink() {
    setError('')
    try {
      const url = await getShareableLink(file.storage_path)
      setLink(url)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCopyLink() {
    try {
      const url = link ?? (await getShareableLink(file.storage_path))
      setLink(url)
      await navigator.clipboard?.writeText(url)
      setCopyStatus('Link copied.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleShare(event) {
    event.preventDefault()
    if (memberIds.length === 0 && !teamId) return
    setIsSharing(true)
    setError('')

    try {
      const targets = []

      for (const memberId of memberIds) {
        if (memberId === currentUser.id) continue
        await createNotification({
          workspaceId: workspace.id,
          userId: memberId,
          actorId: currentUser.id,
          type: 'file_shared',
          title: `${currentUser.name} shared a file with you`,
          message: file.name,
          targetType: 'file',
          targetId: file.id,
        })
        const member = workspaceMembers.find((m) => m.id === memberId)
        targets.push(member?.full_name ?? 'a member')
      }

      if (teamId) {
        const team = teams.find((t) => t.id === teamId)
        const members = await listTeamMembers(teamId)
        for (const member of members) {
          if (member.id === currentUser.id) continue
          await createNotification({
            workspaceId: workspace.id,
            userId: member.id,
            actorId: currentUser.id,
            type: 'file_shared',
            title: `${currentUser.name} shared a file with ${team?.name ?? 'your team'}`,
            message: file.name,
            targetType: 'file',
            targetId: file.id,
          })
        }
        targets.push(team?.name ?? 'a team')
      }

      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'file.shared',
        targetType: 'file',
        targetId: file.id,
        metadata: { name: file.name, target: targets.join(', ') },
      })

      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="task-modal" onClick={(event) => event.stopPropagation()}>
        <div className="task-modal-header">
          <h2>Share "{file.name}"</h2>
          <button aria-label="Close" className="task-modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
          <label>Shareable link</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input readOnly style={{ flex: 1 }} value={link ?? 'Generate a link to copy it'} onFocus={handleGetLink} />
            <button className="small-action" onClick={handleCopyLink} type="button">
              Copy link
            </button>
          </div>
          {copyStatus && <p className="auth-note">{copyStatus}</p>}
          <span className="team-card-meta">Link expires in 24 hours.</span>
        </div>

        <form onSubmit={handleShare}>
          <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
            <label>Notify workspace members</label>
            <div style={{ display: 'grid', gap: '0.2rem', maxHeight: '140px', overflowY: 'auto' }}>
              {workspaceMembers
                .filter((member) => member.id !== currentUser.id)
                .map((member) => (
                  <label key={member.id} style={{ alignItems: 'center', display: 'flex', fontSize: '0.82rem', gap: '0.4rem' }}>
                    <input
                      checked={memberIds.includes(member.id)}
                      onChange={(event) =>
                        setMemberIds((prev) => (event.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id)))
                      }
                      type="checkbox"
                    />
                    {member.full_name}
                  </label>
                ))}
            </div>
          </div>

          {teams.length > 0 && (
            <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="share-team">Notify a team</label>
              <select id="share-team" onChange={(event) => setTeamId(event.target.value)} value={teamId}>
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button disabled={isSharing || (memberIds.length === 0 && !teamId)} type="submit">
            {isSharing ? 'Sharing…' : 'Share'}
          </Button>
        </form>
      </div>
    </div>
  )
}
