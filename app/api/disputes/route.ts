import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { job_id, initiator_id, respondent_id, dispute_type, description, amount_disputed } = await req.json();

    if (!job_id || !initiator_id || !respondent_id || !dispute_type || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use the cookie-aware server client so RLS sees the user (auth.uid()).
    const supabase = await createClient();

    // Optional but recommended: verify initiator_id matches the authed user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (user.id !== initiator_id) {
      return NextResponse.json({ error: 'initiator_id must match authenticated user' }, { status: 403 });
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
      console.error('Error creating dispute:', {
        message: disputeError.message,
        code: disputeError.code,
        details: disputeError.details,
        hint: disputeError.hint,
      });
      return NextResponse.json(
        {
          error: 'Failed to create dispute',
          details: disputeError.message,
          code: disputeError.code,
          hint: disputeError.hint,
        },
        { status: 500 }
      );
    }

    // 2. Update escrow_deposits to 'disputed' to freeze funds
    const { error: escrowError } = await supabase
      .from('escrow_deposits')
      .update({ status: 'disputed' })
      .eq('job_id', job_id);

    if (escrowError) {
      console.error('Error updating escrow status:', escrowError);
      // Don't fail the request — the dispute exists; escrow status is bookkeeping.
    }

    // 3. Insert initial message from the description so the dispute room has context
    const { error: msgError } = await supabase.from('dispute_messages').insert([
      {
        dispute_id: dispute.id,
        sender_id: initiator_id,
        message: description,
      },
    ]);
    if (msgError) {
      console.error('Error inserting initial dispute message:', msgError);
    }

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error('Server error creating dispute:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const supabase = await createClient();

    let query = supabase.from('disputes').select('*').order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`initiator_id.eq.${userId},respondent_id.eq.${userId}`);
    }

    const { data: disputes, error } = await query;

    if (error) {
      console.error('Error fetching disputes:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
    }

    return NextResponse.json({ disputes });
  } catch (error) {
    console.error('Server error fetching disputes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
