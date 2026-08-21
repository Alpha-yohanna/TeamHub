import { supabase } from '../lib/supabaseClient'

const PROJECT_SELECT =
  'id, name, description, status, start_date, due_date, created_at, updated_at, archived_at, owner_id, team_id, profiles!owner_id (id, full_name, username, avatar_url), teams (id, name), project_members (id)'

function mapProject(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.start_date,
    dueDate: project.due_date,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    archivedAt: project.archived_at,
    ownerId: project.owner_id,
    owner: project.profiles ?? null,
    teamId: project.team_id,
    teamName: project.teams?.name ?? null,
    memberCount: project.project_members?.length ?? 0,
  }
}

export async function searchProjects(workspaceId, queryText, limit = 8) {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${trimmed}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapProject)
}

export async function listProjects(workspaceId) {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapProject)
}

export async function createProject({ workspaceId, name, description, teamId = null, startDate = null, dueDate = null, ownerId }) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name,
      description,
      team_id: teamId,
      start_date: startDate,
      due_date: dueDate,
      owner_id: ownerId,
    })
    .select(PROJECT_SELECT)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: data.id, user_id: ownerId, added_by: ownerId })

  if (memberError) {
    throw new Error(memberError.message)
  }

  return mapProject(data)
}

export async function updateProject({ projectId, ...updates }) {
  const payload = {}
  if ('name' in updates) payload.name = updates.name
  if ('description' in updates) payload.description = updates.description
  if ('teamId' in updates) payload.team_id = updates.teamId
  if ('startDate' in updates) payload.start_date = updates.startDate
  if ('dueDate' in updates) payload.due_date = updates.dueDate
  if ('status' in updates) {
    payload.status = updates.status
    payload.archived_at = updates.status === 'archived' ? new Date().toISOString() : null
  }

  const { data, error } = await supabase.from('projects').update(payload).eq('id', projectId).select(PROJECT_SELECT).single()

  if (error) {
    throw new Error(error.message)
  }

  return mapProject(data)
}

export async function listProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, joined_at, profiles!user_id (id, full_name, username, email, avatar_url, status)')
    .eq('project_id', projectId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    membershipId: row.id,
    joinedAt: row.joined_at,
    ...row.profiles,
  }))
}

export async function addProjectMember({ projectId, userId, addedBy }) {
  const { error } = await supabase.from('project_members').insert({ project_id: projectId, user_id: userId, added_by: addedBy })

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeProjectMember(membershipId) {
  const { error } = await supabase.from('project_members').delete().eq('id', membershipId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getProjectTaskCounts(projectId) {
  const [total, completed] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'completed'),
  ])

  if (total.error) throw new Error(total.error.message)
  if (completed.error) throw new Error(completed.error.message)

  return { totalTasks: total.count ?? 0, completedTasks: completed.count ?? 0 }
}

export async function getWorkspaceProjectStats(workspaceId) {
  const [totalProjects, activeProjects, openTasks, completedTasks] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'active'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .neq('status', 'completed'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'completed'),
  ])

  for (const result of [totalProjects, activeProjects, openTasks, completedTasks]) {
    if (result.error) throw new Error(result.error.message)
  }

  return {
    projectCount: totalProjects.count ?? 0,
    activeProjectCount: activeProjects.count ?? 0,
    openTaskCount: openTasks.count ?? 0,
    completedTaskCount: completedTasks.count ?? 0,
  }
}
