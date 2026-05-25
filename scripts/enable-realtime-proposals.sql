-- Adds the `proposals` table to the realtime publication so the agency
-- dashboard receives live INSERTs and can update the per-job proposal count
-- without forcing the user to refresh.
--
-- Idempotent: skips if the table is already published. RLS on `proposals`
-- already restricts each subscriber to rows they can read, so an agency
-- channel only sees proposals on its own jobs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
  END IF;
END $$;
