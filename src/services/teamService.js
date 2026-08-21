import { supabase } from '../lib/supabaseClient'

function mapTeam(team) {
  const members = team.team_members ?? []
  const lead = members.find((member) => member.role === 'lead')?.profiles ?? null

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    icon: team.icon,
    createdAt: team.created_at,
    memberCount: members.length,
    lead,
  }
}

export async function listTeams(workspaceId) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, description, icon, created_at, team_members (id, role, profiles (id, full_name, username, avatar_url))')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapTeam)
}

export async function searchTeams(workspaceId, queryText, limit = 8) {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('teams')
    .select('id, name, description, icon, created_at, team_members (id)')
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${trimmed}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapTeam)
}

export async function createTeam({ workspaceId, name, description, icon = null, createdBy }) {
  const { data, error } = await supabase
    .from('teams')
    .insert({ workspace_id: workspaceId, name, description, icon, created_by: createdBy })
    .select('id, name, description, icon, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const { error: memberError } = await supabase
    .from('team_members')
    .insert({ team_id: data.id, user_id: createdBy, role: 'lead' })

  if (memberError) {
    throw new Error(memberError.message)
  }

  return data
}

export async function updateTeam({ teamId, name, description, icon }) {
  const { data, error } = await supabase
    .from('teams')
    .update({ name, description, icon })
    .eq('id', teamId)
    .select('id, name, description, icon, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function listTeamMembers(teamId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, role, joined_at, profiles (id, full_name, username, email, avatar_url, status)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    membershipId: row.id,
    role: row.role,
    joinedAt: row.joined_at,
    ...row.profiles,
  }))
}

export async function addTeamMember({ teamId, userId, role = 'member' }) {
  const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId, role })

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeTeamMember(membershipId) {
  const { error } = await supabase.from('team_members').delete().eq('id', membershipId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function setTeamLead({ teamId, userId }) {
  const { error } = await supabase.rpc('set_team_lead', { target_team_id: teamId, target_user_id: userId })

  if (error) {
    throw new Error(error.message)
  }
}
