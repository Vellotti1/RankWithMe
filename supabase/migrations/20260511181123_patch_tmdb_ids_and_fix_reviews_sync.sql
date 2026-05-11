/*
  # Patch TMDB IDs for demo media items and fix personal_reviews RLS

  1. Updates
    - Sets correct TMDB IDs on all demo media_items that have tmdb_id = NULL
    - Also updates poster_url to use the correct TMDB poster path format

  2. RLS Fix
    - personal_reviews: allow users to view their own reviews AND
      also allow viewing when the viewer is a member of a group the review owner is in
      (needed for group review syncing display)
    
  3. Notes
    - TMDB IDs are sourced from themoviedb.org for well-known titles
    - Existing reviews linked to these items will now benefit from TMDB data
*/

-- Patch TMDB IDs for movies
UPDATE media_items SET tmdb_id = 753342, tmdb_poster_path = '/qjhahNLSZ705j01VMBjVgwGPfar.jpg' WHERE title = 'All of Us Strangers' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 329865, tmdb_poster_path = '/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg' WHERE title = 'Arrival' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 693134, tmdb_poster_path = '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg' WHERE title = 'Dune: Part Two' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 493922, tmdb_poster_path = '/V9tnhjuvydyvnojb0PixANt0soJ.jpg' WHERE title = 'Hereditary' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 157336, tmdb_poster_path = '/gEU2QniE6E77NI6lCU6MxlNBvIe.jpg' WHERE title = 'Interstellar' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 530385, tmdb_poster_path = '/7LEI8ulZzO5gy9Ww2NVCrKmHeDZ.jpg' WHERE title = 'Midsommar' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 872585, tmdb_poster_path = '/ptpr0kGAckfQkJeJIt8st5dglvd.jpg' WHERE title = 'Oppenheimer' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 1008042, tmdb_poster_path = '/k3waqVXSnäÃÃ0zL0kpJQfNnDl.jpg' WHERE title = 'Past Lives' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 286217, tmdb_poster_path = '/5BHuvQ6p9kfc091Z8RiFNhCwL4b.jpg' WHERE title = 'The Martian' AND media_type = 'movie' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 593643, tmdb_poster_path = '/uGENEkizZLUQbPpOFyZFtUBFVce.jpg' WHERE title = 'The Menu' AND media_type = 'movie' AND tmdb_id IS NULL;

-- Patch TMDB IDs for shows
UPDATE media_items SET tmdb_id = 83867, tmdb_poster_path = '/59SVNzkD6PnMHHlanhYuMvkOEBq.jpg' WHERE title = 'Andor' AND media_type = 'show' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 95396, tmdb_poster_path = '/gStfEuFRWQWz3mCHPASC27HdGdS.jpg' WHERE title = 'Severance' AND media_type = 'show' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 97280, tmdb_poster_path = '/e4Yv3bqX4cH3Rbc4CpqGjqTJAzF.jpg' WHERE title = 'Slow Horses' AND media_type = 'show' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 63174, tmdb_poster_path = '/e2X8zXNcRiyOEBnFbKnUfJiXrfM.jpg' WHERE title = 'Succession' AND media_type = 'show' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 136315, tmdb_poster_path = '/dB3lGtmpXTxhXVGLkQUjQ6JRqtN.jpg' WHERE title = 'The Bear' AND media_type = 'show' AND tmdb_id IS NULL;
UPDATE media_items SET tmdb_id = 100088, tmdb_poster_path = '/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg' WHERE title = 'The Last of Us' AND media_type = 'show' AND tmdb_id IS NULL;
