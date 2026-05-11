/*
  # Fix personal_reviews RLS to allow public viewing

  1. Changes
    - personal_reviews: make reviews publicly viewable by any authenticated user
      (users explicitly choose to share reviews by saving them - they are social by design)
    - This allows profile pages to show other users' reviews without requiring friendship

  2. Security Notes
    - Reviews are intentionally public social content in this app
    - Users control what review text they write
    - Deleting/editing is still restricted to own reviews
*/

DROP POLICY IF EXISTS "Friends can view personal reviews" ON personal_reviews;
DROP POLICY IF EXISTS "Users can view own personal reviews" ON personal_reviews;

CREATE POLICY "Authenticated users can view all personal reviews"
  ON personal_reviews FOR SELECT
  TO authenticated
  USING (true);
