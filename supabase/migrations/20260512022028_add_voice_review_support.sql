/*
  # Add voice review support to reviews and personal_reviews tables

  1. Modified Tables
    - `reviews` — added columns:
      - `review_type` (text, default 'text', check constraint: 'text' or 'voice')
      - `voice_audio_url` (text, nullable) — URL to audio file in Supabase Storage
      - `voice_summary` (text, nullable) — AI-generated summary of voice recording
      - `voice_duration_seconds` (integer, nullable) — duration of the recording

    - `personal_reviews` — added columns:
      - `review_type` (text, default 'text', check constraint: 'text' or 'voice')
      - `voice_audio_url` (text, nullable)
      - `voice_summary` (text, nullable)
      - `voice_duration_seconds` (integer, nullable)

    - `episode_reviews` — added columns:
      - `review_type` (text, default 'text', check constraint: 'text' or 'voice')
      - `voice_audio_url` (text, nullable)
      - `voice_summary` (text, nullable)
      - `voice_duration_seconds` (integer, nullable)

  2. Security
    - No RLS changes needed (existing policies cover new columns)
    - Check constraints enforce review_type is either 'text' or 'voice'

  3. Important Notes
    - Existing reviews default to review_type = 'text', so no data migration needed
    - The `text` column remains used for text reviews
    - For voice reviews, `text` should be empty/null and `voice_audio_url` should be populated
    - A review cannot have both text and voice content (enforced at application level)
    - Audio files are stored in the 'review-voice-recordings' Supabase Storage bucket
*/

-- Add voice review columns to reviews table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'review_type') THEN
    ALTER TABLE reviews ADD COLUMN review_type text NOT NULL DEFAULT 'text';
    ALTER TABLE reviews ADD CONSTRAINT reviews_review_type_check CHECK (review_type IN ('text', 'voice'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'voice_audio_url') THEN
    ALTER TABLE reviews ADD COLUMN voice_audio_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'voice_summary') THEN
    ALTER TABLE reviews ADD COLUMN voice_summary text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'voice_duration_seconds') THEN
    ALTER TABLE reviews ADD COLUMN voice_duration_seconds integer;
  END IF;
END $$;

-- Add voice review columns to personal_reviews table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personal_reviews' AND column_name = 'review_type') THEN
    ALTER TABLE personal_reviews ADD COLUMN review_type text NOT NULL DEFAULT 'text';
    ALTER TABLE personal_reviews ADD CONSTRAINT personal_reviews_review_type_check CHECK (review_type IN ('text', 'voice'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personal_reviews' AND column_name = 'voice_audio_url') THEN
    ALTER TABLE personal_reviews ADD COLUMN voice_audio_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personal_reviews' AND column_name = 'voice_summary') THEN
    ALTER TABLE personal_reviews ADD COLUMN voice_summary text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personal_reviews' AND column_name = 'voice_duration_seconds') THEN
    ALTER TABLE personal_reviews ADD COLUMN voice_duration_seconds integer;
  END IF;
END $$;

-- Add voice review columns to episode_reviews table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_reviews' AND column_name = 'review_type') THEN
    ALTER TABLE episode_reviews ADD COLUMN review_type text NOT NULL DEFAULT 'text';
    ALTER TABLE episode_reviews ADD CONSTRAINT episode_reviews_review_type_check CHECK (review_type IN ('text', 'voice'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_reviews' AND column_name = 'voice_audio_url') THEN
    ALTER TABLE episode_reviews ADD COLUMN voice_audio_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_reviews' AND column_name = 'voice_summary') THEN
    ALTER TABLE episode_reviews ADD COLUMN voice_summary text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_reviews' AND column_name = 'voice_duration_seconds') THEN
    ALTER TABLE episode_reviews ADD COLUMN voice_duration_seconds integer;
  END IF;
END $$;
