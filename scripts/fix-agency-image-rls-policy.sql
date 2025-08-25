-- Enable RLS on agency_image table if not already enabled
ALTER TABLE agency_image ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow freelancers to view agency images" ON agency_image;
DROP POLICY IF EXISTS "Allow agencies to manage their own images" ON agency_image;
DROP POLICY IF EXISTS "Allow public read access to agency images" ON agency_image;

-- Create policy to allow freelancers to view agency images
CREATE POLICY "Allow freelancers to view agency images" ON agency_image
    FOR SELECT
    USING (true); -- Allow all users to view agency images

-- Create policy to allow agencies to manage their own images
CREATE POLICY "Allow agencies to manage their own images" ON agency_image
    FOR ALL
    USING (auth.uid() = agency_id);

-- Grant necessary permissions
GRANT SELECT ON agency_image TO authenticated;
GRANT SELECT ON agency_image TO anon;
