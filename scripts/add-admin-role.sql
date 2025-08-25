-- Add admin role to existing profiles table
-- First, update the role column to allow 'admin' value
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('agency', 'freelancer', 'admin'));

-- Create your first admin user (replace with your actual email)
-- You'll need to run this manually in your database
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
