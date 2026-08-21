import { supabase } from '../lib/supabaseClient'

const TASK_SELECT =
  'id, project_id, workspace_id, title, description, status, priority, due_date, created_at, updated_at, assignee_id, creator_id, assignee:profiles!assignee_id (id, full_name, username, avatar_url), creator:profiles!creator_id (id, full_name, username), task_label_assignments (task_labels (id, name, color))'

function mapTask(task) {
  return {
    id: task.id,
    projectId: task.project_id,
    workspaceId: task.workspace_id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    assigneeId: task.assignee_id,
    assignee: task.assignee ?? null,
    creatorId: task.creator_id,
    creator: task.creator ?? null,
    labels: (task.task_label_assignments ?? []).map((row) => row.task_labels).filter(Boolean),
  }
}

export async function searchTasks(workspaceId, queryText, limit = 8) {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id, project_id, workspace_id, title, status, priority, due_date, assignee_id, assignee:profiles!assignee_id (id, full_name, username, avatar_url), projects (id, name)'
    )
    .eq('workspace_id', workspaceId)
    .ilike('title', `%${trimmed}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((task) => ({
    id: task.id,
    projectId: task.project_id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date,
    assignee: task.assignee ?? null,
    projectName: task.projects?.name ?? null,
  }))
}

export async function listTasks(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapTask)
}

export async function createTask({ projectId, workspaceId, title, description = null, priority = 'medium', assigneeId = null, dueDate = null, creatorId }) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: projectId,
      workspace_id: workspaceId,
      title,
      description,
      priority,
      assignee_id: assigneeId,
      due_date: dueDate,
      creator_id: creatorId,
    })
    .select(TASK_SELECT)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapTask(data)
}

export async function updateTask({ taskId, ...updates }) {
  const payload = {}
  if ('title' in updates) payload.title = updates.title
  if ('description' in updates) payload.description = updates.description
  if ('status' in updates) payload.status = updates.status
  if ('priority' in updates) payload.priority = updates.priority
  if ('dueDate' in updates) payload.due_date = updates.dueDate
  if ('assigneeId' in updates) payload.assignee_id = updates.assigneeId

  const { data, error } = await supabase.from('tasks').update(payload).eq('id', taskId).select(TASK_SELECT).single()

  if (error) {
    throw new Error(error.message)
  }

  return mapTask(data)
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function listTaskLabels(workspaceId) {
  const { data, error } = await supabase
    .from('task_labels')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function createTaskLabel({ workspaceId, name, color }) {
  const { data, error } = await supabase
    .from('task_labels')
    .insert({ workspace_id: workspaceId, name, color })
    .select('id, name, color')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function addLabelToTask({ taskId, labelId }) {
  const { error } = await supabase.from('task_label_assignments').insert({ task_id: taskId, label_id: labelId })

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeLabelFromTask({ taskId, labelId }) {
  const { error } = await supabase.from('task_label_assignments').delete().eq('task_id', taskId).eq('label_id', labelId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function listTaskCommentCounts(projectId) {
  const { data, error } = await supabase
    .from('task_comments')
    .select('task_id, tasks!inner (project_id)')
    .eq('tasks.project_id', projectId)

  if (error) {
    throw new Error(error.message)
  }

  const counts = {}
  for (const row of data ?? []) {
    counts[row.task_id] = (counts[row.task_id] ?? 0) + 1
  }
  return counts
}

export async function listTaskComments(taskId) {
  const { data, error } = await supabase
    .from('task_comments')
    .select('id, content, created_at, updated_at, author_id, profiles (id, full_name, username, avatar_url)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function addTaskComment({ taskId, authorId, content }) {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, author_id: authorId, content })
    .select('id, content, created_at, updated_at, author_id, profiles (id, full_name, username, avatar_url)')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function updateTaskComment({ commentId, content }) {
  const { data, error } = await supabase
    .from('task_comments')
    .update({ content })
    .eq('id', commentId)
    .select('id, content, created_at, updated_at, author_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteTaskComment(commentId) {
  const { error } = await supabase.from('task_comments').delete().eq('id', commentId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function listMyAssignedTasks(workspaceId, userId, limit = 5) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id, projects (name)')
    .eq('workspace_id', workspaceId)
    .eq('assignee_id', userId)
    .neq('status', 'completed')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((task) => ({ ...task, projectName: task.projects?.name ?? null }))
}

export async function listUpcomingDeadlines(workspaceId, limit = 5) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, project_id, assignee_id, projects (name), assignee:profiles!assignee_id (full_name)')
    .eq('workspace_id', workspaceId)
    .neq('status', 'completed')
    .not('due_date', 'is', null)
    .gte('due_date', new Date().toISOString().slice(0, 10))
    .order('due_date', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((task) => ({ ...task, projectName: task.projects?.name ?? null }))
}
