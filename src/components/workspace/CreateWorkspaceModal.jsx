import { useState } from 'react'
import { Button } from '../ui/Button'
import { createWorkspace } from '../../services/workspaceService'

const ORG_TYPES = ['Startup', 'Small business', 'Agency', 'Nonprofit', 'Education', 'Personal', 'Other']

export function CreateWorkspaceModal({ currentUser, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [orgType, setOrgType] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) return
    setIsCreating(true)
    setError('')

    try {
      const workspace = await createWorkspace({
        name: name.trim(),
        description: description.trim() || null,
        orgType: orgType || null,
        ownerId: currentUser.id,
      })
      await onCreated?.(workspace.id)
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="task-modal" onClick={(event) => event.stopPropagation()}>
        <div className="task-modal-header">
          <h2>Create a workspace</h2>
          <button aria-label="Close" className="task-modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="task-modal-field" style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              id="workspace-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Inc."
              required
              value={name}
            />
          </div>

          <div className="task-modal-field" style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="workspace-description">Description</label>
            <textarea
              id="workspace-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What's this workspace for?"
              rows={3}
              value={description}
            />
          </div>

          <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="workspace-org-type">Organization type</label>
            <select id="workspace-org-type" onChange={(event) => setOrgType(event.target.value)} value={orgType}>
              <option value="">Select one (optional)</option>
              {ORG_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <Button disabled={isCreating || !name.trim()} type="submit">
            {isCreating ? 'Creating…' : 'Create workspace'}
          </Button>
        </form>
      </div>
    </div>
  )
}
