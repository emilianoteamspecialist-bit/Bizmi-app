import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const disputeId = params.id;
    const { resolution_outcome, admin_id, partial_amount } = await req.json();

    if (!resolution_outcome || !admin_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch the dispute to know the job and users
    const { data: dispute, error: fetchError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (fetchError || !dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    // 2. Fetch the escrow deposit to know the exact balance
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow_deposits')
      .select('*')
      .eq('job_id', dispute.job_id)
      .single();

    if (escrowError || !escrow) {
      console.error('Escrow not found for job:', dispute.job_id);
      return NextResponse.json({ error: 'Escrow record not found' }, { status: 404 });
    }

    const totalBalance = Number(escrow.balance);
    
    // Calculate split
    let freelancerAmount = 0;
    let agencyAmount = 0;

    if (resolution_outcome === 'full_release') {
      freelancerAmount = totalBalance;
    } else if (resolution_outcome === 'refund') {
      agencyAmount = totalBalance;
    } else if (resolution_outcome === 'partial_release') {
      freelancerAmount = Number(partial_amount);
      agencyAmount = totalBalance - freelancerAmount;
    }

    // 3. Move the money (ideally this should be an RPC function for transactional integrity)
    // For now, we manually update the wallets

    if (freelancerAmount > 0) {
      // Find freelancer ID (we need to know who is who. Initiator vs respondent)
      // Usually, we fetch job details to know agency_id, then the other is freelancer
      const { data: job } = await supabase.from('jobs').select('agency_id').eq('id', dispute.job_id).single();
      const freelancerId = dispute.initiator_id === job?.agency_id ? dispute.respondent_id : dispute.initiator_id;

      await supabase.rpc('increment_user_wallet', {
        uid: freelancerId,
        amt: freelancerAmount,
      });
    }

    if (agencyAmount > 0) {
      const { data: job } = await supabase.from('jobs').select('agency_id').eq('id', dispute.job_id).single();
      const agencyId = job?.agency_id;
      
      await supabase.rpc('increment_user_wallet', {
        uid: agencyId,
        amt: agencyAmount,
      });
    }

    // 4. Update Escrow status
    await supabase.from('escrow_deposits').update({ status: resolution_outcome === 'refund' ? 'refunded' : 'confirmed', balance: 0 }).eq('id', escrow.id);

    // 5. Update Dispute status
    const { error: updateError } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution_outcome,
        admin_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', disputeId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update dispute status' }, { status: 500 });
    }

    // Optional: Trust score penalty logic can be added here later (Phase 2)

    return NextResponse.json({ success: true, message: 'Dispute resolved successfully' });
  } catch (error) {
    console.error('Server error resolving dispute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
