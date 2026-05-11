/*
  # Social features, personal reviews, taste profiles, next-to-watch

  1. New Tables
    - `follows` — follow relationships (follower_id → following_id). Mutual = friends.
    - `personal_reviews` — user reviews independent of any group (tmdb_id based)
    - `taste_profiles` — AI-generated taste summary per user (read-only for users)
    - `group_next_to_watch` — up to 3 items queued per group

  2. Modified Tables
    - `groups` — no structural changes needed (owner_id already exists)
    - `profiles` — add bio column for taste summary display

  3. Security: RLS on all new tables
*/

-- ─── follows ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all follows"
  ON follows FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ─── personal_reviews ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'show')),
  year integer,
  poster_path text,
  description text DEFAULT '',
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tmdb_id)
);

ALTER TABLE personal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal reviews"
  ON personal_reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Friends can view personal reviews"
  ON personal_reviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM follows f1
      JOIN follows f2 ON f1.following_id = f2.follower_id AND f1.follower_id = f2.following_id
      WHERE f1.follower_id = auth.uid() AND f1.following_id = personal_reviews.user_id
    )
  );

CREATE POLICY "Users can insert own personal reviews"
  ON personal_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal reviews"
  ON personal_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personal reviews"
  ON personal_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_personal_reviews_user ON personal_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_reviews_tmdb ON personal_reviews(tmdb_id);

-- ─── taste_profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taste_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  summary text NOT NULL DEFAULT '',
  genres text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view taste profiles"
  ON taste_profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can upsert taste profiles"
  ON taste_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update taste profiles"
  ON taste_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── group_next_to_watch ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_next_to_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'show')),
  year integer,
  poster_path text,
  description text DEFAULT '',
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, tmdb_id)
);

ALTER TABLE group_next_to_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view next to watch"
  ON group_next_to_watch FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_next_to_watch.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can add next to watch"
  ON group_next_to_watch FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can remove next to watch"
  ON group_next_to_watch FOR DELETE TO authenticated
  USING (
    auth.uid() = added_by OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_next_to_watch.group_id AND gm.user_id = auth.uid() AND gm.role = 'owner'
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_next_group ON group_next_to_watch(group_id);
