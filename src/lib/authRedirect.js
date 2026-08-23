// Supabase's confirmation/magic-link emails redirect the browser to whatever URL we pass as
// emailRedirectTo. Deriving it from window.location.origin means it's always the domain the user
// is actually signing up from — the deployed Vercel URL in production, localhost in dev — with
// nothing to hardcode or keep in sync as the production domain changes.
export function getAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`
}
