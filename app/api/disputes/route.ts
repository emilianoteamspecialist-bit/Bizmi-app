import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { job_id, initiator_id, respondent_id, dispute_type, description, amount_disputed } = await req.json();

    if (!job_id || !initiator_id || !respondent_id || !dispute_type || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create the dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert([
        {
          job_id,
          initiator_id,
          respondent_id,
          dispute_type,
          description,
          amount_disputed,
          status: 'in_platform_review',
        },
      ])
      .select()
      .single();

    if (disputeError) {
      console.error('Error creating dispute:', disputeError);
      return NextResponse.json({ error: 'Failed to create dispute' }, { status: 500 });
    }

    // 2. Update escrow_deposits to 'disputed' to freeze funds
    const { error: escrowError } = await supabase
      .from('escrow_deposits')
      .update({ status: 'disputed' })
      .eq('job_id', job_id);

    if (escrowError) {
      console.error('Error updating escrow status:', escrowError);
      // We don't fail the request here, but we should log it
    }

    // 3. Optional: Insert initial message if description acts as one
    await supabase.from('dispute_messages').insert([
      {
        dispute_id: dispute.id,
        sender_id: initiator_id,
        message: description,
      },
    ]);

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error('Server error creating dispute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = supabase.from('disputes').select(`
      *,
      job:jobs (title),
      initiator:profiles!disputes_initiator_id_fkey(full_name),
      respondent:profiles!disputes_respondent_id_fkey(full_name)
    `).order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`initiator_id.eq.${userId},respondent_id.eq.${userId}`);
    }

    const { data: disputes, error } = await query;

    if (error) {
      console.error('Error fetching disputes:', error);
      return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
    }

    return NextResponse.json({ disputes });
  } catch (error) {
    console.error('Server error fetching disputes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
