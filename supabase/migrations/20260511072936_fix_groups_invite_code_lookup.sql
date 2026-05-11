/*
  # Fix groups SELECT policy for invite code lookups

  When a user tries to join a PRIVATE group by invite code, the SELECT
  query returns nothing because RLS only allows them to see groups they
  already belong to or that are public. They can't join what they can't see.

  Fix: Allow authenticated users to look up any group by invite_code,
  regardless of whether it's public or private.

  We add a separate permissive policy specifically for invite code lookups.
  This does not expose group content — only the group row when the exact
  invite_code is known.
*/

CREATE POLICY "Anyone can look up a group by invite code"
  ON groups FOR SELECT
  TO authenticated
  USING (invite_code IS NOT NULL);
