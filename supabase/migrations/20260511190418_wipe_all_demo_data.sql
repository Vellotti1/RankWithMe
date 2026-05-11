/*
  # Wipe All Demo Media Data

  Removes all seeded/demo data from:
  - episode_reviews
  - episodes
  - reviews
  - media_items (and cascades)
  - personal_reviews
  - group_next_to_watch_watched
  - group_next_to_watch
  - group_chat_messages

  This clears the slate so all future media comes from TMDB API searches.
  User accounts, groups, follows, and taste_profiles are preserved.
*/

-- Remove all episode reviews
DELETE FROM episode_reviews;

-- Remove all episodes
DELETE FROM episodes;

-- Remove all group reviews
DELETE FROM reviews;

-- Remove all group next to watch watched records
DELETE FROM group_next_to_watch_watched;

-- Remove all group next to watch items
DELETE FROM group_next_to_watch;

-- Remove all chat messages
DELETE FROM group_chat_messages;

-- Remove all media items (this also cascades reviews/episodes if any remain)
DELETE FROM media_items;

-- Remove all personal reviews
DELETE FROM personal_reviews;

-- Remove all taste profiles (so users regenerate based on real reviews)
DELETE FROM taste_profiles;
