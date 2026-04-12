-- ============================================================
-- DISPUTE RESOLUTION TABLES
-- ============================================================

-- 1. Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    respondent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dispute_type TEXT NOT NULL CHECK (dispute_type IN ('quality', 'non_delivery', 'client_abandonment', 'extra_work')),
    status TEXT NOT NULL DEFAULT 'in_platform_review' CHECK (status IN ('in_platform_review', 'admin_intervention', 'resolved')),
    resolution_outcome TEXT CHECK (resolution_outcome IN ('full_release', 'partial_release', 'refund', 'none')),
    amount_disputed DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- 2. Dispute Messages Table
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- 3. Dispute Evidence Table
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Drop existing policies if running multiple times
DROP POLICY IF EXISTS "Users can view their own disputes" ON public.disputes;
DROP POLICY IF EXISTS "Users can create disputes" ON public.disputes;
DROP POLICY IF EXISTS "Users can view messages in their disputes" ON public.dispute_messages;
DROP POLICY IF EXISTS "Users can send messages to their disputes" ON public.dispute_messages;
DROP POLICY IF EXISTS "Users can view evidence in their disputes" ON public.dispute_evidence;
DROP POLICY IF EXISTS "Users can upload evidence to their disputes" ON public.dispute_evidence;

-- Disputes: Users can see disputes they are a party to
CREATE POLICY "Users can view their own disputes" ON public.disputes
    FOR SELECT USING (auth.uid() = initiator_id OR auth.uid() = respondent_id);

-- Disputes: Users can create disputes
CREATE POLICY "Users can create disputes" ON public.disputes
    FOR INSERT WITH CHECK (auth.uid() = initiator_id);

-- Dispute Messages: Users can see and send messages in their disputes
CREATE POLICY "Users can view messages in their disputes" ON public.dispute_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.disputes
            WHERE id = dispute_id AND (initiator_id = auth.uid() OR respondent_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages to their disputes" ON public.dispute_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.disputes
            WHERE id = dispute_id AND (initiator_id = auth.uid() OR respondent_id = auth.uid())
        )
        AND sender_id = auth.uid()
    );

-- Dispute Evidence: Similar to messages
CREATE POLICY "Users can view evidence in their disputes" ON public.dispute_evidence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.disputes
            WHERE id = dispute_id AND (initiator_id = auth.uid() OR respondent_id = auth.uid())
        )
    );

CREATE POLICY "Users can upload evidence to their disputes" ON public.dispute_evidence
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.disputes
            WHERE id = dispute_id AND (initiator_id = auth.uid() OR respondent_id = auth.uid())
        )
        AND uploader_id = auth.uid()
    );

-- ============================================================
-- UPDATE ESCROW DEPOSITS
-- ============================================================
ALTER TABLE public.escrow_deposits DROP CONSTRAINT IF EXISTS escrow_deposits_status_check;
ALTER TABLE public.escrow_deposits ADD CONSTRAINT escrow_deposits_status_check CHECK (status IN ('awaiting', 'funded', 'confirmed', 'disputed', 'refunded'));
