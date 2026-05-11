/*
  # Add group image URL and TMDB ID to media items

  1. groups table:
     - image_url (text, nullable) — cover image for the group

  2. media_items table:
     - tmdb_id (integer, nullable) — TMDB movie/show ID for external data linking
     - tmdb_poster_path (text, nullable) — TMDB poster path (e.g. /abc123.jpg)

  3. Fix group_members SELECT policy to also allow anon to count members
     of public groups (so home page popular group member counts work for
     unauthenticated users and before auth session loads).
*/

-- Add image_url to groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE groups ADD COLUMN image_url text DEFAULT '';
  END IF;
END $$;

-- Add tmdb_id and tmdb_poster_path to media_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_items' AND column_name = 'tmdb_id'
  ) THEN
    ALTER TABLE media_items ADD COLUMN tmdb_id integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_items' AND column_name = 'tmdb_poster_path'
  ) THEN
    ALTER TABLE media_items ADD COLUMN tmdb_poster_path text;
  END IF;
END $$;

-- Allow anon to count group_members for public groups (member count on home page)
CREATE POLICY "anon can count members of public groups"
  ON group_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id AND g.is_public = true
    )
  );

-- Allow group owner to remove members (needed for group edit feature)
CREATE POLICY "owner can remove group members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
    )
    AND user_id != auth.uid()
  );
