-- ============================================================
-- BIZMI APP - COMPLETE DATABASE MIGRATION
-- Single file. Drops everything first. Safe to re-run.
-- ============================================================


-- ============================================================
-- STEP 0: DROP EVERYTHING
-- ============================================================

-- Triggers
DROP TRIGGER IF EXISTS welcome_credits_trigger ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_agency_fundings_updated_at ON public.agency_fundings;
DROP TRIGGER IF EXISTS update_paystack_data_updated_at ON public."Paystack_data";

-- Functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.give_welcome_credits() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.increment_user_credits(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.increment_user_credits(UUID, NUMERIC) CASCADE;

-- Tables (reverse dependency order)
DROP TABLE IF EXISTS public.freelancer_proposal_status CASCADE;
DROP TABLE IF EXISTS public.job_funding_status CASCADE;
DROP TABLE IF EXISTS public."Funded_jobs101" CASCADE;
DROP TABLE IF EXISTS public.escrow_deposits CASCADE;
DROP TABLE IF EXISTS public.saved_jobs CASCADE;
DROP TABLE IF EXISTS public.proposals CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.freelancer_logos CASCADE;
DROP TABLE IF EXISTS public.agency_image CASCADE;
DROP TABLE IF EXISTS public.agency_logo CASCADE;
DROP TABLE IF EXISTS public."Paystack_data" CASCADE;
DROP TABLE IF EXISTS public.freelancer_skills CASCADE;
DROP TABLE IF EXISTS public."Freelancer_identitie" CASCADE;
DROP TABLE IF EXISTS public."Freelancer_account_details" CASCADE;
DROP TABLE IF EXISTS public.freelancer_bank_details CASCADE;
DROP TABLE IF EXISTS public.freelancer_verification CASCADE;
DROP TABLE IF EXISTS public.payment_recipients CASCADE;
DROP TABLE IF EXISTS public.wallet_fundings CASCADE;
DROP TABLE IF EXISTS public.purchase_credits CASCADE;
DROP TABLE IF EXISTS public.agency_fundings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Indexes
DROP INDEX IF EXISTS idx_freelancer_identitie_user_id;
DROP INDEX IF EXISTS idx_freelancer_identitie_nin;
DROP INDEX IF EXISTS idx_freelancer_skills_user_id;
DROP INDEX IF EXISTS idx_agency_fundings_agency_id;
DROP INDEX IF EXISTS idx_agency_fundings_flutterwave_ref;
DROP INDEX IF EXISTS idx_agency_fundings_status;
DROP INDEX IF EXISTS idx_agency_fundings_created_at;
DROP INDEX IF EXISTS idx_paystack_data_reference;
DROP INDEX IF EXISTS idx_paystack_data_verified;
DROP INDEX IF EXISTS idx_paystack_data_created_at;
DROP INDEX IF EXISTS idx_funded_jobs_reference_id;
DROP INDEX IF EXISTS idx_funded_jobs_status;


-- ============================================================
-- 1. SHARED TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 2. PROFILES TABLE
-- ============================================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    account_type TEXT,
    role TEXT DEFAULT 'freelancer',
    username TEXT,
    company_name TEXT,
    company_size TEXT,
    bio TEXT,
    location TEXT,
    phone TEXT,
    website TEXT,
    wallet_balance DECIMAL(10,2) DEFAULT 0,
    credits INTEGER DEFAULT 0,
    credits_balance INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
    FOR DELETE USING (auth.uid() = id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, account_type, role, username, company_name, company_size)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'account_type', 'freelancer'),
        COALESCE(NEW.raw_user_meta_data->>'account_type', 'freelancer'),
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'company_size'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 3. AGENCY FUNDINGS TABLE
-- ============================================================

