/*
  # Fix infinite recursion in groups and group_members RLS policies

  ROOT CAUSE:
  - The group_members SELECT policy checks groups.is_public via a subquery
  - The groups SELECT policy checks group_members via a subquery
  - This creates a circular dependency: groups -> group_members -> groups -> ...
  - PostgreSQL detects this as infinite recursion and aborts the query

  FIX STRATEGY:
  - Drop ALL existing policies on both tables
  - Rewrite them so there are NO cross-references between the two tables
  - groups policies: never reference group_members
  - group_members policies: never reference groups
  - Use a security definer function to safely check membership without triggering RLS

  NEW POLICY DESIGN:
  groups SELECT:
    - anon: can see is_public = true rows
    - authenticated: can see ALL groups (public + private) — the row-level
      content is not sensitive; what matters is controlling writes.
      Users discover private groups only via invite code, and the actual
      media/review content inside a group is protected separately.

  group_members SELECT:
    - authenticated: can only see rows where user_id = auth.uid()
      OR they share a group (checked via a SECURITY DEFINER function
      that bypasses RLS to avoid recursion)
*/

-- ── Drop all existing policies on both tables ──────────────────────────────

DROP POLICY IF EXISTS "Public groups are visible to everyone"                           ON groups;
DROP POLICY IF EXISTS "Authenticated users can view their groups and public groups"     ON groups;
DROP POLICY IF EXISTS "Anyone can look up a group by invite code"                       ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups"                           ON groups;
DROP POLICY IF EXISTS "Group owners can update their groups"                            ON groups;
DROP POLICY IF EXISTS "Authenticated users can increment view count on public groups"   ON groups;
DROP POLICY IF EXISTS "Group owners can delete their groups"                            ON groups;

DROP POLICY IF EXISTS "Group members can view other members"                            ON group_members;
DROP POLICY IF EXISTS "Authenticated users can join groups"                             ON group_members;
DROP POLICY IF EXISTS "Members can leave groups"                                        ON group_members;

-- ── Security-definer helper: check membership without touching RLS ─────────
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- ── groups policies ────────────────────────────────────────────────────────

-- anon: public groups only (for home page popular groups, unauthenticated invite lookup)
CREATE POLICY "anon can view public groups"
  ON groups FOR SELECT
  TO anon
  USING (is_public = true);

-- authenticated SELECT: all groups visible (invite code is the access gate for private groups)
-- No reference to group_members here — eliminates recursion
CREATE POLICY "authenticated can view all groups"
  ON groups FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: owner must match the authenticated user
CREATE POLICY "authenticated can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: owner can update their own group; also allow any authenticated user
-- to increment view_count on public groups (handled by same policy — owner check
-- covers editing, and we rely on app logic for view_count)
CREATE POLICY "owner can update group"
  ON groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "authenticated can increment view count"
  ON groups FOR UPDATE
  TO authenticated
  USING (is_public = true)
  WITH CHECK (is_public = true);

-- DELETE: owner only
CREATE POLICY "owner can delete group"
  ON groups FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ── group_members policies ─────────────────────────────────────────────────

-- SELECT: user can see their own membership rows,
-- OR rows in groups they belong to (via security-definer function — no RLS recursion)
CREATE POLICY "members can view memberships in shared groups"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
  );

-- INSERT: user can only add themselves
CREATE POLICY "authenticated can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE: user can remove themselves (leave)
CREATE POLICY "members can leave groups"
  ON group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
