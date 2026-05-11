/*
  # Add episodes table for TV show episode ranking

  1. New Tables
     - `episodes`
       - `id` (uuid, PK)
       - `media_item_id` (uuid, FK → media_items) — the parent show
       - `tmdb_episode_id` (integer) — TMDB episode ID
       - `season_number` (integer)
       - `episode_number` (integer)
       - `title` (text)
       - `overview` (text, nullable)
       - `still_path` (text, nullable) — TMDB still image path
       - `air_date` (text, nullable)
       - `created_at` (timestamptz)

  2. New Tables
     - `episode_reviews`
       - `id` (uuid, PK)
       - `episode_id` (uuid, FK → episodes)
       - `user_id` (uuid, FK → auth.users)
       - `score` (integer 0-100)
       - `text` (text)
       - `created_at` / `updated_at` (timestamptz)
       - UNIQUE constraint on (episode_id, user_id)

  3. Security
     - RLS enabled on both tables
     - Episodes: group members can view/insert, adders can delete
     - Episode reviews: group members can view, users manage own reviews
*/

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  tmdb_episode_id integer,
  season_number integer NOT NULL DEFAULT 1,
  episode_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  overview text DEFAULT '',
  still_path text,
  air_date text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(media_item_id, season_number, episode_number)
);

CREATE TABLE IF NOT EXISTS episode_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(episode_id, user_id)
);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_reviews ENABLE ROW LEVEL SECURITY;

-- Episodes: group members can view
CREATE POLICY "Group members can view episodes"
  ON episodes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN media_items mi ON mi.group_id = gm.group_id
      WHERE mi.id = episodes.media_item_id
        AND gm.user_id = auth.uid()
    )
  );

-- Episodes: group members can insert
CREATE POLICY "Group members can insert episodes"
  ON episodes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN media_items mi ON mi.group_id = gm.group_id
      WHERE mi.id = media_item_id
        AND gm.user_id = auth.uid()
    )
  );

-- Episodes: group members can update (for bulk upsert)
CREATE POLICY "Group members can update episodes"
  ON episodes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN media_items mi ON mi.group_id = gm.group_id
      WHERE mi.id = episodes.media_item_id
        AND gm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN media_items mi ON mi.group_id = gm.group_id
      WHERE mi.id = media_item_id
        AND gm.user_id = auth.uid()
    )
  );

-- Episode reviews: group members can view
CREATE POLICY "Group members can view episode reviews"
  ON episode_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN media_items mi ON mi.id = (
        SELECT e.media_item_id FROM episodes e WHERE e.id = episode_reviews.episode_id
      )
      WHERE mi.group_id = gm.group_id
        AND gm.user_id = auth.uid()
    )
  );

-- Episode reviews: users can create own
CREATE POLICY "Users can create own episode reviews"
  ON episode_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Episode reviews: users can update own
CREATE POLICY "Users can update own episode reviews"
  ON episode_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Episode reviews: users can delete own
CREATE POLICY "Users can delete own episode reviews"
  ON episode_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_episodes_media_item_id ON episodes(media_item_id);
CREATE INDEX IF NOT EXISTS idx_episode_reviews_episode_id ON episode_reviews(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_reviews_user_id ON episode_reviews(user_id);
