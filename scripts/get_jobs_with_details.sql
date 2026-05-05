CREATE OR REPLACE FUNCTION get_jobs_with_details(
    p_user_id UUID,
    p_search_query TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 10,
    p_from_date TEXT DEFAULT NULL,
    p_to_date TEXT DEFAULT NULL,
    p_max_credits INTEGER DEFAULT NULL,
    p_job_type TEXT DEFAULT NULL,
    p_category_skills TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    agency_id UUID,
    title TEXT,
    description TEXT,
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    duration TEXT,
    location TEXT,
    job_type TEXT,
    skills TEXT[],
    status TEXT,
    credit_cost INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    proposal_count BIGINT,
    is_bookmarked BOOLEAN,
    agency_info JSONB,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_jobs AS (
        SELECT 
            j.*,
            (SELECT count(*) FROM proposals p WHERE p.job_id = j.id) as p_count,
            EXISTS (SELECT 1 FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.freelancer_id = p_user_id) as bookmarked,
            (SELECT count(*) OVER()) as t_count
        FROM jobs j
        WHERE j.status = 'active'
        AND (p_search_query = '' OR j.title ILIKE '%' || p_search_query || '%' OR j.description ILIKE '%' || p_search_query || '%')
        AND (p_from_date IS NULL OR j.created_at >= p_from_date::TIMESTAMP WITH TIME ZONE)
        AND (p_to_date IS NULL OR j.created_at <= p_to_date::TIMESTAMP WITH TIME ZONE)
        AND (p_max_credits IS NULL OR j.credit_cost <= p_max_credits)
        AND (p_job_type IS NULL OR j.job_type = p_job_type)
        AND (p_category_skills IS NULL OR j.skills && p_category_skills)
    )
    SELECT 
        fj.id,
        fj.agency_id,
        fj.title,
        fj.description,
        fj.budget_min,
        fj.budget_max,
        fj.duration,
        fj.location,
        fj.job_type,
        fj.skills,
        fj.status,
        fj.credit_cost,
        fj.created_at,
        fj.p_count as proposal_count,
        fj.bookmarked as is_bookmarked,
        jsonb_build_object(
            'id', pr.id,
            'full_name', pr.full_name,
            'company_name', pr.company_name,
            'company_size', pr.company_size,
            'bio', pr.bio,
            'location', pr.location,
            'phone', pr.phone,
            'website', pr.website,
            'created_at', pr.created_at,
            'account_type', pr.account_type,
            'logo', (SELECT image_data FROM agency_image ai WHERE ai.agency_id = fj.agency_id LIMIT 1),
            'total_jobs', (SELECT count(*) FROM jobs j2 WHERE j2.agency_id = fj.agency_id)
        ) as agency_info,
        fj.t_count as total_count
    FROM filtered_jobs fj
    JOIN profiles pr ON fj.agency_id = pr.id
    ORDER BY fj.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
