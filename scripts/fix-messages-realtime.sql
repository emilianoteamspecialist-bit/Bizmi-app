-- Ensure the supabase_realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add the messages table to the publication if it's not already there
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Ensure replica identity is set so that UPDATE/DELETE events contain full row data (optional but good practice)
ALTER TABLE messages REPLICA IDENTITY FULL;
