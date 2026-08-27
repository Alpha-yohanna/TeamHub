import { supabase } from '../lib/supabaseClient'

// reply_to embeds the original message a reply points to, via the existing parent_message_id
// self-reference — reused as-is rather than adding a new column, since it already models exactly
// this relationship (it previously only powered the separate thread-panel view).
const MESSAGE_SELECT =
  'id, channel_id, content, created_at, edited_at, deleted_at, parent_message_id, reply_count, sender_id, profiles!sender_id (id, full_name, username, avatar_url), message_reactions (id, user_id, emoji), message_mentions (mentioned_user_id), files (id, name, mime_type, size_bytes, storage_path), reply_to:messages!parent_message_id (id, content, deleted_at, sender_id, profiles!sender_id (full_name))'

function groupReactions(rows) {
  const map = new Map()
  for (const reaction of rows ?? []) {
    if (!map.has(reaction.emoji)) map.set(reaction.emoji, [])
    map.get(reaction.emoji).push(reaction.user_id)
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, userIds }))
}

function mapReplyTo(row) {
  if (!row) return null
  return {
    id: row.id,
    content: row.deleted_at ? null : row.content,
    deletedAt: row.deleted_at,
    senderId: row.sender_id,
    senderName: row.profiles?.full_name ?? 'Member',
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    channelId: row.channel_id,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    parentMessageId: row.parent_message_id,
    replyTo: mapReplyTo(row.reply_to),
    replyCount: row.reply_count,
    senderId: row.sender_id,
    sender: row.profiles ?? null,
    reactions: groupReactions(row.message_reactions),
    mentionedUserIds: (row.message_mentions ?? []).map((mention) => mention.mentioned_user_id),
    attachments: row.files ?? [],
  }
}

// --- Channels (public workspace/team/project channels) ---

export async function listChannels(workspaceId) {
  const { data, error } = await supabase
    .from('channels')
    .select('id, name, description, team_id, project_id, is_private, last_message_at, created_at, teams (name)')
    .eq('workspace_id', workspaceId)
    .eq('type', 'channel')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((channel) => ({ ...channel, teamName: channel.teams?.name ?? null }))
}