CREATE TABLE public.agency_fundings (
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

CREATE INDEX idx_agency_fundings_agency_id ON public.agency_fundings(agency_id);
CREATE INDEX idx_agency_fundings_flutterwave_ref ON public.agency_fundings(flutterwave_ref);
CREATE INDEX idx_agency_fundings_status ON public.agency_fundings(status);
CREATE INDEX idx_agency_fundings_created_at ON public.agency_fundings(created_at);

ALTER TABLE public.agency_fundings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view own fundings" ON public.agency_fundings
    FOR SELECT USING (auth.uid() = agency_id);

CREATE POLICY "Agencies can insert own fundings" ON public.agency_fundings
    FOR INSERT WITH CHECK (auth.uid() = agency_id);

CREATE POLICY "Agencies can update own fundings" ON public.agency_fundings
    FOR UPDATE USING (auth.uid() = agency_id);

CREATE TRIGGER update_agency_fundings_updated_at
    BEFORE UPDATE ON public.agency_fundings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON public.agency_fundings TO authenticated;


-- ============================================================
-- 4. PURCHASE CREDITS TABLE & FUNCTION
-- ============================================================

CREATE TABLE public.purchase_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    credits_amount INTEGER NOT NULL,
    paystack_reference VARCHAR(255) UNIQUE,
    paystack_access_code VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit purchases" ON public.purchase_credits
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Users can insert own credit purchases" ON public.purchase_credits
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Users can update own credit purchases" ON public.purchase_credits
    FOR UPDATE USING (auth.uid() = freelancer_id);

GRANT SELECT, INSERT, UPDATE ON public.purchase_credits TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_user_credits(uid UUID, amt INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET credits = COALESCE(credits, 0) + amt, updated_at = NOW()
    WHERE id = uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', uid;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_user_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_credits(UUID, INTEGER) TO service_role;


-- ============================================================
-- 5. FREELANCER ACCOUNT DETAILS TABLE
-- ============================================================

CREATE TABLE public."Freelancer_account_details" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public."Freelancer_account_details" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view own account details" ON public."Freelancer_account_details"
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can insert own account details" ON public."Freelancer_account_details"
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can update own account details" ON public."Freelancer_account_details"
    FOR UPDATE USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can delete own account details" ON public."Freelancer_account_details"
    FOR DELETE USING (auth.uid() = freelancer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Freelancer_account_details" TO authenticated;


-- ============================================================
-- 6. FREELANCER IDENTITIES TABLE
-- ============================================================

CREATE TABLE public."Freelancer_identitie" (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nin_number VARCHAR(11) NOT NULL UNIQUE,
    front_id_url TEXT NOT NULL,
    back_id_url TEXT NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT nin_length_check CHECK (LENGTH(nin_number) = 11 AND nin_number ~ '^[0-9]{11}$')
);

CREATE INDEX idx_freelancer_identitie_user_id ON public."Freelancer_identitie"(user_id);
CREATE INDEX idx_freelancer_identitie_nin ON public."Freelancer_identitie"(nin_number);

ALTER TABLE public."Freelancer_identitie" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own identity" ON public."Freelancer_identitie"
    FOR ALL USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Freelancer_identitie" TO authenticated;


-- ============================================================
-- 7. FREELANCER SKILLS TABLE
-- ============================================================

CREATE TABLE public.freelancer_skills (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, skill_name)
);

CREATE INDEX idx_freelancer_skills_user_id ON public.freelancer_skills(user_id);

ALTER TABLE public.freelancer_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own skills" ON public.freelancer_skills
    FOR ALL USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_skills TO authenticated;


-- ============================================================
-- 8. PAYSTACK DATA TABLE
-- ============================================================

CREATE TABLE public."Paystack_data" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paystack_data_reference ON public."Paystack_data"(reference);
CREATE INDEX idx_paystack_data_verified ON public."Paystack_data"(verified);
CREATE INDEX idx_paystack_data_created_at ON public."Paystack_data"(created_at);

ALTER TABLE public."Paystack_data" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all Paystack data" ON public."Paystack_data"
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert Paystack data" ON public."Paystack_data"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT ON public."Paystack_data" TO authenticated;

CREATE TRIGGER update_paystack_data_updated_at
    BEFORE UPDATE ON public."Paystack_data"
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 9. AGENCY IMAGE TABLE
-- ============================================================

CREATE TABLE public.agency_image (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agency_image ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view agency images" ON public.agency_image
    FOR SELECT USING (true);

CREATE POLICY "Agencies can manage their own images" ON public.agency_image
    FOR ALL USING (auth.uid() = agency_id);

GRANT SELECT ON public.agency_image TO authenticated;
GRANT SELECT ON public.agency_image TO anon;
GRANT INSERT, UPDATE, DELETE ON public.agency_image TO authenticated;


-- ============================================================
-- 10. AGENCY LOGO TABLE (used in message notification joins)
-- ============================================================

CREATE TABLE public.agency_logo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT,
    file_url TEXT,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agency_logo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view agency logos" ON public.agency_logo
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own agency logo" ON public.agency_logo
    FOR ALL USING (auth.uid() = user_id);

GRANT SELECT ON public.agency_logo TO authenticated;
GRANT SELECT ON public.agency_logo TO anon;
GRANT INSERT, UPDATE, DELETE ON public.agency_logo TO authenticated;


-- ============================================================
-- 11. FREELANCER LOGOS TABLE
-- ============================================================

CREATE TABLE public.freelancer_logos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logo_data TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.freelancer_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view freelancer logos" ON public.freelancer_logos
    FOR SELECT USING (true);

CREATE POLICY "Freelancers can manage own logos" ON public.freelancer_logos
    FOR ALL USING (auth.uid() = freelancer_id);

GRANT SELECT ON public.freelancer_logos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.freelancer_logos TO authenticated;


-- ============================================================
-- 12. FREELANCER VERIFICATION TABLE
-- ============================================================

CREATE TABLE public.freelancer_verification (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nin TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.freelancer_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view own verification" ON public.freelancer_verification
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can insert own verification" ON public.freelancer_verification
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can update own verification" ON public.freelancer_verification
    FOR UPDATE USING (auth.uid() = freelancer_id);

GRANT SELECT, INSERT, UPDATE ON public.freelancer_verification TO authenticated;


-- ============================================================
-- 13. FREELANCER BANK DETAILS TABLE
-- ============================================================

CREATE TABLE public.freelancer_bank_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_number VARCHAR(20) NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    account_name TEXT,
    bank_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.freelancer_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view own bank details" ON public.freelancer_bank_details
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can insert own bank details" ON public.freelancer_bank_details
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can update own bank details" ON public.freelancer_bank_details
    FOR UPDATE USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can delete own bank details" ON public.freelancer_bank_details
    FOR DELETE USING (auth.uid() = freelancer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_bank_details TO authenticated;


-- ============================================================
-- 14. PAYMENT RECIPIENTS TABLE
-- ============================================================

CREATE TABLE public.payment_recipients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_code TEXT NOT NULL,
    account_name TEXT,
    account_number TEXT,
    bank_code TEXT,
    bank_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payment_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment recipients" ON public.payment_recipients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment recipients" ON public.payment_recipients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment recipients" ON public.payment_recipients
    FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_recipients TO authenticated;


-- ============================================================
-- 15. WALLET FUNDINGS TABLE
-- ============================================================

CREATE TABLE public.wallet_fundings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    reference TEXT,
    flutterwave_ref TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.wallet_fundings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet fundings" ON public.wallet_fundings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet fundings" ON public.wallet_fundings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet fundings" ON public.wallet_fundings
    FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.wallet_fundings TO authenticated;


-- ============================================================
-- 16. JOBS TABLE
-- ============================================================

CREATE TABLE public.jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    duration TEXT,
    location TEXT,
    job_type TEXT,
    skills TEXT[],
    status TEXT DEFAULT 'active',
    credit_cost INTEGER DEFAULT 0,
    comments TEXT,
    payout_status TEXT,
    payout_amount DECIMAL(10,2),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view jobs" ON public.jobs
    FOR SELECT USING (true);

CREATE POLICY "Agencies can manage own jobs" ON public.jobs
    FOR ALL USING (auth.uid() = agency_id);

GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;


-- ============================================================
-- 17. PROPOSALS TABLE
-- ============================================================

CREATE TABLE public.proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    proposal_text TEXT,
    budget DECIMAL(10,2),
    timeline TEXT,
    attachments TEXT[],
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view proposals for their jobs" ON public.proposals
    FOR SELECT USING (
        job_id IN (SELECT id FROM public.jobs WHERE agency_id = auth.uid())
    );

CREATE POLICY "Freelancers can view their own proposals" ON public.proposals
    FOR SELECT USING (freelancer_id = auth.uid());

CREATE POLICY "Agencies can update proposals for their jobs" ON public.proposals
    FOR UPDATE USING (
        job_id IN (SELECT id FROM public.jobs WHERE agency_id = auth.uid())
    );

CREATE POLICY "Freelancers can insert proposals" ON public.proposals
    FOR INSERT WITH CHECK (freelancer_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.proposals TO authenticated;


-- ============================================================
-- 18. FREELANCER PROPOSAL STATUS TABLE
-- ============================================================

CREATE TABLE public.freelancer_proposal_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    freelancer_status TEXT DEFAULT 'pending' CHECK (freelancer_status IN ('pending', 'started', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.freelancer_proposal_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposal status" ON public.freelancer_proposal_status
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Users can insert own proposal status" ON public.freelancer_proposal_status
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Users can update own proposal status" ON public.freelancer_proposal_status
    FOR UPDATE USING (auth.uid() = freelancer_id);

GRANT SELECT, INSERT, UPDATE ON public.freelancer_proposal_status TO authenticated;


-- ============================================================
-- 19. JOB FUNDING STATUS TABLE
-- ============================================================

CREATE TABLE public.job_funding_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    funding_status TEXT DEFAULT 'pending' CHECK (funding_status IN ('pending', 'funded')),
    job_status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.job_funding_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view job funding status" ON public.job_funding_status
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert job funding status" ON public.job_funding_status
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update job funding status" ON public.job_funding_status
    FOR UPDATE USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON public.job_funding_status TO authenticated;


-- ============================================================
-- 20. SAVED JOBS TABLE
-- ============================================================

CREATE TABLE public.saved_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(freelancer_id, job_id)
);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view own saved jobs" ON public.saved_jobs
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can insert own saved jobs" ON public.saved_jobs
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can delete own saved jobs" ON public.saved_jobs
    FOR DELETE USING (auth.uid() = freelancer_id);

GRANT SELECT, INSERT, DELETE ON public.saved_jobs TO authenticated;


-- ============================================================
-- 21. FUNDED JOBS TABLE
-- ============================================================

CREATE TABLE public."Funded_jobs101" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    freelancer_id UUID,
    agency_name TEXT,
    job_title TEXT,
    amount DECIMAL(10,2),
    reference_id TEXT,
    status TEXT DEFAULT 'pending_verification',
    failure_reason TEXT,
    funded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    job_confirmed BOOLEAN DEFAULT false,
    job_completed BOOLEAN DEFAULT false,
    payout_successful BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_funded_jobs_reference_id ON public."Funded_jobs101"(reference_id);
CREATE INDEX idx_funded_jobs_status ON public."Funded_jobs101"(status);

ALTER TABLE public."Funded_jobs101" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencies can view own funded jobs" ON public."Funded_jobs101"
    FOR SELECT USING (auth.uid() = agency_id);

CREATE POLICY "Freelancers can view their funded jobs" ON public."Funded_jobs101"
    FOR SELECT USING (auth.uid() = freelancer_id);

CREATE POLICY "Agencies can insert funded jobs" ON public."Funded_jobs101"
    FOR INSERT WITH CHECK (auth.uid() = agency_id);

CREATE POLICY "Agencies can update own funded jobs" ON public."Funded_jobs101"
    FOR UPDATE USING (auth.uid() = agency_id);

CREATE POLICY "Agencies can delete own funded jobs" ON public."Funded_jobs101"
    FOR DELETE USING (auth.uid() = agency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Funded_jobs101" TO authenticated;


-- ============================================================
-- 22. ESCROW DEPOSITS TABLE
-- ============================================================

CREATE TABLE public.escrow_deposits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'funded', 'confirmed')),
    paystack_reference TEXT,
    paystack_access_code TEXT,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.escrow_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own escrow deposits" ON public.escrow_deposits
    FOR SELECT USING (auth.uid() = agency_id);

CREATE POLICY "Users can insert escrow deposits" ON public.escrow_deposits
    FOR INSERT WITH CHECK (auth.uid() = agency_id);

CREATE POLICY "Users can update own escrow deposits" ON public.escrow_deposits
    FOR UPDATE USING (auth.uid() = agency_id);

GRANT SELECT, INSERT, UPDATE ON public.escrow_deposits TO authenticated;


-- ============================================================
-- 23. CONVERSATIONS TABLE
-- ============================================================

CREATE TABLE public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Users can insert conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;


-- ============================================================
-- 24. MESSAGES TABLE
-- ============================================================

CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size NUMERIC,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;


-- ============================================================
-- 25. WELCOME CREDITS TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.give_welcome_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_type = 'freelancer' THEN
    INSERT INTO public.purchase_credits (
      freelancer_id, amount, credits_amount, status, paystack_reference, created_at
    ) VALUES (
      NEW.id, 0, 80, 'completed',
      'welcome_bonus_' || NEW.id || '_' || extract(epoch from now()),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER welcome_credits_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.give_welcome_credits();
