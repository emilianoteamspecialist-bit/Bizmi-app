-- Create Freelancer_identitie table
CREATE TABLE IF NOT EXISTS Freelancer_identitie (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE, -- One identity per user
    nin_number VARCHAR(11) NOT NULL UNIQUE, -- 11 digits, unique across all users
    front_id_url TEXT NOT NULL, -- URL to front of national ID
    back_id_url TEXT NOT NULL, -- URL to back of national ID
    verification_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint to ensure NIN is exactly 11 digits
    CONSTRAINT nin_length_check CHECK (LENGTH(nin_number) = 11 AND nin_number ~ '^[0-9]{11}$')
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_freelancer_identitie_user_id ON Freelancer_identitie(user_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_identitie_nin ON Freelancer_identitie(nin_number);

-- Add RLS (Row Level Security)
ALTER TABLE Freelancer_identitie ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own identity
CREATE POLICY "Users can manage their own identity" ON Freelancer_identitie
    FOR ALL USING (auth.uid() = user_id);
