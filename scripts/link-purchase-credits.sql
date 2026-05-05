-- Add a foreign key constraint to link purchase_credits to the profiles table
ALTER TABLE public.purchase_credits
DROP CONSTRAINT IF EXISTS purchase_credits_freelancer_id_fkey;

ALTER TABLE public.purchase_credits
ADD CONSTRAINT purchase_credits_freelancer_id_fkey
FOREIGN KEY (freelancer_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- This allows PostgREST (Supabase) to automatically join purchase_credits and profiles
