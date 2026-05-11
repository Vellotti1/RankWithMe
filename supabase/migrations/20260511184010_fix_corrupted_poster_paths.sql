/*
  # Fix corrupted TMDB poster paths

  1. Changes
    - Fixes Past Lives corrupted poster path (non-ASCII characters from encoding issue)
    - Fixes other potentially incorrect poster paths for demo items

  2. Notes
    - Paths verified against TMDB API
*/

UPDATE media_items SET tmdb_poster_path = '/vmY3OrBeyCJ3OoXriXVNzNrZJD5.jpg' WHERE title = 'Past Lives' AND tmdb_id = 1008042;
UPDATE media_items SET tmdb_poster_path = '/e4Eo2W0aXXlNFMa6dCFigz4pOPH.jpg' WHERE title = 'Slow Horses' AND tmdb_id = 97280;
UPDATE media_items SET tmdb_poster_path = '/2A9sp4lW0fQtnRsHVOdVoFwMBf9.jpg' WHERE title = 'Succession' AND tmdb_id = 63174;
UPDATE media_items SET tmdb_poster_path = '/1RpVMpSEbqaLF2kjhkxhBpMKqXW.jpg' WHERE title = 'The Bear' AND tmdb_id = 136315;
UPDATE media_items SET tmdb_poster_path = '/iFpHbvGtBuqfDgsSV7WJOcjeCaA.jpg' WHERE title = 'The Last of Us' AND tmdb_id = 100088;
