import { supabase } from '../lib/supabaseClient'

const NOTIFICATION_SELECT =
  'id, type, title, message, read_at, created_at, target_type, target_id, metadata, profiles!notifications_actor_id_fkey (id, full_name, username)'

export async function listNotifications(userId, { readState, workspaceId } = {}) {
  let query = supabase.from('notifications').select(NOTIFICATION_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(100)

  if (readState === 'unread') {
    query = query.is('read_at', null)
  } else if (readState === 'read') {
    query = query.not('read_at', 'is', null)
  }
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getUnreadNotificationCount(userId, workspaceId) {
  let query = supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null)

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function markAllNotificationsRead(userId, workspaceId) {
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteNotification(notificationId) {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId)

  if (error) {
    throw new Error(error.message)
  }
}

// Recipient preference enforcement (Settings > Notifications) happens server-side via a BEFORE
// INSERT trigger (migration 032) rather than here — the sender's client can't read the
// recipient's user_preferences row (RLS is rightly self-only), so only the database can check it
// and silently drop a suppressed insert. Suppressed calls still resolve normally from here.
export async function createNotification({
  workspaceId,
  userId,
  actorId,
  type,
  title,
  message = null,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  const { error } = await supabase.from('notifications').insert({
    workspace_id: workspaceId,
    user_id: userId,
    actor_id: actorId,
    type,
    title,
    message,
    target_type: targetType,
    target_id: targetId,
    metadata,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export function subscribeToNotifications(userId, { onInsert, onUpdate }) {
  const channel = supabase
    .channel(`notifications:${userId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert?.(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onUpdate?.(payload.new)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
