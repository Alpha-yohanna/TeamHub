import { useState } from 'react'
import { timeAgo } from '../../lib/formatters'

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'completed', label: 'Completed' },
]

export function TaskCard({ task, commentCount = 0, hasAttachment = false, onClick }) {
  return (
    <button className="kanban-card" onClick={onClick} type="button">
      <strong>{task.title}</strong>

      {task.labels.length > 0 && (
        <div className="kanban-card-labels">
          {task.labels.map((label) => (
            <span className="task-label-chip" key={label.id} style={{ background: `${label.color}22`, color: label.color }}>
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="kanban-card-footer">
        <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
        <span>{task.dueDate ? timeAgo(task.dueDate) : ''}</span>
      </div>

      <div className="kanban-card-footer">
        <span>
          {commentCount > 0 && `💬 ${commentCount}`}
          {hasAttachment && ' 📎'}
        </span>
        {task.assignee && (
          <span className="avatar" title={task.assignee.full_name}>
            {(task.assignee.full_name || '?').slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </button>
  )
}

export function KanbanBoard({ tasks, commentCounts = {}, attachmentTaskIds = new Set(), onStatusChange, onCardClick }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  function handleDrop(event, columnId) {
    event.preventDefault()
    setDragOverColumn(null)
    const taskId = event.dataTransfer.getData('text/plain')
    const task = tasks.find((item) => item.id === taskId)
    if (task && task.status !== columnId) {
      onStatusChange(task, columnId)
    }
    setDraggedTaskId(null)
  }

  return (
    <div className="kanban-board">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id)

        return (
          <div className="kanban-column" key={column.id}>
            <div className="kanban-column-header">
              <span>{column.label}</span>
              <span>{columnTasks.length}</span>
            </div>
            <div
              className={`kanban-cards${dragOverColumn === column.id ? ' drag-over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverColumn(column.id)
              }}
              onDragLeave={() => setDragOverColumn((current) => (current === column.id ? null : current))}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              {columnTasks.map((task) => (
                <div
                  className={draggedTaskId === task.id ? 'dragging' : ''}
                  draggable
                  key={task.id}
                  onDragEnd={() => setDraggedTaskId(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', task.id)
                    setDraggedTaskId(task.id)
                  }}
                >
                  <TaskCard
                    commentCount={commentCounts[task.id] ?? 0}
                    hasAttachment={attachmentTaskIds.has(task.id)}
                    onClick={() => onCardClick(task)}
                    task={task}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
