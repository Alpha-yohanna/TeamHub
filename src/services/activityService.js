import { supabase } from '../lib/supabaseClient'

export function describeActivity(entry) {
  const actor = entry.profiles?.full_name || 'Someone'
  const name = entry.metadata?.name

  switch (entry.action) {
    case 'team.created':
      return `${actor} created team "${name}"`
    case 'team.member_added':
      return `${actor} added ${name} to the team`
    case 'team.member_removed':
      return `${actor} removed ${name} from the team`
    case 'team.lead_assigned':
      return `${actor} made ${name} the team lead`
    case 'channel.created':
      return `${actor} created channel #${name}`
    case 'file.uploaded':
      return `${actor} uploaded ${name}`
    case 'file.renamed':
      return `${actor} renamed "${entry.metadata?.previousName}" to "${name}"`
    case 'file.deleted':
      return `${actor} deleted ${name}`
    case 'file.shared':
      return `${actor} shared ${name} with ${entry.metadata?.target}`
    case 'folder.created':
      return `${actor} created folder "${name}"`
    case 'project.created':
      return `${actor} created project "${name}"`
    case 'project.updated':
      return `${actor} updated project "${name}"`
    case 'project.archived':
      return `${actor} archived project "${name}"`
    case 'project.restored':
      return `${actor} restored project "${name}"`
    case 'project.member_added':
      return `${actor} added ${name} to the project`
    case 'project.member_removed':
      return `${actor} removed ${name} from the project`
    case 'task.created':
      return `${actor} created task "${name}"`
    case 'task.assigned':
      return `${actor} assigned "${name}" to ${entry.metadata?.assignee}`
    case 'task.status_changed':
      return `${actor} moved "${name}" to ${entry.metadata?.status}`
    case 'task.completed':
      return `${actor} completed "${name}"`
    case 'task.priority_changed':
      return `${actor} set "${name}" priority to ${entry.metadata?.priority}`
    case 'task.due_date_changed':
      return `${actor} changed the due date for "${name}"`
    case 'task.comment_added':
      return `${actor} commented on "${name}"`
    case 'member.invited':
      return `${actor} invited ${name} to the workspace`
    case 'member.joined':
      return `${name || actor} joined the workspace`
    case 'member.removed':
      return `${actor} removed ${name} from the workspace`
    default:
      return `${actor} ${entry.action}`
  }
}

// Category -> target_type mapping used for the Activity page filter tabs, so filtering happens
// server-side (via the indexed target_type column) instead of fetching everything and slicing
// client-side.
export const ACTIVITY_CATEGORIES = {
  teams: ['team'],
  projects: ['project'],
  tasks: ['task'],
  messages: ['channel'],
  files: ['file', 'folder'],
  members: ['member'],
}

export async function listActivity(workspaceId, limit = 20, { teamId, projectId, targetTypes } = {}) {
  let query = supabase
    .from('activity_logs')
    .select('id, action, target_type, target_id, metadata, created_at, profiles (id, full_name, username)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (teamId) {
    query = query.eq('team_id', teamId)
  }
  if (projectId) {
    query = query.eq('project_id', projectId)
  }
  if (targetTypes?.length) {
    query = query.in('target_type', targetTypes)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function logActivity({
  workspaceId,
  actorId,
  action,
  targetType,
  targetId = null,
  metadata = {},
  teamId = null,
  projectId = null,
}) {
  const { error } = await supabase.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    team_id: teamId,
    project_id: projectId,
  })

  if (error) {
    throw new Error(error.message)
  }
}
