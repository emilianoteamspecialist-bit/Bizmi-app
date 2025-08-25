-- Create Paystack_data table for storing verified payments
CREATE TABLE IF NOT EXISTS public."Paystack_data" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_paystack_data_reference ON public."Paystack_data"(reference);
CREATE INDEX IF NOT EXISTS idx_paystack_data_verified ON public."Paystack_data"(verified);
CREATE INDEX IF NOT EXISTS idx_paystack_data_created_at ON public."Paystack_data"(created_at);

-- Enable RLS
ALTER TABLE public."Paystack_data" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all Paystack data" ON public."Paystack_data"
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert Paystack data" ON public."Paystack_data"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_paystack_data_updated_at 
    BEFORE UPDATE ON public."Paystack_data" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
