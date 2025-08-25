-- Add reference_id column to Funded_jobs101 table if it doesn't exist
ALTER TABLE public."Funded_jobs101" 
ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- Update status values to include new verification statuses
-- No need to modify existing data, just ensure the column can handle new values

-- Create index for faster lookups on reference_id
CREATE INDEX IF NOT EXISTS idx_funded_jobs_reference_id ON public."Funded_jobs101"(reference_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_funded_jobs_status ON public."Funded_jobs101"(status);
