-- Create agency_fundings table for tracking agency wallet deposits
CREATE TABLE IF NOT EXISTS public.agency_fundings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
    payment_method VARCHAR(50) DEFAULT 'paystack',
    flutterwave_ref VARCHAR(255) UNIQUE,
    paystack_ref VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agency_fundings_agency_id ON public.agency_fundings(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_fundings_flutterwave_ref ON public.agency_fundings(flutterwave_ref);
CREATE INDEX IF NOT EXISTS idx_agency_fundings_status ON public.agency_fundings(status);
CREATE INDEX IF NOT EXISTS idx_agency_fundings_created_at ON public.agency_fundings(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.agency_fundings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy for agencies to view their own funding records
CREATE POLICY "Agencies can view own fundings" ON public.agency_fundings
    FOR SELECT USING (auth.uid() = agency_id);

-- Policy for agencies to insert their own funding records
CREATE POLICY "Agencies can insert own fundings" ON public.agency_fundings
    FOR INSERT WITH CHECK (auth.uid() = agency_id);

-- Policy for agencies to update their own funding records
CREATE POLICY "Agencies can update own fundings" ON public.agency_fundings
    FOR UPDATE USING (auth.uid() = agency_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agency_fundings_updated_at 
    BEFORE UPDATE ON public.agency_fundings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.agency_fundings TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
