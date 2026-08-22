import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { MembersRolesPanel } from '../../components/settings/MembersRolesPanel'
import { applyTheme } from '../../lib/theme'
import { changePassword, signOutEverywhere } from '../../services/authService'
import {
  getUserPreferences,
  updateProfile,
  updateUserPreferences,
  updateWorkspace,
  uploadAvatar,
} from '../../services/workspaceService'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'members', label: 'Members & Roles' },
  { id: 'security', label: 'Security' },
]

const NOTIFICATION_TOGGLES = [
  { key: 'notify_mentions', label: 'Mentions', description: 'When someone @mentions you in a message.' },
  { key: 'notify_direct_messages', label: 'Direct messages', description: 'New DMs and group messages sent to you.' },
  { key: 'notify_task_assignments', label: 'Task assignments', description: 'When a task is assigned to you or its due date changes.' },
  { key: 'notify_project_updates', label: 'Project updates', description: 'Status changes on projects you belong to.' },
  { key: 'notify_team_activity', label: 'Team activity', description: 'Being added to a team or made a team lead.' },
  { key: 'notify_file_sharing', label: 'File sharing', description: 'When someone shares a file with you or your team.' },
]

const THEME_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

const ORG_TYPES = ['Startup', 'Small business', 'Agency', 'Nonprofit', 'Education', 'Personal', 'Other']
const TEAM_SIZES = ['Just me', '2-10', '11-50', '51-200', '200+']
const USE_CASES = ['Team communication', 'Project & task management', 'File sharing & collaboration', 'All of the above', 'Other']

export function SettingsPage({ authSource, currentUser, onLogout, onProfileUpdated, onWorkspacesChanged, role, workspace, workspaces = [] }) {
  const isLive = authSource === 'supabase'
  const effectiveRole = isLive ? workspace?.role : role
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'owner'
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <section className="dashboard-page" aria-labelledby="settings-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personal</p>
          <h1 id="settings-title">Settings</h1>
          <p>Manage your profile, workspace, and preferences.</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'profile' && <ProfileTab currentUser={currentUser} isLive={isLive} onProfileUpdated={onProfileUpdated} />}
          {activeTab === 'account' && (
            <AccountTab currentUser={currentUser} onLogout={onLogout} workspace={workspace} workspaces={workspaces} />
          )}
          {activeTab === 'notifications' && <NotificationsTab currentUser={currentUser} isLive={isLive} />}
          {activeTab === 'appearance' && <AppearanceTab currentUser={currentUser} isLive={isLive} />}
          {activeTab === 'workspace' && (
            <WorkspaceTab isAdmin={isAdmin} isLive={isLive} onWorkspacesChanged={onWorkspacesChanged} workspace={workspace} />
          )}
          {activeTab === 'members' && <MembersRolesPanel currentUser={currentUser} isAdmin={isAdmin} workspace={workspace} />}
          {activeTab === 'security' && <SecurityTab isLive={isLive} />}
        </div>
      </div>
    </section>
  )
}

