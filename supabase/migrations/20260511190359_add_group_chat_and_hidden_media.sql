/*
  # Add Group Chat and Hidden Media Items

  1. New Tables
    - `group_chat_messages`
      - `id` (uuid, primary key)
      - `group_id` (uuid, FK to groups)
      - `user_id` (uuid, FK to auth.users) — null for system/review stamps
      - `message` (text) — chat message content
      - `message_type` (text) — 'chat' | 'review_stamp'
      - `metadata` (jsonb) — for review stamps: { title, score, media_type, reviewer_name, media_item_id }
      - `created_at` (timestamptz)

  2. Modified Tables
    - `media_items` — add `is_hidden` boolean column (owner can hide items from rankings view)

  3. Security
    - RLS on group_chat_messages:
      - SELECT: group members can read messages in their groups
      - INSERT: group members can post messages
      - DELETE: users can delete their own messages
    - UPDATE on media_items: owners can set is_hidden
*/

-- Add is_hidden to media_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_items' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE media_items ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create group_chat_messages table
CREATE TABLE IF NOT EXISTS group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'chat' CHECK (message_type IN ('chat', 'review_stamp')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_id ON group_chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_created_at ON group_chat_messages(created_at);

ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: group members can read messages
CREATE POLICY "Group members can read chat messages"
  ON group_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_chat_messages.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- INSERT: group members can post messages
CREATE POLICY "Group members can post chat messages"
  ON group_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_chat_messages.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- DELETE: users can delete their own messages
CREATE POLICY "Users can delete own chat messages"
  ON group_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
