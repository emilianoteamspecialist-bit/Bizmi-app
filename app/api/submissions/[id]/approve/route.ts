import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase-service';
import { qualifyReferralOnRelease } from '@/lib/influencer-referrals';

// Approves a freelancer's submission and marks the job ready for payout.
//
// Only the agency that owns the job may approve it. Previously this route had
// no auth at all — anyone could mark any submission approved and flip a job to
// payable. Now the caller is authenticated and must own the job; the privileged
// writes go through the service-role client rather than relying on RLS.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const submissionId = params.id;
    const { job_id } = await req.json();

    if (!submissionId || !job_id) {
      return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = createServiceRoleClient();

    // Authorisation: only the job's agency can approve work on it.
    const { data: job, error: jobLookupError } = await service
      .from('jobs')
      .select('agency_id, payout_status')
      .eq('id', job_id)
      .maybeSingle();

    if (jobLookupError) {
      return NextResponse.json({ error: 'Failed to look up job' }, { status: 500 });
    }
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.agency_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Approve the submission.
    const { error: subError } = await service
      .from('project_submissions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (subError) throw subError;

    // 2. Mark the job completed for the freelancer's "Funded Jobs" view.
    const { error: fundedError } = await service
      .from('Funded_jobs101')
      .update({ job_completed: true })
      .eq('job_id', job_id);

    if (fundedError) {
      console.warn('Could not update Funded_jobs101 (may not exist yet):', fundedError);
    }

    // 3. Close the job. Only flip payout_status to 'completed' (the payable
    //    gate) when a payout hasn't already started — never re-open a payout
    //    that is processing or already paid.
    const jobUpdate =
      job.payout_status === 'paid' || job.payout_status === 'processing'
        ? { status: 'closed' }
        : { status: 'closed', payout_status: 'completed' };

    const { error: jobError } = await service.from('jobs').update(jobUpdate).eq('id', job_id);
    if (jobError) throw jobError;

    // 4. Mark the escrow confirmed.
    const { error: escrowError } = await service
      .from('escrow_deposits')
      .update({ status: 'confirmed' })
      .eq('job_id', job_id);

    if (escrowError) {
      console.warn('Could not update escrow_deposits:', escrowError);
    }

    // 5. Influencer referral: this is the release/qualifying event. Pay the
    //    influencer of any referred party their commission, once. Fail-soft.
    const { data: escrowRow } = await service
      .from('escrow_deposits')
      .select('freelancer_id, amount_kobo')
      .eq('job_id', job_id)
      .maybeSingle();
    await qualifyReferralOnRelease(service, {
      job_id,
      agency_id: job.agency_id,
      freelancer_id: (escrowRow as any)?.freelancer_id ?? null,
      amount_kobo: (escrowRow as any)?.amount_kobo ?? null,
    });

    return NextResponse.json({ success: true, message: 'Project approved and funds released.' });
  } catch (error) {
    console.error('Server error approving submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
