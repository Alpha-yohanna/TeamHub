import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getProfile } from './workspaceService'

const NOT_CONFIGURED_MESSAGE = 'TeamHub is not connected to a database right now. Please contact your administrator.'

async function buildSupabaseSession(authUser) {
  const profile = await getProfile(authUser.id)

  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      name: profile.full_name,
      username: profile.username,
      role: profile.role,
      status: profile.status,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
    },
    source: 'supabase',
  }
}

export async function signUpWithEmail({ email, password, fullName }) {
  if (!isSupabaseConfigured) {
    throw new Error(NOT_CONFIGURED_MESSAGE)
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data.session) {
    return {
      user: { id: data.user.id, email: data.user.email, name: fullName, role: 'owner' },
      source: 'supabase',
      requiresEmailConfirmation: true,
    }
  }

  return buildSupabaseSession(data.user)
}

export async function signInWithEmail({ email, password }) {
  if (!isSupabaseConfigured) {
    throw new Error(NOT_CONFIGURED_MESSAGE)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  return buildSupabaseSession(data.user)
}

export async function getActiveSession() {
  if (!isSupabaseConfigured) {
    return null
  }

  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    return null
  }

  return buildSupabaseSession(data.session.user)
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return
  }

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function changePassword(newPassword) {
  if (!isSupabaseConfigured) {
    throw new Error('Password changes require a live TeamHub account.')
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    throw new Error(error.message)
  }
}

// Signs out every active session for this account (all devices/browsers), not just this one.
export async function signOutEverywhere() {
  if (!isSupabaseConfigured) {
    return
  }

  const { error } = await supabase.auth.signOut({ scope: 'global' })

  if (error) {
    throw new Error(error.message)
  }
}
