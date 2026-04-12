-- ============================================================
-- PROJECT SUBMISSION SYSTEM TABLES
-- ============================================================

-- 1. Project Submissions Table
CREATE TABLE IF NOT EXISTS public.project_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- e.g., 'tech', 'design', 'writing', 'general'
    submission_type TEXT NOT NULL DEFAULT 'general', 
    
    -- JSON structure to hold flexible data (github_url, figma_url, drive_link, notes, attached_files array)
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Status of the submission
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'changes_requested', 'approved')),
    
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active submission thread per job
    UNIQUE(job_id)
);

ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

-- 2. Submission Comments (Feedback Thread)
CREATE TABLE IF NOT EXISTS public.submission_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES public.project_submissions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.submission_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Submissions: Freelancers and Agencies involved can view
CREATE POLICY "Users can view their job submissions" ON public.project_submissions
    FOR SELECT USING (auth.uid() = freelancer_id OR auth.uid() = agency_id);

-- Submissions: Freelancers can insert their submissions
CREATE POLICY "Freelancers can create submissions" ON public.project_submissions
    FOR INSERT WITH CHECK (auth.uid() = freelancer_id);

-- Submissions: Both parties can update (Freelancer updates content, Agency updates status)
CREATE POLICY "Users can update their job submissions" ON public.project_submissions
    FOR UPDATE USING (auth.uid() = freelancer_id OR auth.uid() = agency_id);

-- Comments: Involved users can view comments
CREATE POLICY "Users can view submission comments" ON public.submission_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_submissions
            WHERE id = submission_id AND (freelancer_id = auth.uid() OR agency_id = auth.uid())
        )
    );

-- Comments: Involved users can post comments
CREATE POLICY "Users can post submission comments" ON public.submission_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_submissions
            WHERE id = submission_id AND (freelancer_id = auth.uid() OR agency_id = auth.uid())
        )
        AND sender_id = auth.uid()
    );
