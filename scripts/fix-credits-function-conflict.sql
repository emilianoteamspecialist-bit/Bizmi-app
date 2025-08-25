-- Fix credits function conflict by dropping all existing functions and creating one clean version

-- Drop all existing increment_user_credits functions
DROP FUNCTION IF EXISTS public.increment_user_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.increment_user_credits(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.increment_user_credits(uid UUID, amt INTEGER);
DROP FUNCTION IF EXISTS public.increment_user_credits(uid UUID, amt NUMERIC);

-- Create the credits system tables if they don't exist
CREATE TABLE IF NOT EXISTS public.purchase_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    credits_amount INTEGER NOT NULL,
    paystack_reference VARCHAR(255) UNIQUE,
    paystack_access_code VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add credits column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'credits') THEN
        ALTER TABLE public.profiles ADD COLUMN credits INTEGER DEFAULT 0;
    END IF;
END $$;

-- Enable RLS on purchase_credits table
ALTER TABLE public.purchase_credits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can insert own credit purchases" ON public.purchase_credits;
DROP POLICY IF EXISTS "Users can update own credit purchases" ON public.purchase_credits;

-- Create RLS policies for purchase_credits
CREATE POLICY "Users can view own credit purchases" ON public.purchase_credits
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Users can insert own credit purchases" ON public.purchase_credits
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Users can update own credit purchases" ON public.purchase_credits
    FOR UPDATE USING (auth.uid() = freelancer_id);

-- Create ONE clean increment_user_credits function
CREATE OR REPLACE FUNCTION public.increment_user_credits(
    uid UUID,
    amt INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        credits = COALESCE(credits, 0) + amt,
        updated_at = NOW()
    WHERE id = uid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', uid;
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_user_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_credits(UUID, INTEGER) TO service_role;

-- Add comments
COMMENT ON TABLE public.purchase_credits IS 'Stores freelancer credit purchases';
COMMENT ON FUNCTION public.increment_user_credits(UUID, INTEGER) IS 'Increments user credits by specified amount';

-- Verification message
SELECT 'Credits system setup completed successfully!' as status;
