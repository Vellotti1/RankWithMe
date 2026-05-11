import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  owner_id: string;
  is_public: boolean;
  view_count: number;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type MediaItem = {
  id: string;
  group_id: string;
  title: string;
  year: number | null;
  media_type: 'movie' | 'show';
  poster_url: string;
  description: string;
  added_by: string;
  created_at: string;
};

export type Review = {
  id: string;
  media_item_id: string;
  user_id: string;
  score: number;
  text: string;
  created_at: string;
  updated_at: string;
};
