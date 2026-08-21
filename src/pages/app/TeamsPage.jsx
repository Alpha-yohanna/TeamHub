import { useEffect, useRef, useState } from 'react'
import { ChannelPanel } from '../../components/messages/ChannelPanel'
import { Button } from '../../components/ui/Button'
import { timeAgo } from '../../lib/formatters'
import { describeActivity, listActivity, logActivity } from '../../services/activityService'
import { deleteFile, formatFileSize, getFileDownloadUrl, listFiles, uploadFile } from '../../services/fileService'
import { createChannel, listTeamChannels } from '../../services/messageService'
import { createNotification } from '../../services/notificationService'
import {
  addTeamMember,
  createTeam,
  listTeamMembers,
  listTeams,
  removeTeamMember,
  setTeamLead,
  updateTeam,
} from '../../services/teamService'
import { listWorkspaceMembers } from '../../services/workspaceService'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'channels', label: 'Channels' },
  { id: 'files', label: 'Files' },
  { id: 'activity', label: 'Activity' },
]

export function TeamsPage({ currentUser, initialFocus, onFocusConsumed, onlineUserIds = new Set(), workspace }) {
  const [teams, setTeams] = useState([])
  const [workspaceMembers, setWorkspaceMembers] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const [isCreating, setIsCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [newTeamIcon, setNewTeamIcon] = useState('')
  const [addMemberId, setAddMemberId] = useState('')

  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIcon, setEditIcon] = useState('')

  const [teamChannels, setTeamChannels] = useState([])
  const [activeTeamChannelId, setActiveTeamChannelId] = useState(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')

  const [teamFiles, setTeamFiles] = useState([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [teamActivityEntries, setTeamActivityEntries] = useState([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)

  const workspaceRole = workspace?.role
  const isWorkspaceAdmin = workspaceRole === 'admin' || workspaceRole === 'owner'
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null
  const myMembership = teamMembers.find((member) => member.id === currentUser.id)
  const isTeamLead = myMembership?.role === 'lead'
  const canManageMembers = isWorkspaceAdmin || isTeamLead

  useEffect(() => {
    if (!workspace?.id) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setSelectedTeamId(null)

    async function load() {
      try {
        const [teamList, members] = await Promise.all([listTeams(workspace.id), listWorkspaceMembers(workspace.id)])
        if (!isMounted) return
        setTeams(teamList)
        setWorkspaceMembers(members)
        if (initialFocus?.type === 'team' && teamList.some((team) => team.id === initialFocus.id)) {
          setSelectedTeamId(initialFocus.id)
          onFocusConsumed?.()
        } else if (teamList.length > 0) {
          setSelectedTeamId(teamList[0].id)
        }
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  useEffect(() => {
    setActiveTab('overview')
    setIsEditingTeam(false)

    if (!selectedTeamId) {
      setTeamMembers([])
      return
    }

    let isMounted = true
    listTeamMembers(selectedTeamId)
      .then((members) => {
        if (isMounted) setTeamMembers(members)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    return () => {
      isMounted = false
    }
  }, [selectedTeamId])

  useEffect(() => {
    if (activeTab !== 'channels' || !selectedTeamId) return

    let isMounted = true
    setIsLoadingChannels(true)
    listTeamChannels(selectedTeamId)
      .then((channels) => {
        if (!isMounted) return
        setTeamChannels(channels)
        setActiveTeamChannelId((current) => current ?? channels[0]?.id ?? null)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingChannels(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedTeamId])

  useEffect(() => {
    if (activeTab !== 'files' || !selectedTeamId || !workspace?.id) return

    let isMounted = true
    setIsLoadingFiles(true)
    listFiles(workspace.id, { teamId: selectedTeamId })
      .then((files) => {
        if (isMounted) setTeamFiles(files)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingFiles(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedTeamId, workspace?.id])

  useEffect(() => {
    if (activeTab !== 'activity' || !selectedTeamId || !workspace?.id) return

    let isMounted = true
    setIsLoadingActivity(true)
    listActivity(workspace.id, 20, { teamId: selectedTeamId })
      .then((entries) => {
        if (isMounted) setTeamActivityEntries(entries)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })
      .finally(() => {
        if (isMounted) setIsLoadingActivity(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedTeamId, workspace?.id])

  useEffect(() => {
    setTeamChannels([])
    setActiveTeamChannelId(null)
    setTeamFiles([])
    setTeamActivityEntries([])
  }, [selectedTeamId])

  async function handleCreateTeam(event) {
    event.preventDefault()
    if (!newTeamName.trim()) return
    setError('')

    try {
      const team = await createTeam({
        workspaceId: workspace.id,
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || null,
        icon: newTeamIcon.trim() || null,
        createdBy: currentUser.id,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'team.created',
        targetType: 'team',
        targetId: team.id,
        metadata: { name: team.name },
        teamId: team.id,
      })
      setTeams((prev) => [
        {
          id: team.id,
          name: team.name,
          description: team.description,
          icon: team.icon,
          createdAt: team.created_at,
          memberCount: 1,
          lead: { id: currentUser.id, full_name: currentUser.name },
        },
        ...prev,
      ])
      setSelectedTeamId(team.id)
      setNewTeamName('')
      setNewTeamDescription('')
      setNewTeamIcon('')
      setIsCreating(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function startEditingTeam() {
    setEditName(selectedTeam.name)
    setEditDescription(selectedTeam.description || '')
    setEditIcon(selectedTeam.icon || '')
    setIsEditingTeam(true)
  }

  async function handleSaveTeam(event) {
    event.preventDefault()
    if (!editName.trim()) return
    setError('')

    try {
      const updated = await updateTeam({
        teamId: selectedTeamId,
        name: editName.trim(),
        description: editDescription.trim() || null,
        icon: editIcon.trim() || null,
      })
      setTeams((prev) => (prev ?? []).map((team) => (team.id === selectedTeamId ? { ...team, ...updated } : team)))
      setIsEditingTeam(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddMember(event) {
    event.preventDefault()
    if (!addMemberId || !selectedTeamId) return
    setError('')

    try {
      await addTeamMember({ teamId: selectedTeamId, userId: addMemberId })
      const addedMember = workspaceMembers.find((member) => member.id === addMemberId)

      await Promise.all([
        logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'team.member_added',
          targetType: 'team_member',
          targetId: addMemberId,
          metadata: { name: addedMember?.full_name },
          teamId: selectedTeamId,
        }),
        createNotification({
          workspaceId: workspace.id,
          userId: addMemberId,
          actorId: currentUser.id,
          type: 'team_added',
          title: 'You were added to a team',
          message: selectedTeam?.name ?? null,
          targetType: 'team',
          targetId: selectedTeamId,
        }),
      ])

      const members = await listTeamMembers(selectedTeamId)
      setTeamMembers(members)
      setTeams((prev) =>
        prev.map((team) => (team.id === selectedTeamId ? { ...team, memberCount: members.length } : team))
      )
      setAddMemberId('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.full_name} from ${selectedTeam?.name}?`)) return
    setError('')

    try {
      await removeTeamMember(member.membershipId)

      await Promise.all([
        logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'team.member_removed',
          targetType: 'team_member',
          targetId: member.id,
          metadata: { name: member.full_name },
          teamId: selectedTeamId,
        }),
        createNotification({
          workspaceId: workspace.id,
          userId: member.id,
          actorId: currentUser.id,
          type: 'team_removed',
          title: 'You were removed from a team',
          message: selectedTeam?.name ?? null,
          targetType: 'team',
          targetId: selectedTeamId,
        }),
      ])

      setTeamMembers((prev) => prev.filter((item) => item.membershipId !== member.membershipId))
      setTeams((prev) =>
        prev.map((team) => (team.id === selectedTeamId ? { ...team, memberCount: team.memberCount - 1 } : team))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAssignLead(userId) {
    if (!userId || !selectedTeamId) return
    setError('')

    try {
      await setTeamLead({ teamId: selectedTeamId, userId })
      const newLead = teamMembers.find((member) => member.id === userId)

      await Promise.all([
        logActivity({
          workspaceId: workspace.id,
          actorId: currentUser.id,
          action: 'team.lead_assigned',
          targetType: 'team_member',
          targetId: userId,
          metadata: { name: newLead?.full_name },
          teamId: selectedTeamId,
        }),
        createNotification({
          workspaceId: workspace.id,
          userId,
          actorId: currentUser.id,
          type: 'team_lead_assigned',
          title: 'You were assigned as team lead',
          message: selectedTeam?.name ?? null,
          targetType: 'team',
          targetId: selectedTeamId,
        }),
      ])

      setTeamMembers((prev) => prev.map((member) => ({ ...member, role: member.id === userId ? 'lead' : 'member' })))
      setTeams((prev) => (prev ?? []).map((team) => (team.id === selectedTeamId ? { ...team, lead: newLead } : team)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateChannel(event) {
    event.preventDefault()
    if (!newChannelName.trim() || !selectedTeamId) return
    setError('')

    try {
      const channel = await createChannel({
        workspaceId: workspace.id,
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: null,
        createdBy: currentUser.id,
        teamId: selectedTeamId,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'channel.created',
        targetType: 'channel',
        targetId: channel.id,
        metadata: { name: channel.name },
        teamId: selectedTeamId,
      })
      setTeamChannels((prev) => [...prev, channel])
      setActiveTeamChannelId(channel.id)
      setNewChannelName('')
      setIsCreatingChannel(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file || !workspace || !selectedTeamId) return
    setError('')
    setIsUploading(true)

    try {
      const uploaded = await uploadFile({
        workspaceId: workspace.id,
        uploadedBy: currentUser.id,
        file,
        teamId: selectedTeamId,
      })
      await logActivity({
        workspaceId: workspace.id,
        actorId: currentUser.id,
        action: 'file.uploaded',
        targetType: 'file',
        targetId: uploaded.id,
        metadata: { name: uploaded.name },
        teamId: selectedTeamId,
      })
      setTeamFiles((prev) => [{ ...uploaded, profiles: { full_name: currentUser.name } }, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleFileDownload(file) {
    try {
      const url = await getFileDownloadUrl(file.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleFileDelete(file) {
    if (!window.confirm(`Delete ${file.name}?`)) return

    try {
      await deleteFile({ id: file.id, storagePath: file.storage_path })
      setTeamFiles((prev) => prev.filter((item) => item.id !== file.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const availableMembers = workspaceMembers.filter(
    (member) => !teamMembers.some((teamMember) => teamMember.id === member.id)
  )

  if (!workspace) {
    return <p className="eyebrow">No workspace found yet.</p>
  }

  if (isLoading) {
    return <p className="eyebrow">Loading teams…</p>
  }

  return (
    <section className="dashboard-page" aria-labelledby="teams-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 id="teams-title">Teams</h1>
          <p>Create teams, assign leads, and give each team its own channels, files, and activity.</p>
        </div>
        {isWorkspaceAdmin && (
          <Button onClick={() => setIsCreating((open) => !open)} type="button">
            {isCreating ? 'Cancel' : 'New team'}
          </Button>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isCreating && (
        <form className="inline-form" onSubmit={handleCreateTeam}>
          <input
            aria-label="Team icon (emoji, optional)"
            maxLength={4}
            onChange={(event) => setNewTeamIcon(event.target.value)}
            placeholder="🚀"
            style={{ maxWidth: '4rem' }}
            value={newTeamIcon}
          />
          <input
            aria-label="Team name"
            onChange={(event) => setNewTeamName(event.target.value)}
            placeholder="Team name"
            required
            value={newTeamName}
          />
          <input
            aria-label="Team description"
            onChange={(event) => setNewTeamDescription(event.target.value)}
            placeholder="Description (optional)"
            value={newTeamDescription}
          />
          <Button type="submit">Create team</Button>
        </form>
      )}

      <div className="teams-shell">
        <article className="panel-card">
          <div className="panel-header">
            <h2>All teams</h2>
          </div>
          {teams.length === 0 ? (
            <p className="empty-state-inline">
              {isWorkspaceAdmin ? 'No teams yet. Create the first one.' : 'No teams yet.'}
            </p>
          ) : (
            <div className="user-list">
              {teams.map((team) => (
                <button
                  className={`list-select-row${team.id === selectedTeamId ? ' active' : ''}`}
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  type="button"
                >
                  <div className="team-card-header">
                    <span className="avatar">{team.icon || team.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{team.name}</strong>
                      <span className="team-card-meta">
                        {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                        {team.lead ? ` · Lead: ${team.lead.full_name}` : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          {!selectedTeam ? (
            <p className="empty-state-inline">Select a team to see its workspace.</p>
          ) : (
            <>
              <div className="panel-header">
                {isEditingTeam ? (
                  <form className="inline-form" onSubmit={handleSaveTeam} style={{ flex: 1 }}>
                    <input
                      aria-label="Team icon"
                      maxLength={4}
                      onChange={(event) => setEditIcon(event.target.value)}
                      style={{ maxWidth: '4rem' }}
                      value={editIcon}
                    />
                    <input aria-label="Team name" onChange={(event) => setEditName(event.target.value)} required value={editName} />
                    <input
                      aria-label="Team description"
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Description"
                      value={editDescription}
                    />
                    <Button type="submit">Save</Button>
                    <button className="text-button" onClick={() => setIsEditingTeam(false)} type="button">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="team-card-header">
                      <span className="avatar">{selectedTeam.icon || selectedTeam.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <h2>{selectedTeam.name}</h2>
                        <span className="team-card-meta">{selectedTeam.description || 'No description'}</span>
                      </div>
                    </div>
                    {canManageMembers && (
                      <button className="small-action" onClick={startEditingTeam} type="button">
                        Edit
                      </button>
                    )}
                  </>
                )}
              </div>

              <nav className="team-tabs" aria-label="Team sections">
                {TABS.map((tab) => (
                  <button
                    className={activeTab === tab.id ? 'active' : ''}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {activeTab === 'overview' && (
                <div className="user-list">
                  <div className="user-row">
                    <div>
                      <strong>Team lead</strong>
                      <span>{selectedTeam.lead?.full_name ?? 'No lead assigned'}</span>
                    </div>
                  </div>
                  <div className="user-row">
                    <div>
                      <strong>Members</strong>
                      <span>
                        {selectedTeam.memberCount} member{selectedTeam.memberCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="user-row">
                    <div>
                      <strong>Created</strong>
                      <span>{timeAgo(selectedTeam.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <>
                  <div className="user-list">
                    {teamMembers.map((member) => (
                      <div className="user-row" key={member.membershipId}>
                        <span className="avatar-wrap">
                          <span className="avatar">{(member.full_name || member.username || '?').slice(0, 2).toUpperCase()}</span>
                          <span className={`status-dot${onlineUserIds.has(member.id) ? ' online' : ''}`} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{member.full_name}</strong>
                          <span>{member.email || member.username}</span>
                        </div>
                        <div className="row-actions">
                          {member.role === 'lead' ? (
                            <em>Lead</em>
                          ) : (
                            <em>Member</em>
                          )}
                          {isWorkspaceAdmin && member.role !== 'lead' && (
                            <button className="text-button" onClick={() => handleAssignLead(member.id)} type="button">
                              Make lead
                            </button>
                          )}
                          {canManageMembers && member.id !== currentUser.id && (
                            <button className="text-button danger" onClick={() => handleRemoveMember(member)} type="button">
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {canManageMembers && availableMembers.length > 0 && (
                    <form className="inline-form" onSubmit={handleAddMember}>
                      <select
                        aria-label="Add workspace member to team"
                        onChange={(event) => setAddMemberId(event.target.value)}
                        value={addMemberId}
                      >
                        <option value="">Add a workspace member…</option>
                        {availableMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                      <Button disabled={!addMemberId} type="submit">
                        Add
                      </Button>
                    </form>
                  )}
                </>
              )}

              {activeTab === 'channels' && (
                <>
                  <div className="panel-header">
                    <button className="small-action" onClick={() => setIsCreatingChannel((open) => !open)} type="button">
                      {isCreatingChannel ? 'Cancel' : 'New team channel'}
                    </button>
                  </div>
                  {isCreatingChannel && (
                    <form className="inline-form" onSubmit={handleCreateChannel}>
                      <input
                        aria-label="Channel name"
                        onChange={(event) => setNewChannelName(event.target.value)}
                        placeholder="channel-name"
                        required
                        value={newChannelName}
                      />
                      <Button type="submit">Create</Button>
                    </form>
                  )}

                  {isLoadingChannels ? (
                    <p className="empty-state-inline">Loading channels…</p>
                  ) : teamChannels.length === 0 ? (
                    <p className="empty-state-inline">No channels for this team yet.</p>
                  ) : (
                    <div className="messages-shell">
                      <aside className="channel-list" aria-label="Team channels">
                        {teamChannels.map((channel) => (
                          <button
                            className={`channel-item${channel.id === activeTeamChannelId ? ' active' : ''}`}
                            key={channel.id}
                            onClick={() => setActiveTeamChannelId(channel.id)}
                            type="button"
                          >
                            # {channel.name}
                          </button>
                        ))}
                      </aside>
                      <ChannelPanel
                        channelId={activeTeamChannelId}
                        channelName={teamChannels.find((c) => c.id === activeTeamChannelId)?.name}
                        currentUser={currentUser}
                        members={teamMembers}
                        workspaceId={workspace.id}
                      />
                    </div>
                  )}
                </>
              )}

              {activeTab === 'files' && (
                <>
                  <div className="panel-header">
                    <button
                      className="small-action"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      {isUploading ? 'Uploading…' : 'Upload file'}
                    </button>
                    <input hidden onChange={handleFileChange} ref={fileInputRef} type="file" />
                  </div>
                  {isLoadingFiles ? (
                    <p className="empty-state-inline">Loading files…</p>
                  ) : teamFiles.length === 0 ? (
                    <p className="empty-state-inline">No files uploaded to this team yet.</p>
                  ) : (
                    <div className="user-list">
                      {teamFiles.map((file) => (
                        <div className="user-row" key={file.id}>
                          <span className="avatar">{file.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{file.name}</strong>
                            <span>
                              {formatFileSize(file.size_bytes)} · {file.profiles?.full_name || 'Unknown'} ·{' '}
                              {timeAgo(file.created_at)}
                            </span>
                          </div>
                          <div className="row-actions">
                            <button className="text-button" onClick={() => handleFileDownload(file)} type="button">
                              Download
                            </button>
                            {file.uploaded_by === currentUser.id && (
                              <button className="text-button danger" onClick={() => handleFileDelete(file)} type="button">
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'activity' && (
                <div className="activity-list">
                  {isLoadingActivity ? (
                    <p className="empty-state-inline">Loading activity…</p>
                  ) : teamActivityEntries.length === 0 ? (
                    <p className="empty-state-inline">No activity for this team yet.</p>
                  ) : (
                    teamActivityEntries.map((entry) => (
                      <div className="activity-item" key={entry.id}>
                        <span className="feature-dot" aria-hidden="true" />
                        <p>{describeActivity(entry)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  )
}
