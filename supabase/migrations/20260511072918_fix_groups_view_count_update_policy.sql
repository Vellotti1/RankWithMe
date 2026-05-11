/*
  # Fix groups view_count update policy

  The view_count increment on public groups fails silently because the
  UPDATE policy only allows the group owner to update. Any authenticated
  user clicking a public group card should be able to increment view_count.

  Add a separate policy for view_count increments by authenticated users
  on public groups.
*/

CREATE POLICY "Authenticated users can increment view count on public groups"
  ON groups FOR UPDATE
  TO authenticated
  USING (is_public = true)
  WITH CHECK (is_public = true);