export async function listTeamChannels(teamId) {
  const { data, error } = await supabase
    .from('channels')
    .select('id, name, description, team_id, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listProjectChannels(projectId) {
  const { data, error } = await supabase
    .from('channels')
    .select('id, name, description, project_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

// Client-generates the id so channel_members rows for a private channel can be inserted right
// after, without ever chaining .select() onto the same INSERT (see Phase 4 RETURNING lesson —
// a brand-new private channel's own SELECT policy can't see it as "mine" until the membership
// row exists, so a chained .select() on this insert would spuriously fail).
export async function createChannel({
  workspaceId,
  name,
  description,
  createdBy,
  teamId = null,
  projectId = null,
  isPrivate = false,
  memberIds = [],
}) {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('channels').insert({
    id,
    workspace_id: workspaceId,
    name,
    description,
    created_by: createdBy,
    team_id: teamId,
    project_id: projectId,
    is_private: isPrivate,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (isPrivate) {
    const memberRows = [createdBy, ...memberIds.filter((memberId) => memberId !== createdBy)].map((userId) => ({
      channel_id: id,
      user_id: userId,
    }))
    const { error: memberError } = await supabase.from('channel_members').insert(memberRows)
    if (memberError) {
      throw new Error(memberError.message)
    }
  }

  const { data, error: fetchError } = await supabase
    .from('channels')
    .select('id, name, description, team_id, project_id, type, is_private, created_at')
    .eq('id', id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  return data
}

export async function listChannelMembers(channelId) {
  const { data, error } = await supabase
    .from('channel_members')
    .select('id, joined_at, profiles (id, full_name, username, email, avatar_url, status)')
    .eq('channel_id', channelId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({ membershipId: row.id, joinedAt: row.joined_at, ...row.profiles }))
}

export async function addChannelMember({ channelId, userId }) {
  const { error } = await supabase.from('channel_members').insert({ channel_id: channelId, user_id: userId })

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeChannelMember({ membershipId }) {
  const { error } = await supabase.from('channel_members').delete().eq('id', membershipId)

  if (error) {
    throw new Error(error.message)
  }
}

// --- Direct messages & group conversations ---

export async function getOrCreateDM(otherUserId, workspaceId) {
  const { data, error } = await supabase.rpc('get_or_create_dm', {
    other_user_id: otherUserId,
    p_workspace_id: workspaceId,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createGroupConversation({ workspaceId, name, memberIds, createdBy }) {
  return createChannel({ workspaceId, name, description: null, createdBy, isPrivate: true, memberIds })
}

export async function listConversations(workspaceId, userId) {
  const { data: memberships, error: memberError } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('user_id', userId)

  if (memberError) {
    throw new Error(memberError.message)
  }

  const memberChannelIds = (memberships ?? []).map((row) => row.channel_id)
  if (memberChannelIds.length === 0) {
    return []
  }

  const { data: channels, error: channelsError } = await supabase
    .from('channels')
    .select('id, name, type, created_by, last_message_at, created_at')
    .in('id', memberChannelIds)
    .eq('workspace_id', workspaceId)
    .in('type', ['dm', 'group'])

  if (channelsError) {
    throw new Error(channelsError.message)
  }
  if ((channels ?? []).length === 0) {
    return []
  }

  const channelIds = channels.map((channel) => channel.id)

  const [allMembersResult, latestMessagesResult, unreadCounts] = await Promise.all([
    supabase.from('channel_members').select('channel_id, user_id, profiles (id, full_name, username, avatar_url)').in('channel_id', channelIds),
    supabase
      .from('messages')
      .select('channel_id, content, created_at, sender_id, deleted_at')
      .in('channel_id', channelIds)
      .order('created_at', { ascending: false }),
    getChannelUnreadCounts(channelIds, userId),
  ])

  if (allMembersResult.error) throw new Error(allMembersResult.error.message)
  if (latestMessagesResult.error) throw new Error(latestMessagesResult.error.message)

  const membersByChannel = new Map()
  for (const row of allMembersResult.data ?? []) {
    if (!membersByChannel.has(row.channel_id)) membersByChannel.set(row.channel_id, [])
    if (row.profiles) membersByChannel.get(row.channel_id).push(row.profiles)
  }

  const latestByChannel = new Map()
  for (const message of latestMessagesResult.data ?? []) {
    if (!latestByChannel.has(message.channel_id)) latestByChannel.set(message.channel_id, message)
  }

  return channels
    .map((channel) => {
      const members = membersByChannel.get(channel.id) ?? []
      const otherMembers = members.filter((member) => member.id !== userId)
      const displayName =
        channel.type === 'dm'
          ? (otherMembers[0]?.full_name ?? 'Direct message')
          : (channel.name || otherMembers.map((member) => member.full_name).join(', ') || 'Group conversation')
      const latest = latestByChannel.get(channel.id)

      return {
        id: channel.id,
        type: channel.type,
        name: displayName,
        members,
        otherMembers,
        lastMessage: latest ? (latest.deleted_at ? 'Message deleted' : latest.content) : null,
        lastMessageAt: channel.last_message_at ?? channel.created_at,
        unreadCount: unreadCounts[channel.id] ?? 0,
      }
    })
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
}

// --- Unread tracking ---

export async function getChannelUnreadCounts(channelIds, userId) {
  if (!channelIds || channelIds.length === 0) return {}

  const { data: reads, error: readsError } = await supabase
    .from('channel_reads')
    .select('channel_id, last_read_at')
    .eq('user_id', userId)
    .in('channel_id', channelIds)

  if (readsError) {
    throw new Error(readsError.message)
  }

  const readMap = new Map((reads ?? []).map((row) => [row.channel_id, row.last_read_at]))

  const counts = await Promise.all(
    channelIds.map((channelId) => {
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .neq('sender_id', userId)

      const since = readMap.get(channelId)
      if (since) {
        query = query.gt('created_at', since)
      }
      return query
    })
  )

  const result = {}
  channelIds.forEach((channelId, index) => {
    result[channelId] = counts[index].count ?? 0
  })
  return result
}

export async function markChannelRead({ channelId, userId }) {
  const { error } = await supabase
    .from('channel_reads')
    .upsert({ channel_id: channelId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: 'channel_id,user_id' })

  if (error) {
    throw new Error(error.message)
  }
}

// --- Messages ---

export async function listRecentWorkspaceMessages(workspaceId, limit = 5) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, created_at, sender_id, deleted_at, channels (name), profiles!sender_id (full_name, username)')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listMessages(channelId, { limit = 40, before } = {}) {
  // Replies (parent_message_id set) are now shown inline in the main timeline with a quoted
  // reference to their original message, in addition to remaining visible in the focused
  // thread view (listThreadReplies) — so this no longer excludes them.
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).reverse().map(mapMessage)
}

export async function listThreadReplies(parentMessageId) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('parent_message_id', parentMessageId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapMessage)
}

export async function sendMessage({ workspaceId, channelId, senderId, content, parentMessageId = null, mentionedUserIds = [] }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ workspace_id: workspaceId, channel_id: channelId, sender_id: senderId, content, parent_message_id: parentMessageId })
    .select(MESSAGE_SELECT)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (mentionedUserIds.length > 0) {
    const rows = mentionedUserIds.map((userId) => ({ message_id: data.id, mentioned_user_id: userId }))
    const { error: mentionError } = await supabase.from('message_mentions').insert(rows)
    if (mentionError) {
      throw new Error(mentionError.message)
    }
  }

  return mapMessage({ ...data, message_mentions: mentionedUserIds.map((userId) => ({ mentioned_user_id: userId })) })
}

export async function editMessage({ messageId, content }) {
  const { data, error } = await supabase
    .from('messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .select(MESSAGE_SELECT)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapMessage(data)
}

export async function deleteMessage(messageId) {
  const { error } = await supabase.from('messages').update({ content: null, deleted_at: new Date().toISOString() }).eq('id', messageId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function toggleReaction({ messageId, userId, emoji }) {
  const { data: existing, error: findError } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  if (existing) {
    const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
    return 'removed'
  }

  const { error } = await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
  if (error) {
    throw new Error(error.message)
  }
  return 'added'
}

export async function listChannelAttachments(channelId) {
  // Single query via an inner-joined filter on the parent message's channel_id, instead of first
  // fetching every message id in the channel and then querying files by that id list.
  const { data, error } = await supabase
    .from('files')
    .select('id, name, mime_type, size_bytes, storage_path, created_at, uploaded_by, profiles (full_name), messages!inner (channel_id)')
    .eq('messages.channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

// --- Search ---

export async function searchMessages(workspaceId, queryText, limit = 20) {
  const trimmed = queryText.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('messages')
    .select('id, channel_id, content, created_at, sender_id, profiles!sender_id (full_name), channels (name, type)')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .ilike('content', `%${trimmed}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

// --- Realtime ---

export function subscribeToChannelMessages(channelId, { onInsert, onUpdate, onStatusChange } = {}) {
  // Unique per call (not just per channelId) — ChannelPanel and ThreadPanel can both be
  // subscribed to the same channelId at once (main view + open thread), and supabase-js throws
  // if a second .on() is attached to an already-.subscribe()'d channel of the same topic name.
  const channel = supabase
    .channel(`messages:${channelId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
      (payload) => onInsert?.(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
      (payload) => onUpdate?.(payload.new)
    )
    .subscribe((status) => onStatusChange?.(status))

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToReactions(onChange) {
  const channel = supabase
    .channel(`message-reactions-live:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToWorkspaceMessageActivity(workspaceId, onMessage) {
  const channel = supabase
    .channel(`workspace-messages:${workspaceId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => onMessage(payload.new)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
