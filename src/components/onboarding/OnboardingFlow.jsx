import { useState } from 'react'
import { Button } from '../ui/Button'
import { createProject } from '../../services/projectService'
import { createTeam } from '../../services/teamService'
import { inviteToWorkspace, updateWorkspace } from '../../services/workspaceService'

const ORG_TYPES = ['Startup', 'Small business', 'Agency', 'Nonprofit', 'Education', 'Personal', 'Other']
const TEAM_SIZES = ['Just me', '2-10', '11-50', '51-200', '200+']
const USE_CASES = ['Team communication', 'Project & task management', 'File sharing & collaboration', 'All of the above', 'Other']
const TOTAL_STEPS = 6

export function OnboardingFlow({ currentUser, onComplete, onWorkspaceUpdated, workspace }) {
  const [step, setStep] = useState(Math.min(workspace.onboarding_step || 1, TOTAL_STEPS) || 1)
  const [name, setName] = useState(workspace.name || '')
  const [orgType, setOrgType] = useState(workspace.org_type || '')
  const [teamSize, setTeamSize] = useState(workspace.team_size || '')
  const [useCase, setUseCase] = useState(workspace.use_case || '')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitedEmails, setInvitedEmails] = useState([])
  const [teamName, setTeamName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function persistStep(nextStep, extraWorkspaceUpdates = {}) {
    try {
      const updated = await updateWorkspace(workspace.id, { onboarding_step: nextStep, ...extraWorkspaceUpdates })
      onWorkspaceUpdated?.(updated)
    } catch (err) {
      setError(err.message)
      return false
    }
    return true
  }

  async function finish() {
    setIsSaving(true)
    setError('')
    try {
      const updated = await updateWorkspace(workspace.id, { onboarding_completed_at: new Date().toISOString() })
      onWorkspaceUpdated?.(updated)
      onComplete?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSkipAll() {
    await finish()
  }

  async function goNext(extraWorkspaceUpdates = {}) {
    setIsSaving(true)
    setError('')
    const nextStep = step + 1
    if (nextStep > TOTAL_STEPS) {
      await finish()
      setIsSaving(false)
      return
    }
    const ok = await persistStep(nextStep, extraWorkspaceUpdates)
    setIsSaving(false)
    if (ok) setStep(nextStep)
  }

  async function handleAddInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    setIsSaving(true)
    setError('')
    try {
      await inviteToWorkspace({ workspaceId: workspace.id, email, invitedBy: currentUser.id })
      setInvitedEmails((prev) => [...prev, email])
      setInviteEmail('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) return
    setIsSaving(true)
    setError('')
    try {
      await createTeam({ workspaceId: workspace.id, name: teamName.trim(), description: null, createdBy: currentUser.id })
      await goNext()
    } catch (err) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  async function handleCreateProject() {
    if (!projectName.trim()) return
    setIsSaving(true)
    setError('')
    try {
      await createProject({ workspaceId: workspace.id, name: projectName.trim(), description: null, ownerId: currentUser.id })
      await goNext()
    } catch (err) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100)

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="onboarding-modal" role="dialog" aria-label="Workspace setup" aria-modal="true">
        <div className="onboarding-progress">
          <span>
            Step {step} / {TOTAL_STEPS}
          </span>
          <button className="text-button" onClick={handleSkipAll} type="button">
            Skip setup
          </button>
        </div>
        <div className="onboarding-progress-track">
          <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="onboarding-body">
          {step === 1 && (
            <>
              <h2>Name your workspace</h2>
              <p className="onboarding-subtitle">This is what your team will see — you can change it later in Settings.</p>
              <div className="task-modal-field">
                <input
                  aria-label="Workspace name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Acme Inc."
                  value={name}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Tell us about your organization</h2>
              <p className="onboarding-subtitle">This helps us tailor defaults — you can change it later in Settings.</p>
              <div className="task-modal-field" style={{ marginBottom: '0.85rem' }}>
                <label htmlFor="onboarding-org-type">Organization type</label>
                <select id="onboarding-org-type" onChange={(event) => setOrgType(event.target.value)} value={orgType}>
                  <option value="">Select one</option>
                  {ORG_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="task-modal-field">
                <label htmlFor="onboarding-team-size">Team size</label>
                <select id="onboarding-team-size" onChange={(event) => setTeamSize(event.target.value)} value={teamSize}>
                  <option value="">Select one</option>
                  {TEAM_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>What will you use TeamHub for?</h2>
              <p className="onboarding-subtitle">Pick what fits best — you can always use it for everything.</p>
              <div className="task-modal-field">
                <select aria-label="Primary use case" onChange={(event) => setUseCase(event.target.value)} value={useCase}>
                  <option value="">Select one</option>
                  {USE_CASES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2>Invite your team</h2>
              <p className="onboarding-subtitle">Add teammates by email. They'll get an invite to join this workspace.</p>
              <div className="task-modal-field" style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
                <input
                  aria-label="Email to invite"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  style={{ flex: 1 }}
                  type="email"
                  value={inviteEmail}
                />
                <button className="small-action" disabled={isSaving || !inviteEmail.trim()} onClick={handleAddInvite} type="button">
                  Invite
                </button>
              </div>
              {invitedEmails.length > 0 && (
                <div className="onboarding-invite-list">
                  {invitedEmails.map((email) => (
                    <div className="user-row" key={email}>
                      <span>{email}</span>
                      <em>Invited</em>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <h2>Create your first team</h2>
              <p className="onboarding-subtitle">Teams group people around a shared area of work.</p>
              <div className="task-modal-field">
                <input
                  aria-label="Team name"
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="e.g. Design"
                  value={teamName}
                />
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2>Create your first project</h2>
              <p className="onboarding-subtitle">Projects hold the tasks your team is working on.</p>
              <div className="task-modal-field">
                <input
                  aria-label="Project name"
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="e.g. Website redesign"
                  value={projectName}
                />
              </div>
            </>
          )}
        </div>

        <div className="onboarding-actions">
          <div className="row-actions">
            {step > 1 && (
              <button className="text-button" disabled={isSaving} onClick={() => setStep((current) => current - 1)} type="button">
                Back
              </button>
            )}
          </div>
          <div className="row-actions">
            {step !== 5 && step !== 6 && (
              <button className="text-button" disabled={isSaving} onClick={() => goNext()} type="button">
                Skip this step
              </button>
            )}
            {step === 1 && (
              <Button disabled={isSaving} onClick={() => goNext({ name: name.trim() || workspace.name })} type="button">
                {isSaving ? 'Saving…' : 'Continue'}
              </Button>
            )}
            {step === 2 && (
              <Button
                disabled={isSaving}
                onClick={() => goNext({ org_type: orgType || null, team_size: teamSize || null })}
                type="button"
              >
                {isSaving ? 'Saving…' : 'Continue'}
              </Button>
            )}
            {step === 3 && (
              <Button disabled={isSaving} onClick={() => goNext({ use_case: useCase || null })} type="button">
                {isSaving ? 'Saving…' : 'Continue'}
              </Button>
            )}
            {step === 4 && (
              <Button disabled={isSaving} onClick={() => goNext()} type="button">
                {isSaving ? 'Saving…' : 'Continue'}
              </Button>
            )}
            {step === 5 && (
              <>
                <button className="text-button" disabled={isSaving} onClick={() => goNext()} type="button">
                  Skip this step
                </button>
                <Button disabled={isSaving || !teamName.trim()} onClick={handleCreateTeam} type="button">
                  {isSaving ? 'Creating…' : 'Create team'}
                </Button>
              </>
            )}
            {step === 6 && (
              <>
                <button className="text-button" disabled={isSaving} onClick={() => goNext()} type="button">
                  Skip this step
                </button>
                <Button disabled={isSaving || !projectName.trim()} onClick={handleCreateProject} type="button">
                  {isSaving ? 'Creating…' : 'Finish setup'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
