import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { job_id, freelancer_id, agency_id, submission_type, content } = await req.json();

    if (!job_id || !freelancer_id || !agency_id) {
      return NextResponse.json({ error: 'Missing required IDs' }, { status: 400 });
    }

    // Upsert the submission (since we have a UNIQUE constraint on job_id)
    const { data, error } = await supabase
      .from('project_submissions')
      .upsert({
        job_id,
        freelancer_id,
        agency_id,
        submission_type,
        content,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_id' })
      .select()
      .single();

    if (error) {
      console.error('Error creating submission:', error);
      return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (error) {
    console.error('Server error creating submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('project_submissions')
      .select(`
        *,
        freelancer:profiles!project_submissions_freelancer_id_fkey(full_name),
        agency:profiles!project_submissions_agency_id_fkey(full_name)
      `)
      .eq('job_id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows found'
      console.error('Error fetching submission:', error);
      return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
    }

    return NextResponse.json({ submission: data || null });
  } catch (error) {
    console.error('Server error fetching submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
