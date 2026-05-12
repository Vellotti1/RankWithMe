/*
  # Add Group Stars and Levels

  1. New Tables
    - `group_starred_media`
      - `id` (uuid, primary key)
      - `group_id` (uuid, FK → groups.id) — the group this star belongs to
      - `media_item_id` (uuid, FK → media_items.id) — the media item that earned the star
      - `created_at` (timestamptz) — when the star was earned
      - UNIQUE constraint on (group_id, media_item_id) to prevent double-counting

  2. Modified Tables
    - `groups` — added columns:
      - `total_stars` (integer, default 0) — cached count of starred media items
      - `level` (integer, default 0) — current group level based on total_stars

  3. Security
    - Enable RLS on `group_starred_media`
    - Add SELECT policy for authenticated users (anyone can view stars)
    - Add INSERT/DELETE policies for service role only (recalculation manages stars)

  4. Important Notes
    - A media item earns a "group star" when EVERY current member of the group has reviewed it
    - Stars are recalculated whenever membership or reviews change
    - Level is calculated from total_stars using formula: stars needed = (3 * current_level) + 1
    - Groups with fewer than 5 members can earn stars but NOT levels
    - The recalculateGroupStars edge function handles all star/level updates
*/

-- Create group_starred_media table
CREATE TABLE IF NOT EXISTS group_starred_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, media_item_id)
);

-- Add total_stars and level columns to groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'total_stars'
  ) THEN
    ALTER TABLE groups ADD COLUMN total_stars integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'level'
  ) THEN
    ALTER TABLE groups ADD COLUMN level integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS on group_starred_media
ALTER TABLE group_starred_media ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view stars
CREATE POLICY "Authenticated users can view group stars"
  ON group_starred_media FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert stars (recalculation function)
CREATE POLICY "Service role can insert group stars"
  ON group_starred_media FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = '00000000-0000-0000-0000-000000000000');

-- Only service role can delete stars (recalculation function)
CREATE POLICY "Service role can delete group stars"
  ON group_starred_media FOR DELETE
  TO authenticated
  USING (auth.uid() = '00000000-0000-0000-0000-000000000000');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_group_starred_media_group ON group_starred_media(group_id);
CREATE INDEX IF NOT EXISTS idx_group_starred_media_media ON group_starred_media(media_item_id);
