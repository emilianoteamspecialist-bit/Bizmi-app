-- Enable Row Level Security on the messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 1. Allow users to SELECT (read) messages where they are the sender or the receiver
-- This is crucial for Realtime: Supabase will only broadcast the row to users who satisfy this SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view their own messages'
  ) THEN
    CREATE POLICY "Users can view their own messages"
    ON messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;
END
$$;

-- 2. Allow users to INSERT messages only if they are the sender
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can insert messages as themselves'
  ) THEN
    CREATE POLICY "Users can insert messages as themselves"
    ON messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);
  END IF;
END
$$;

-- 3. Allow users to UPDATE messages (e.g., to mark as read) if they are the receiver
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Receivers can update messages to mark as read'
  ) THEN
    CREATE POLICY "Receivers can update messages to mark as read"
    ON messages FOR UPDATE
    USING (auth.uid() = receiver_id);
  END IF;
END
$$;
