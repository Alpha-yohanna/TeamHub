-- The 'avatars' bucket already had four generic, non-namespaced policies on storage.objects
-- predating TeamHub's avatar feature (which had no upload UI anywhere until this phase):
--   "Authenticated users can upload avatars" — INSERT, WITH CHECK (bucket_id = 'avatars') only,
--     no folder/owner restriction at all.
--   "Users can update their own avatar" / "Users can delete their own avatar" — likewise gated
--     only on bucket_id, with no ownership check despite the name.
--   "Public can view avatars" — harmless (read-only), duplicates "TeamHub avatars are publicly
--     readable" and is left in place.
-- Because storage.objects RLS policies are OR'd together, these fully permissive leftovers made
-- the folder-scoped "TeamHub users can ... their own avatar" policies from migration 030
-- meaningless — any authenticated user could write or delete any other user's avatar file.
-- Verified via a live scripted test (User A successfully uploaded into User B's avatar folder)
-- before this fix. Confirmed unused by any working feature and removed.
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;
