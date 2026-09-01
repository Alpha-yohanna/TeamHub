import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { getProfile } from "./workspaceService";

const NOT_CONFIGURED_MESSAGE =
  "TeamHub is not connected to a database right now. Please contact your administrator.";

/**
 * Build the TeamHub session from the authenticated Supabase user.
 */
async function buildSupabaseSession(authUser) {
  if (!authUser) {
    throw new Error("No authenticated user was returned by Supabase.");
  }

  const profile = await getProfile(authUser.id);

  if (!profile) {
    throw new Error(
      "Your account was created, but your TeamHub profile could not be loaded. Please try again.",
    );
  }

  // Platform-wide (not per-workspace) admin flag, backed by the super_admins table —
  // failing closed to `false` on any error so a lookup hiccup never grants admin UI.
  let isSuperAdmin = false;
  try {
    const { data, error } = await supabase.rpc("is_super_admin");
    isSuperAdmin = !error && data === true;
  } catch {
    isSuperAdmin = false;
  }

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
      isSuperAdmin,
    },
    source: "supabase",
  };
}

/**
 * Create a new TeamHub account with email and password.
 *
 * Supabase only returns an active session immediately when email
 * confirmation is disabled. With confirmation enabled (the intended,
 * supported configuration for TeamHub), signUp() returns a user but
 * no session — the account exists but is unverified until the user
 * clicks the link in the confirmation email. That is not an error;
 * callers should treat it as a "check your email" outcome, not a
 * failure to sign in.
 */
export async function signUpWithEmail({ email, password, fullName }) {
  if (!isSupabaseConfigured) {
    throw new Error(NOT_CONFIGURED_MESSAGE);
  }

  const cleanEmail = email.trim();
  const cleanFullName = fullName.trim();

  if (!cleanEmail) {
    throw new Error("Please enter your email address.");
  }

  if (!cleanFullName) {
    throw new Error("Please enter your full name.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: cleanFullName,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.user) {
    throw new Error("Account could not be created. Please try again.");
  }

  if (!data.session) {
    return {
      status: "confirmation_required",
      email: cleanEmail,
    };
  }

  const session = await buildSupabaseSession(data.user);
  return { status: "signed_in", ...session };
}

/**
 * Sign in an existing TeamHub user.
 */
export async function signInWithEmail({ email, password }) {
  if (!isSupabaseConfigured) {
    throw new Error(NOT_CONFIGURED_MESSAGE);
  }

  const cleanEmail = email.trim();

  if (!cleanEmail) {
    throw new Error("Please enter your email address.");
  }

  if (!password) {
    throw new Error("Please enter your password.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.user) {
    throw new Error("Unable to sign in. Please try again.");
  }

  const session = await buildSupabaseSession(data.user);
  return { status: "signed_in", ...session };
}

/**
 * Get the currently active Supabase session.
 */
export async function getActiveSession() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    return null;
  }

  try {
    return await buildSupabaseSession(data.session.user);
  } catch {
    return null;
  }
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Change the currently authenticated user's password.
 */
export async function changePassword(newPassword) {
  if (!isSupabaseConfigured) {
    throw new Error("Password changes require a live TeamHub account.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Sign out the user from every active session
 * across all devices and browsers.
 */
export async function signOutEverywhere() {
  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await supabase.auth.signOut({
    scope: "global",
  });

  if (error) {
    throw new Error(error.message);
  }
}
