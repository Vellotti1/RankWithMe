/*
  # Fix groups RLS to allow public group visibility

  Problems:
  1. Popular groups don't show on the home page — the SELECT policy only
     runs for authenticated users, so public groups are invisible to
     unauthenticated requests (and during session loading).

  2. Invite code lookup in join.tsx fails — querying groups by invite_code
     also hits RLS and returns nothing for unauthenticated users.

  Fix: Replace the single SELECT policy with two policies:
  - anon role: can read groups where is_public = true (needed for invite lookups too)
  - authenticated role: can read public groups OR groups they own/are members of
*/

DROP POLICY IF EXISTS "Groups viewable by members and public" ON groups;

CREATE POLICY "Public groups are visible to everyone"
  ON groups FOR SELECT
  TO anon
  USING (is_public = true);

CREATE POLICY "Authenticated users can view their groups and public groups"
  ON groups FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
  );
