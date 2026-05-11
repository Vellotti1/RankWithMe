/*
  # Add watched tracking for Next to Watch items

  1. New Table
    - `group_next_to_watch_watched` — tracks which members have marked a "next to watch" item as watched
      and optionally left a review text + score
      
  2. Columns
    - id, item_id (FK to group_next_to_watch), user_id, score (nullable), text (nullable), watched_at

  3. Security
    - RLS enabled, group members can insert/view/delete their own watched records
*/

CREATE TABLE IF NOT EXISTS group_next_to_watch_watched (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES group_next_to_watch(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer CHECK (score >= 0 AND score <= 100),
  text text DEFAULT '',
  watched_at timestamptz DEFAULT now(),
  UNIQUE(item_id, user_id)
);

ALTER TABLE group_next_to_watch_watched ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view watched records"
  ON group_next_to_watch_watched FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can mark watched"
  ON group_next_to_watch_watched FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watched"
  ON group_next_to_watch_watched FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark watched"
  ON group_next_to_watch_watched FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gntww_item_id ON group_next_to_watch_watched(item_id);
CREATE INDEX IF NOT EXISTS idx_gntww_user_id ON group_next_to_watch_watched(user_id);
