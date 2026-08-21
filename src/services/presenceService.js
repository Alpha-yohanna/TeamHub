import { supabase } from '../lib/supabaseClient'

export function subscribeToWorkspacePresence(workspaceId, userId, onChange) {
  // private: true routes this channel's join/track through Realtime Authorization (RLS on
  // realtime.messages, see migration 036) instead of allowing any authenticated client to join —
  // presence channels have no table behind them, so without this any user who knew or guessed a
  // workspace_id could see who else was online in a workspace they don't belong to.
  const channel = supabase.channel(`presence:${workspaceId}`, {
    config: { private: true, presence: { key: userId } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      onChange(new Set(Object.keys(channel.presenceState())))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() })
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}
