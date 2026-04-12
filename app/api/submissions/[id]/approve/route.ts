import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const submissionId = params.id;
    const { job_id } = await req.json();

    if (!submissionId || !job_id) {
      return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
    }

    // 1. Update submission status
    const { error: subError } = await supabase
      .from('project_submissions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (subError) throw subError;

    // 2. Mark job as completed in Funded_jobs101 (releasing funds to freelancer dashboard)
    const { error: fundedError } = await supabase
      .from('Funded_jobs101')
      .update({ job_completed: true })
      .eq('job_id', job_id);

    if (fundedError) {
       console.warn('Could not update Funded_jobs101, it might not exist for this job yet:', fundedError);
    }

    // 3. Update job status to closed
    const { error: jobError } = await supabase
      .from('jobs')
      .update({ status: 'closed', payout_status: 'completed' })
      .eq('id', job_id);

    if (jobError) throw jobError;

    // 4. Update escrow deposit status to confirmed
    const { error: escrowError } = await supabase
      .from('escrow_deposits')
      .update({ status: 'confirmed' })
      .eq('job_id', job_id);

    if (escrowError) {
      console.warn('Could not update escrow_deposits:', escrowError);
    }

    return NextResponse.json({ success: true, message: 'Project approved and funds released.' });
  } catch (error) {
    console.error('Server error approving submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
