-- Drop existing table and policies if they exist
DROP TABLE IF EXISTS public.Freelancer_account_details CASCADE;

-- Create Freelancer_account_details table
CREATE TABLE public.Freelancer_account_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.Freelancer_account_details ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Freelancers can view own account details" 
ON public.Freelancer_account_details
FOR SELECT 
USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can insert own account details" 
ON public.Freelancer_account_details
FOR INSERT 
WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can update own account details" 
ON public.Freelancer_account_details
FOR UPDATE 
USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can delete own account details" 
ON public.Freelancer_account_details
FOR DELETE 
USING (auth.uid() = freelancer_id);

-- Add comment
COMMENT ON TABLE public.Freelancer_account_details IS 'Stores freelancer bank account details for payments';

-- Verify table creation
SELECT 'Table Freelancer_account_details created successfully!' as status;
