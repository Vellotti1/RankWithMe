/*
  # Fix group_members count visibility for non-members

  1. Changes
    - Add SELECT policy for authenticated users to count members of any public group
    - This allows non-members to see member counts on group cards and detail pages

  2. Security Notes
    - Only allows counting/viewing members of public groups or groups the user belongs to
    - Private group members are only visible to group members themselves
*/

DROP POLICY IF EXISTS "anon can count members of public groups" ON group_members;
DROP POLICY IF EXISTS "members can view memberships in shared groups" ON group_members;

-- Allow any authenticated user to view members of public groups
CREATE POLICY "Authenticated can view public group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.is_public = true)
    OR user_id = auth.uid()
    OR is_group_member(group_id, auth.uid())
  );

-- Keep anon access for public groups
CREATE POLICY "Anon can count members of public groups"
  ON group_members FOR SELECT
  TO anon
  USING (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.is_public = true)
  );
