import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseAnonKey;

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
  image_url: string;
  total_stars: number;
  level: number;
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
  tmdb_id: number | null;
  tmdb_poster_path: string | null;
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
  review_type: "text" | "voice";
  voice_audio_url: string | null;
  voice_summary: string | null;
  voice_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type Episode = {
  id: string;
  media_item_id: string;
  tmdb_episode_id: number | null;
  season_number: number;
  episode_number: number;
  title: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  created_at: string;
};

export type EpisodeReview = {
  id: string;
  episode_id: string;
  user_id: string;
  score: number;
  text: string;
  review_type: "text" | "voice";
  voice_audio_url: string | null;
  voice_summary: string | null;
  voice_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type PersonalReview = {
  id: string;
  user_id: string;
  tmdb_id: number;
  title: string;
  media_type: 'movie' | 'show';
  year: number | null;
  poster_path: string | null;
  description: string;
  score: number;
  text: string;
  review_type: "text" | "voice";
  voice_audio_url: string | null;
  voice_summary: string | null;
  voice_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type TasteProfile = {
  id: string;
  user_id: string;
  summary: string;
  genres: string[];
  updated_at: string;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type MediaAiOverview = {
  id: string;
  tmdb_id: number;
  media_type: string;
  title: string;
  overview: string;
  generated_at: string;
  updated_at: string;
};

export type GroupNextToWatch = {
  id: string;
  group_id: string;
  tmdb_id: number;
  title: string;
  media_type: 'movie' | 'show';
  year: number | null;
  poster_path: string | null;
  description: string;
  added_by: string;
  created_at: string;
};

export function tmdbPosterUrl(path: string | null | undefined, size = 'w342'): string {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function tmdbStillUrl(path: string | null | undefined, size = 'w300'): string {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function callEdgeFunction(name: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Edge function ${name} returned ${res.status}`);
  }
  return data;
}

export type GroupLevelInfo = {
  level: number;
  starsEarned: number;
  starsRequired: number;
  progress: number;
  levelingUnlocked: boolean;
};

export function calcGroupLevel(totalStars: number, memberCount: number): GroupLevelInfo {
  const levelingUnlocked = memberCount >= 5;
  if (!levelingUnlocked) {
    return { level: 0, starsEarned: totalStars, starsRequired: 1, progress: totalStars > 0 ? 1 : 0, levelingUnlocked: false };
  }
  let level = 0;
  let remaining = totalStars;
  while (remaining >= (3 * level) + 1) {
    remaining -= (3 * level) + 1;
    level++;
  }
  const starsRequired = (3 * level) + 1;
  const progress = starsRequired > 0 ? remaining / starsRequired : 0;
  return { level, starsEarned: remaining, starsRequired, progress, levelingUnlocked: true };
}

export async function recalculateGroupStars(groupId: string): Promise<void> {
  await callEdgeFunction("recalculate-group-stars", { group_id: groupId });
}
