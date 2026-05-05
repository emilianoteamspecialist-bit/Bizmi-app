-- Fix foreign key relationships between conversations and profiles
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_participant1_id_fkey,
  DROP CONSTRAINT IF EXISTS conversations_participant2_id_fkey;

-- Add the proper foreign key relationships with explicit names
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_participant1_id_fkey 
  FOREIGN KEY (participant1_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT conversations_participant2_id_fkey 
  FOREIGN KEY (participant2_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
