/*
  # Fix episode_reviews RLS policies

  1. Changes
    - Simplify the SELECT policy for episode_reviews to avoid complex subquery
      that may cause permission issues
    - Allow any authenticated user to view episode reviews (they are social content)
    - Keep INSERT/UPDATE/DELETE restricted to own reviews

  2. Notes
    - The previous correlated subquery through episodes -> media_items -> group_members
      may fail due to RLS on those tables during policy evaluation
*/

DROP POLICY IF EXISTS "Group members can view episode reviews" ON episode_reviews;

CREATE POLICY "Authenticated users can view episode reviews"
  ON episode_reviews FOR SELECT
  TO authenticated
  USING (true);