function ProfileTab({ currentUser, isLive, onProfileUpdated }) {
  const [fullName, setFullName] = useState(currentUser?.name || '')
  const [bio, setBio] = useState(currentUser?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  async function handleSave(event) {
    event.preventDefault()
    if (!fullName.trim() || !isLive) return
    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      await updateProfile(currentUser.id, { full_name: fullName.trim(), bio: bio.trim() || null })
      setMessage('Profile updated.')
      onProfileUpdated?.({ name: fullName.trim(), bio: bio.trim() || null })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file || !isLive) return
    setIsUploadingAvatar(true)
    setError('')

    try {
      const updated = await uploadAvatar(currentUser.id, file)
      setAvatarUrl(updated.avatar_url)
      onProfileUpdated?.({ avatarUrl: updated.avatar_url })
      setMessage('Avatar updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-header">
        <h2>Your profile</h2>
      </div>

      <div className="avatar-upload-row" style={{ marginBottom: '1rem' }}>
        {avatarUrl ? (
          <img alt="" src={avatarUrl} style={{ borderRadius: '999px', height: '3.2rem', objectFit: 'cover', width: '3.2rem' }} />
        ) : (
          <span className="avatar">{(currentUser?.name || currentUser?.email || '?').slice(0, 2).toUpperCase()}</span>
        )}
        <div>
          <input accept="image/*" hidden onChange={handleAvatarChange} ref={fileInputRef} type="file" />
          <button className="small-action" disabled={!isLive || isUploadingAvatar} onClick={() => fileInputRef.current?.click()} type="button">
            {isUploadingAvatar ? 'Uploading…' : 'Change avatar'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="settings-full-name">Full name</label>
          <input
            disabled={!isLive}
            id="settings-full-name"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            value={fullName}
          />
        </div>

        <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="settings-bio">Bio</label>
          <textarea
            disabled={!isLive}
            id="settings-bio"
            onChange={(event) => setBio(event.target.value)}
            placeholder="A short line about you"
            rows={3}
            value={bio}
          />
        </div>

        <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
          <label>Email</label>
          <span className="team-card-meta">{currentUser?.email}</span>
        </div>

        <Button disabled={!isLive || isSaving} type="submit">
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      {message && <p className="auth-note">{message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

function AccountTab({ currentUser, onLogout, workspace, workspaces }) {
  return (
    <article className="panel-card">
      <div className="panel-header">
        <h2>Account</h2>
      </div>

      <div className="user-list">
        <div className="user-row">
          <span className="avatar">{(currentUser?.name || currentUser?.email || '?').slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{currentUser?.email}</strong>
            <span>Active account</span>
          </div>
          <em>{workspace?.role ?? 'member'}</em>
        </div>
      </div>

      <div className="panel-header" style={{ marginTop: '1.25rem' }}>
        <h2>Your workspaces</h2>
      </div>
      <div className="user-list">
        {workspaces.length === 0 ? (
          <p className="empty-state-inline">No workspace memberships yet.</p>
        ) : (
          workspaces.map((ws) => (
            <div className="user-row" key={ws.id}>
              <span className="avatar">{ws.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{ws.name}</strong>
                <span>
                  {ws.memberCount} member{ws.memberCount === 1 ? '' : 's'}
                </span>
              </div>
              <em>{ws.role}</em>
            </div>
          ))
        )}
      </div>

      <div className="settings-danger" style={{ marginTop: '1.25rem' }}>
        <div>
          <strong>Log out</strong>
          <span>End your session on this device.</span>
        </div>
        <button className="small-action" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
    </article>
  )
}

function NotificationsTab({ currentUser, isLive }) {
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLive) {
      setIsLoading(false)
      return
    }
    let isMounted = true
    getUserPreferences(currentUser.id)
      .then((data) => {
        if (isMounted) setPreferences(data)
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
  }, [currentUser.id, isLive])

  async function handleToggle(key) {
    if (!preferences) return
    const nextValue = !preferences[key]
    setPreferences((prev) => ({ ...prev, [key]: nextValue }))
    try {
      await updateUserPreferences(currentUser.id, { [key]: nextValue })
    } catch (err) {
      setError(err.message)
      setPreferences((prev) => ({ ...prev, [key]: !nextValue }))
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-header">
        <h2>Notification preferences</h2>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!isLive ? (
        <p className="empty-state-inline">Notification preferences require a live TeamHub account.</p>
      ) : isLoading || !preferences ? (
        <p className="empty-state-inline">Loading preferences…</p>
      ) : (
        NOTIFICATION_TOGGLES.map((toggle) => (
          <div className="preference-row" key={toggle.key}>
            <div>
              <strong>{toggle.label}</strong>
              <span>{toggle.description}</span>
            </div>
            <button
              aria-checked={Boolean(preferences[toggle.key])}
              aria-label={toggle.label}
              className={`toggle-switch${preferences[toggle.key] ? ' on' : ''}`}
              onClick={() => handleToggle(toggle.key)}
              role="switch"
              type="button"
            >
              <span />
            </button>
          </div>
        ))
      )}
    </article>
  )
}

function AppearanceTab({ currentUser, isLive }) {
  const [theme, setTheme] = useState('system')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLive) {
      setIsLoading(false)
      return
    }
    let isMounted = true
    getUserPreferences(currentUser.id)
      .then((data) => {
        if (isMounted) setTheme(data.theme || 'system')
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
  }, [currentUser.id, isLive])

  async function handleSelect(nextTheme) {
    setTheme(nextTheme)
    applyTheme(nextTheme)
    if (!isLive) return
    try {
      await updateUserPreferences(currentUser.id, { theme: nextTheme })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-header">
        <h2>Appearance</h2>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="empty-state-inline">Loading…</p>
      ) : (
        <div className="theme-option-group">
          {THEME_OPTIONS.map((option) => (
            <button
              className={`theme-option${theme === option.id ? ' active' : ''}`}
              key={option.id}
              onClick={() => handleSelect(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <p className="team-card-meta" style={{ marginTop: '0.75rem' }}>
        "System" follows your device's light/dark setting automatically.
      </p>
    </article>
  )
}

function WorkspaceTab({ isAdmin, isLive, onWorkspacesChanged, workspace }) {
  const [name, setName] = useState(workspace?.name || '')
  const [description, setDescription] = useState(workspace?.description || '')
  const [orgType, setOrgType] = useState(workspace?.org_type || '')
  const [teamSize, setTeamSize] = useState(workspace?.team_size || '')
  const [useCase, setUseCase] = useState(workspace?.use_case || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // This tab can stay mounted across a workspace switch (same active Settings tab, different
  // active workspace) — resync the form from the new workspace instead of silently keeping the
  // previous one's values, which would otherwise save stale data onto the wrong workspace.
  useEffect(() => {
    setName(workspace?.name || '')
    setDescription(workspace?.description || '')
    setOrgType(workspace?.org_type || '')
    setTeamSize(workspace?.team_size || '')
    setUseCase(workspace?.use_case || '')
    setMessage('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  if (!workspace) {
    return (
      <article className="panel-card">
        <p className="empty-state-inline">No workspace found yet.</p>
      </article>
    )
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!isAdmin || !name.trim()) return
    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      await updateWorkspace(workspace.id, {
        name: name.trim(),
        description: description.trim() || null,
        org_type: orgType || null,
        team_size: teamSize || null,
        use_case: useCase || null,
      })
      setMessage('Workspace updated.')
      await onWorkspacesChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-header">
        <h2>Workspace settings</h2>
      </div>

      {!isAdmin ? (
        <div className="user-list">
          <div className="user-row">
            <span className="avatar">{workspace.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{workspace.name}</strong>
              <span>{workspace.description || 'No description'}</span>
            </div>
            <em>{workspace.role}</em>
          </div>
          <p className="empty-state-inline">Only workspace Owners and Admins can edit workspace settings.</p>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="ws-name">Workspace name</label>
            <input disabled={!isLive} id="ws-name" onChange={(event) => setName(event.target.value)} value={name} />
          </div>
          <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="ws-description">Description</label>
            <textarea disabled={!isLive} id="ws-description" onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
          </div>
          <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="ws-org-type">Organization type</label>
            <select disabled={!isLive} id="ws-org-type" onChange={(event) => setOrgType(event.target.value)} value={orgType}>
              <option value="">Not set</option>
              {ORG_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="ws-team-size">Team size</label>
            <select disabled={!isLive} id="ws-team-size" onChange={(event) => setTeamSize(event.target.value)} value={teamSize}>
              <option value="">Not set</option>
              {TEAM_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="ws-use-case">Primary use case</label>
            <select disabled={!isLive} id="ws-use-case" onChange={(event) => setUseCase(event.target.value)} value={useCase}>
              <option value="">Not set</option>
              {USE_CASES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={!isLive || isSaving || !name.trim()} type="submit">
            {isSaving ? 'Saving…' : 'Save workspace'}
          </Button>
        </form>
      )}

      {message && <p className="auth-note">{message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

function SecurityTab({ isLive }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOutAll, setIsSigningOutAll] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleChangePassword(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setIsSaving(true)
    try {
      await changePassword(newPassword)
      setMessage('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOutEverywhere() {
    setIsSigningOutAll(true)
    setError('')
    try {
      await signOutEverywhere()
      setMessage('Signed out of all devices. You will need to log in again here too.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSigningOutAll(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <article className="panel-card">
        <div className="panel-header">
          <h2>Change password</h2>
        </div>
        {!isLive ? (
          <p className="empty-state-inline">Password changes require a live TeamHub account.</p>
        ) : (
          <form onSubmit={handleChangePassword}>
            <div className="task-modal-field" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="new-password">New password</label>
              <input
                autoComplete="new-password"
                id="new-password"
                minLength={6}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </div>
            <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                autoComplete="new-password"
                id="confirm-password"
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </div>
            <Button disabled={isSaving || !newPassword} type="submit">
              {isSaving ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </article>

      <article className="panel-card">
        <div className="panel-header">
          <h2>Sessions</h2>
        </div>
        <div className="settings-danger">
          <div>
            <strong>Sign out of all devices</strong>
            <span>Ends every active session for your account, including this one.</span>
          </div>
          <button className="small-action" disabled={!isLive || isSigningOutAll} onClick={handleSignOutEverywhere} type="button">
            {isSigningOutAll ? 'Signing out…' : 'Sign out everywhere'}
          </button>
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-header">
          <h2>Account deletion</h2>
        </div>
        <p className="empty-state-inline">
          Self-service account deletion isn't available yet — deleting an account requires a privileged operation that can't run
          safely from the browser. Contact a workspace owner or your administrator to have your account removed.
        </p>
      </article>

      {message && <p className="auth-note">{message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
