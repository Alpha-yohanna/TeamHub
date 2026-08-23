import { supabase } from '../lib/supabaseClient'

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, role, status, bio')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Your account profile has not been set up yet. Please contact support.')
  }

  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, full_name, username, avatar_url, role, status, bio')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

export async function uploadAvatar(userId, file) {
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Avatar images must be under 5MB.')
  }
  if (!file.type?.startsWith('image/')) {
    throw new Error('Avatar must be an image file.')
  }

  const extension = file.name.split('.').pop() || 'png'
  const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(storagePath, file)
  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath)
  return updateProfile(userId, { avatar_url: publicUrlData.publicUrl })
}

export async function getUserPreferences(userId) {
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (
    data ?? {
      user_id: userId,
      theme: 'light',
      notify_mentions: true,
      notify_direct_messages: true,
      notify_task_assignments: true,
      notify_project_updates: true,
      notify_team_activity: true,
      notify_file_sharing: true,
    }
  )
}

export async function updateUserPreferences(userId, updates) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createWorkspace({ name, description = null, orgType = null, ownerId }) {
  const slug = `${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 6)}`

  // The workspaces SELECT policy requires an existing workspace_members row, which doesn't exist
  // until the second insert below — so insert().select() here would return zero rows (PostgREST's
  // RETURNING is itself RLS-gated). Generate the id client-side and insert without chaining
  // select, then re-query once membership exists.
  const workspaceId = crypto.randomUUID()

  const { error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ id: workspaceId, name: name.trim(), slug, description, org_type: orgType, owner_id: ownerId })

  if (workspaceError) {
    throw new Error(workspaceError.message)
  }

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: ownerId, role: 'owner' })

  if (memberError) {
    throw new Error(memberError.message)
  }

  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('id, name, slug, description, org_type, team_size, use_case, onboarding_step, onboarding_completed_at, created_at')
    .eq('id', workspaceId)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  return workspace
}

export async function updateWorkspace(workspaceId, updates) {
  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', workspaceId)
    .select('id, name, slug, description, org_type, team_size, use_case, onboarding_step, onboarding_completed_at, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function listMyWorkspaces(userId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(
      'role, joined_at, workspaces (id, name, slug, description, org_type, team_size, use_case, onboarding_step, onboarding_completed_at, created_at)'
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const workspaces = data ?? []

  const counts = await Promise.all(
    workspaces.map((row) =>
      supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', row.workspaces.id)
    )
  )

  return workspaces.map((row, index) => ({
    ...row.workspaces,
    role: row.role,
    memberCount: counts[index].count ?? 1,
  }))
}

export async function listWorkspaceMembers(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, joined_at, profiles (id, full_name, username, email, avatar_url, status)')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    ...row.profiles,
    membershipId: row.id,
    workspaceRole: row.role,
    joinedAt: row.joined_at,
  }))
}

export async function searchMembers(workspaceId, queryText, limit = 10) {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, profiles!inner (id, full_name, username, email, avatar_url)')
    .eq('workspace_id', workspaceId)
    .or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%,email.ilike.%${trimmed}%`, { foreignTable: 'profiles' })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? [])
    .filter((row) => row.profiles)
    .map((row) => ({ ...row.profiles, workspaceRole: row.role }))
}

export async function updateMemberRole({ membershipId, role }) {
  const { error } = await supabase.from('workspace_members').update({ role }).eq('id', membershipId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeWorkspaceMember(membershipId) {
  const { error } = await supabase.from('workspace_members').delete().eq('id', membershipId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function inviteToWorkspace({ workspaceId, email, invitedBy, role = 'member' }) {
  const { data, error } = await supabase
    .from('invitations')
    .insert({ workspace_id: workspaceId, email: email.trim().toLowerCase(), invited_by: invitedBy, role })
    .select('id, email, role, status, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  let emailSent = false
  try {
    const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
      body: { invitationId: data.id },
    })
    emailSent = !emailError
  } catch {
    emailSent = false
  }

  return { ...data, emailSent }
}

export async function listWorkspaceInvitations(workspaceId) {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, created_at, accepted_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function revokeInvitation(invitationId) {
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function listMyPendingInvitations(email) {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, role, created_at, workspaces (name), profiles!invitations_invited_by_fkey (full_name)')
    .eq('status', 'pending')
    .ilike('email', email)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function acceptInvitation(invitationId) {
  const { error } = await supabase.rpc('accept_invitation', { target_invitation_id: invitationId })

  if (error) {
    throw new Error(error.message)
  }
}

export async function declineInvitation(invitationId) {
  const { error } = await supabase.rpc('decline_invitation', { target_invitation_id: invitationId })

  if (error) {
    throw new Error(error.message)
  }
}

export async function getWorkspaceStats(workspaceId) {
  const [members, teams, files, messages, pendingInvites] = await Promise.all([
    supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('files').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending'),
  ])

  for (const result of [members, teams, files, messages, pendingInvites]) {
    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  return {
    memberCount: members.count ?? 0,
    teamCount: teams.count ?? 0,
    fileCount: files.count ?? 0,
    messageCount: messages.count ?? 0,
    pendingInviteCount: pendingInvites.count ?? 0,
  }
}
