/*
  # RankWithMe Database Schema

  ## Overview
  Creates the full backend schema for RankWithMe - profiles, groups, group_members, media_items, reviews.

  ## Tables
  - profiles: User profiles linked to auth.users
  - groups: Ranking groups with public/private flag and view counter
  - group_members: Junction table for group membership
  - media_items: Movies/shows added to groups
  - reviews: User ratings and text reviews

  ## Security
  RLS enabled on all tables with appropriate policies.
  Group visibility policies added after group_members table exists.
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Groups (no member-based policy yet - added after group_members)
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  invite_code text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Group owners can update their groups"
  ON groups FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Group owners can delete their groups"
  ON groups FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view other members"
  ON group_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id AND g.is_public = true
    )
  );

CREATE POLICY "Authenticated users can join groups"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can leave groups"
  ON group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Now add the SELECT policy for groups (references group_members)
CREATE POLICY "Groups viewable by members and public"
  ON groups FOR SELECT TO authenticated
  USING (
    is_public = true OR
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
  );

-- Media items
CREATE TABLE IF NOT EXISTS media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  year integer,
  media_type text NOT NULL DEFAULT 'movie',
  poster_url text DEFAULT '',
  description text DEFAULT '',
  added_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view media items"
  ON media_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = media_items.group_id AND gm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = media_items.group_id AND g.is_public = true
    )
  );

CREATE POLICY "Group members can add media items"
  ON media_items FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = media_items.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Item adders can update media items"
  ON media_items FOR UPDATE TO authenticated
  USING (auth.uid() = added_by)
  WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Item adders can delete media items"
  ON media_items FOR DELETE TO authenticated
  USING (auth.uid() = added_by);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(media_item_id, user_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view reviews"
  ON reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM media_items mi
      JOIN group_members gm ON gm.group_id = mi.group_id
      WHERE mi.id = reviews.media_item_id AND gm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM media_items mi
      JOIN groups g ON g.id = mi.group_id
      WHERE mi.id = reviews.media_item_id AND g.is_public = true
    )
  );

CREATE POLICY "Users can create own reviews"
  ON reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Invite code generator
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_groups_public_views ON groups(is_public, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_media_items_group ON media_items(group_id);
CREATE INDEX IF NOT EXISTS idx_reviews_media_item ON reviews(media_item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
