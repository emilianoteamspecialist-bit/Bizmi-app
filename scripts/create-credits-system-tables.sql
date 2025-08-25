-- Create purchase_credits table
CREATE TABLE IF NOT EXISTS public.purchase_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    credits_amount INTEGER NOT NULL,
    paystack_reference VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add credits column to profiles table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='credits') THEN
        ALTER TABLE public.profiles ADD COLUMN credits INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add RLS policies for purchase_credits
ALTER TABLE public.purchase_credits ENABLE ROW LEVEL SECURITY;

-- Policy for freelancers to view their own credit purchases
DROP POLICY IF EXISTS "Freelancers can view own credit purchases" ON public.purchase_credits;
CREATE POLICY "Freelancers can view own credit purchases" ON public.purchase_credits
    FOR SELECT USING (auth.uid() = freelancer_id);

-- Policy for freelancers to insert their own credit purchases
DROP POLICY IF EXISTS "Freelancers can insert own credit purchases" ON public.purchase_credits;
CREATE POLICY "Freelancers can insert own credit purchases" ON public.purchase_credits
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

-- Policy for system to update credit purchases (for payment verification)
DROP POLICY IF EXISTS "System can update credit purchases" ON public.purchase_credits;
CREATE POLICY "System can update credit purchases" ON public.purchase_credits
    FOR UPDATE USING (true);

-- Create function to increment user credits
CREATE OR REPLACE FUNCTION increment_user_credits(user_id UUID, credit_amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET credits = COALESCE(credits, 0) + credit_amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to tables
COMMENT ON TABLE public.purchase_credits IS 'Stores freelancer credit purchases and payment records';
COMMENT ON COLUMN public.profiles.credits IS 'Available credits balance for the user';

-- Verification message
SELECT 'Credits system tables created successfully!' as message;
