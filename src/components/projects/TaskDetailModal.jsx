import { useEffect, useRef, useState } from 'react'
import { timeAgo } from '../../lib/formatters'
import { logActivity } from '../../services/activityService'
import { deleteFile, formatFileSize, getFileDownloadUrl, listFiles, uploadFile } from '../../services/fileService'
import { createNotification } from '../../services/notificationService'
import {
  addLabelToTask,
  addTaskComment,
  deleteTaskComment,
  listTaskComments,
  removeLabelFromTask,
  updateTaskComment,
} from '../../services/taskService'
import { Button } from '../ui/Button'

export function TaskDetailModal({
  task,
  projectMembers,
  workspaceLabels,
  currentUser,
  workspaceId,
  projectId,
  canEdit,
  canDelete,
  onClose,
  onFieldChange,
  onLabelsChange,
  onDeleteTask,
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [isEditingText, setIsEditingText] = useState(false)
  const [comments, setComments] = useState([])
  const [commentDraft, setCommentDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [addLabelId, setAddLabelId] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    listTaskComments(task.id)
      .then((data) => {
        if (isMounted) setComments(data)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    listFiles(workspaceId, { taskId: task.id })
      .then((data) => {
        if (isMounted) setAttachments(data)
      })
      .catch((err) => {
        if (isMounted) setError(err.message)
      })

    return () => {
      isMounted = false
    }
  }, [task.id, workspaceId])

  async function handleSaveText(event) {
    event.preventDefault()
    if (!title.trim()) return

    try {
      if (title.trim() !== task.title) await onFieldChange('title', title.trim())
      if (description.trim() !== (task.description || '')) await onFieldChange('description', description.trim() || null)
      setIsEditingText(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddComment(event) {
    event.preventDefault()
    if (!commentDraft.trim()) return
    setError('')

    try {
      const comment = await addTaskComment({ taskId: task.id, authorId: currentUser.id, content: commentDraft.trim() })
      setComments((prev) => [...prev, comment])
      setCommentDraft('')

      await logActivity({
        workspaceId,
        actorId: currentUser.id,
        action: 'task.comment_added',
        targetType: 'task',
        targetId: task.id,
        metadata: { name: task.title },
        projectId,
      })

      if (task.assigneeId && task.assigneeId !== currentUser.id) {
        await createNotification({
          workspaceId,
          userId: task.assigneeId,
          actorId: currentUser.id,
          type: 'task_comment',
          title: `New comment on "${task.title}"`,
          message: commentDraft.trim(),
          targetType: 'task',
          targetId: task.id,
          metadata: { projectId },
        })
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSaveComment(commentId) {
    if (!editingCommentText.trim()) return
    try {
      await updateTaskComment({ commentId, content: editingCommentText.trim() })
      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? { ...comment, content: editingCommentText.trim() } : comment))
      )
      setEditingCommentId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('Delete this comment?')) return
    try {
      await deleteTaskComment(commentId)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUploadAttachment(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')

    try {
      const uploaded = await uploadFile({ workspaceId, uploadedBy: currentUser.id, file, projectId, taskId: task.id })
      setAttachments((prev) => [{ ...uploaded, profiles: { full_name: currentUser.name } }, ...prev])
      await logActivity({
        workspaceId,
        actorId: currentUser.id,
        action: 'file.uploaded',
        targetType: 'file',
        targetId: uploaded.id,
        metadata: { name: uploaded.name },
        projectId,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownloadAttachment(file) {
    try {
      const url = await getFileDownloadUrl(file.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteAttachment(file) {
    if (!window.confirm(`Delete ${file.name}?`)) return
    try {
      await deleteFile({ id: file.id, storagePath: file.storage_path })
      setAttachments((prev) => prev.filter((item) => item.id !== file.id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddLabel(event) {
    event.preventDefault()
    if (!addLabelId) return
    try {
      await addLabelToTask({ taskId: task.id, labelId: addLabelId })
      const label = workspaceLabels.find((item) => item.id === addLabelId)
      onLabelsChange(task.id, [...task.labels, label])
      setAddLabelId('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveLabel(labelId) {
    try {
      await removeLabelFromTask({ taskId: task.id, labelId })
      onLabelsChange(
        task.id,
        task.labels.filter((label) => label.id !== labelId)
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return
    try {
      await onDeleteTask(task.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const availableLabels = workspaceLabels.filter((label) => !task.labels.some((taskLabel) => taskLabel.id === label.id))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="task-modal" onClick={(event) => event.stopPropagation()}>
        <div className="task-modal-header">
          {isEditingText && canEdit ? (
            <form onSubmit={handleSaveText} style={{ flex: 1 }}>
              <input
                aria-label="Task title"
                onChange={(event) => setTitle(event.target.value)}
                required
                style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', width: '100%' }}
                value={title}
              />
              <textarea
                aria-label="Task description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                rows={3}
                style={{ width: '100%' }}
                value={description}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button type="submit">Save</Button>
                <button className="text-button" onClick={() => setIsEditingText(false)} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <h2>{task.title}</h2>
                {task.description && <p style={{ color: 'var(--muted)' }}>{task.description}</p>}
                {canEdit && (
                  <button className="text-button" onClick={() => setIsEditingText(true)} type="button">
                    Edit
                  </button>
                )}
              </div>
              <button aria-label="Close" className="task-modal-close" onClick={onClose} type="button">
                ×
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="task-modal-grid">
          <div className="task-modal-field">
            <label htmlFor="task-status">Status</label>
            <select
              disabled={!canEdit}
              id="task-status"
              onChange={(event) => onFieldChange('status', event.target.value)}
              value={task.status}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="task-modal-field">
            <label htmlFor="task-priority">Priority</label>
            <select
              disabled={!canEdit}
              id="task-priority"
              onChange={(event) => onFieldChange('priority', event.target.value)}
              value={task.priority}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="task-modal-field">
            <label htmlFor="task-assignee">Assignee</label>
            <select
              disabled={!canEdit}
              id="task-assignee"
              onChange={(event) => onFieldChange('assigneeId', event.target.value || null)}
              value={task.assigneeId ?? ''}
            >
              <option value="">Unassigned</option>
              {projectMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="task-modal-field">
            <label htmlFor="task-due-date">Due date</label>
            <input
              disabled={!canEdit}
              id="task-due-date"
              onChange={(event) => onFieldChange('dueDate', event.target.value || null)}
              type="date"
              value={task.dueDate ?? ''}
            />
          </div>
        </div>

        <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
          <label>Labels</label>
          <div className="kanban-card-labels">
            {task.labels.map((label) => (
              <span className="task-label-chip" key={label.id} style={{ background: `${label.color}22`, color: label.color }}>
                {label.name}
                {canEdit && (
                  <button
                    aria-label={`Remove ${label.name} label`}
                    onClick={() => handleRemoveLabel(label.id)}
                    style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', marginLeft: '0.3rem' }}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {canEdit && availableLabels.length > 0 && (
            <form onSubmit={handleAddLabel} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
              <select onChange={(event) => setAddLabelId(event.target.value)} value={addLabelId}>
                <option value="">Add a label…</option>
                {availableLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
              <button className="small-action" disabled={!addLabelId} type="submit">
                Add
              </button>
            </form>
          )}
        </div>

        <div className="task-modal-field" style={{ marginBottom: '1rem' }}>
          <label>Attachments</label>
          <div className="user-list">
            {attachments.length === 0 ? (
              <p className="empty-state-inline">No attachments yet.</p>
            ) : (
              attachments.map((file) => (
                <div className="user-row" key={file.id}>
                  <span className="avatar">{file.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{file.name}</strong>
                    <span>{formatFileSize(file.size_bytes)}</span>
                  </div>
                  <div className="row-actions">
                    <button className="text-button" onClick={() => handleDownloadAttachment(file)} type="button">
                      Download
                    </button>
                    {file.uploaded_by === currentUser.id && (
                      <button className="text-button danger" onClick={() => handleDeleteAttachment(file)} type="button">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="small-action" onClick={() => fileInputRef.current?.click()} style={{ marginTop: '0.5rem' }} type="button">
            Attach file
          </button>
          <input hidden onChange={handleUploadAttachment} ref={fileInputRef} type="file" />
        </div>

        <div className="task-modal-field">
          <label>
            Comments · Creator: {task.creator?.full_name ?? 'Unknown'} · Created {timeAgo(task.createdAt)}
          </label>
          <div className="user-list">
            {comments.length === 0 ? (
              <p className="empty-state-inline">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div className="task-comment" key={comment.id}>
                  <div className="task-comment-header">
                    <span>
                      <strong>{comment.profiles?.full_name ?? 'Member'}</strong> · {timeAgo(comment.created_at)}
                    </span>
                    {comment.author_id === currentUser.id && editingCommentId !== comment.id && (
                      <span className="row-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            setEditingCommentId(comment.id)
                            setEditingCommentText(comment.content)
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button className="text-button danger" onClick={() => handleDeleteComment(comment.id)} type="button">
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        aria-label="Edit comment"
                        onChange={(event) => setEditingCommentText(event.target.value)}
                        style={{ flex: 1 }}
                        value={editingCommentText}
                      />
                      <button className="small-action" onClick={() => handleSaveComment(comment.id)} type="button">
                        Save
                      </button>
                    </div>
                  ) : (
                    <p>{comment.content}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <form className="inline-form" onSubmit={handleAddComment} style={{ marginTop: '0.75rem' }}>
            <input
              aria-label="Add a comment"
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a comment…"
              value={commentDraft}
            />
            <Button disabled={!commentDraft.trim()} type="submit">
              Comment
            </Button>
          </form>
        </div>

        {canDelete && (
          <div className="settings-danger" style={{ marginTop: '1rem' }}>
            <div>
              <strong>Delete task</strong>
              <span>This cannot be undone.</span>
            </div>
            <button className="small-action danger" onClick={handleDelete} type="button">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
