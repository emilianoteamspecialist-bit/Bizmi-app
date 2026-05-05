-- Fix the foreign key relationship between proposals and profiles/jobs
-- This resolves the "Could not find a relationship between 'proposals' and 'profiles' in the schema cache" error

-- First, ensure we don't have broken or duplicate constraints
ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_freelancer_id_fkey,
  DROP CONSTRAINT IF EXISTS proposals_job_id_fkey;

-- Add the proper foreign key relationships with explicit names
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_freelancer_id_fkey 
  FOREIGN KEY (freelancer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT proposals_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Tell Supabase's API to reload its schema cache to see the new relationships
NOTIFY pgrst, 'reload schema';
