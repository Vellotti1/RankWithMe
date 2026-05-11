/*
  # Wipe broken demo users and all dependent seed data

  The demo users were inserted directly via raw SQL with custom UUIDs,
  bypassing GoTrue entirely. GoTrue cannot authenticate them regardless
  of how the password hash is set. The only fix is to delete them and
  recreate them through the Admin API.

  This migration:
  1. Drops all seed data tied to the old fake demo UUIDs
  2. Drops the old broken auth.users rows
  3. Drops all seed groups and media items (will be re-seeded after users are recreated)

  After this migration runs, the seed-demo-users edge function will:
  - Create all 5 demo users via auth.admin.createUser (proper GoTrue flow)
  - Re-insert all groups, media items, reviews, and group memberships
*/

-- Delete in FK-safe order
DELETE FROM reviews;
DELETE FROM media_items;
DELETE FROM group_members;
DELETE FROM groups;
DELETE FROM profiles;

-- Delete all auth users (wipes demo users and any test accounts)
DELETE FROM auth.users;
