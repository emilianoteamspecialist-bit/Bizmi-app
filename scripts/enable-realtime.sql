-- Add messages table to Supabase realtime publication
-- This enables live updating of the chat UI

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages;
COMMIT;
