-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Agencies can view proposals for their jobs" ON proposals;
DROP POLICY IF EXISTS "Freelancers can view their own proposals" ON proposals;
DROP POLICY IF EXISTS "Agencies can update proposals for their jobs" ON proposals;
DROP POLICY IF EXISTS "Freelancers can insert proposals" ON proposals;
DROP POLICY IF EXISTS "Allow read access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow read access to freelancer logos" ON freelancer_logos;

-- Enable RLS on proposals table
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Policy for agencies to view proposals for their jobs
CREATE POLICY "Agencies can view proposals for their jobs" ON proposals
FOR SELECT USING (
  job_id IN (
    SELECT id FROM jobs WHERE agency_id = auth.uid()
  )
);

-- Policy for freelancers to view their own proposals
CREATE POLICY "Freelancers can view their own proposals" ON proposals
FOR SELECT USING (freelancer_id = auth.uid());

-- Policy for agencies to update proposals for their jobs (accept/reject)
CREATE POLICY "Agencies can update proposals for their jobs" ON proposals
FOR UPDATE USING (
  job_id IN (
    SELECT id FROM jobs WHERE agency_id = auth.uid()
  )
);

-- Policy for freelancers to insert proposals
CREATE POLICY "Freelancers can insert proposals" ON proposals
FOR INSERT WITH CHECK (freelancer_id = auth.uid());

-- Ensure profiles table allows read access for displaying freelancer info
CREATE POLICY "Allow read access to profiles" ON profiles
FOR SELECT USING (true);

-- Ensure freelancer_logos table allows read access for displaying freelancer images
CREATE POLICY "Allow read access to freelancer logos" ON freelancer_logos
FOR SELECT USING (true);

-- Grant necessary permissions
GRANT SELECT ON proposals TO authenticated;
GRANT UPDATE ON proposals TO authenticated;
GRANT INSERT ON proposals TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON freelancer_logos TO authenticated;
