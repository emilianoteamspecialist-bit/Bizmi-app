-- Create Freelancer_account_details table
CREATE TABLE IF NOT EXISTS public.Freelancer_account_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint (optional)
-- ALTER TABLE public.Freelancer_account_details 
-- ADD CONSTRAINT fk_freelancer_account_details_freelancer_id 
-- FOREIGN KEY (freelancer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add RLS policies
ALTER TABLE public.Freelancer_account_details ENABLE ROW LEVEL SECURITY;

-- Policy for freelancers to view their own account details
CREATE POLICY "Freelancers can view own account details" ON public.Freelancer_account_details
    FOR SELECT USING (auth.uid() = freelancer_id);

-- Policy for freelancers to insert their own account details
CREATE POLICY "Freelancers can insert own account details" ON public.Freelancer_account_details
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

-- Policy for freelancers to update their own account details
CREATE POLICY "Freelancers can update own account details" ON public.Freelancer_account_details
    FOR UPDATE USING (auth.uid() = freelancer_id);

-- Policy for freelancers to delete their own account details
CREATE POLICY "Freelancers can delete own account details" ON public.Freelancer_account_details
    FOR DELETE USING (auth.uid() = freelancer_id);

-- Add comment to table
COMMENT ON TABLE public.Freelancer_account_details IS 'Stores freelancer bank account details for payments';
