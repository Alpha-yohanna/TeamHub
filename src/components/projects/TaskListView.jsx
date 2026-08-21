import { useMemo, useState } from 'react'

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
}

export function TaskListView({ tasks, projectMembers, onRowClick }) {
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [sortBy, setSortBy] = useState('due_date')

  const filtered = useMemo(() => {
    let result = tasks
    if (statusFilter) result = result.filter((task) => task.status === statusFilter)
    if (priorityFilter) result = result.filter((task) => task.priority === priorityFilter)
    if (assigneeFilter) result = result.filter((task) => task.assigneeId === assigneeFilter)

    return [...result].sort((a, b) => {
      if (sortBy === 'due_date') {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sortBy === 'created_at') {
        return b.createdAt.localeCompare(a.createdAt)
      }
      return 0
    })
  }, [tasks, statusFilter, priorityFilter, assigneeFilter, sortBy])

  return (
    <div>
      <div className="task-filters">
        <select aria-label="Filter by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by priority" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select aria-label="Filter by assignee" onChange={(event) => setAssigneeFilter(event.target.value)} value={assigneeFilter}>
          <option value="">All assignees</option>
          {projectMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
        <select aria-label="Sort by" onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
          <option value="due_date">Sort by due date</option>
          <option value="created_at">Sort by newest</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state-inline">No tasks match these filters.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="task-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due date</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id} onClick={() => onRowClick(task)}>
                  <td>{task.title}</td>
                  <td>{STATUS_LABELS[task.status]}</td>
                  <td>
                    <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                  </td>
                  <td>{task.assignee?.full_name ?? 'Unassigned'}</td>
                  <td>{task.dueDate ?? '—'}</td>
                  <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
