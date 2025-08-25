-- Create freelancer_skills table
CREATE TABLE IF NOT EXISTS freelancer_skills (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, skill_name) -- Prevent duplicate skills for same user
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_freelancer_skills_user_id ON freelancer_skills(user_id);

-- Add RLS (Row Level Security)
ALTER TABLE freelancer_skills ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own skills
CREATE POLICY "Users can manage their own skills" ON freelancer_skills
    FOR ALL USING (auth.uid() = user_id);
