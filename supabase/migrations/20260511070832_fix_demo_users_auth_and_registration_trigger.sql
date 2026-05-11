/*
  # Fix demo user auth fields and registration trigger

  1. Problem 1 - Demo users can't log in
     - The demo users were inserted with `aud = NULL`
     - Supabase GoTrue requires `aud = 'authenticated'` to authenticate users
     - Fix: Set aud = 'authenticated' on all demo users

  2. Problem 2 - New account registration fails with "Database error saving new user"
     - The `handle_new_user` trigger does a plain INSERT into profiles
     - If a profile row already exists (e.g. re-registration attempt or seed data conflict),
       it throws a duplicate key error which GoTrue surfaces as "Database error saving new user"
     - Fix: Change the INSERT to ON CONFLICT DO NOTHING so it's idempotent

  3. Also ensure all required auth fields are properly set on demo users
*/

-- Fix 1: Set aud = 'authenticated' on all demo users (required by GoTrue for password auth)
UPDATE auth.users
SET aud = 'authenticated'
WHERE email IN (
  'alex@demo.kritiq.app',
  'jamie@demo.kritiq.app',
  'sam@demo.kritiq.app',
  'morgan@demo.kritiq.app',
  'taylor@demo.kritiq.app'
);

-- Fix 2: Update handle_new_user to be idempotent (ON CONFLICT DO NOTHING prevents
-- "Database error saving new user" when a profile row already exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
