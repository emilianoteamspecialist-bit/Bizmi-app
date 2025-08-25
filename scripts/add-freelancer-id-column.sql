-- Add freelancer_id column to Funded_jobs101 table
ALTER TABLE "Funded_jobs101" 
ADD COLUMN "freelancer_id" UUID;

-- Add a comment to describe the column
COMMENT ON COLUMN "Funded_jobs101"."freelancer_id" IS 'ID of the freelancer who will receive the funded job';

-- Optionally, you can add a foreign key constraint if you have a freelancers table
-- ALTER TABLE "Funded_jobs101" 
-- ADD CONSTRAINT fk_funded_jobs_freelancer 
-- FOREIGN KEY ("freelancer_id") REFERENCES "profiles"("id");
