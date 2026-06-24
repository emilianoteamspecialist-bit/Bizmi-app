import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase-service';
import { logAdminAction } from '@/lib/admin-audit';

// Admin actions on a funded-job (Funded_jobs101) transaction:
//   - 'mark_done':       confirm + complete the job
//   - 'process_payout':  flag the payout as processed
// These were previously client-side direct DB writes, so they skipped both
// admin authorisation and the audit log. They now run server-side, admin-only,
// and every action is recorded in admin_audit_log.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const transactionId = params.id;
    const { action } = await req.json();

    if (action !== 'mark_done' && action !== 'process_payout') {
      return NextResponse.json(
        { error: "action must be 'mark_done' or 'process_payout'" },
        { status: 400 },
      );
    }

    // Authn + authz: admin only.
    const cookieStore = await cookies();
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: adminProfile } = await authClient
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle();
    if (adminProfile?.account_type !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const service = createServiceRoleClient();

    // Load the transaction to validate state and capture audit detail.
    const { data: txn, error: txnError } = await service
      .from('Funded_jobs101')
      .select('id, job_id, agency_id, freelancer_id, amount, status, job_completed, payout_successful')
      .eq('id', transactionId)
      .maybeSingle();

    if (txnError) {
      return NextResponse.json({ error: 'Failed to look up transaction' }, { status: 500 });
    }
    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (action === 'mark_done') {
      if (txn.job_completed) {
        return NextResponse.json({ error: 'Job is already marked done' }, { status: 409 });
      }
      const { error } = await service
        .from('Funded_jobs101')
        .update({ job_confirmed: true, job_completed: true })
        .eq('id', transactionId);
      if (error) {
        return NextResponse.json({ error: 'Failed to mark job done' }, { status: 500 });
      }
    } else {
      // process_payout
      if (!txn.job_completed) {
        return NextResponse.json({ error: 'Job must be completed before payout' }, { status: 409 });
      }
      if (txn.payout_successful) {
        return NextResponse.json({ error: 'Payout already processed' }, { status: 409 });
      }
      const { error } = await service
        .from('Funded_jobs101')
        .update({ payout_successful: true })
        .eq('id', transactionId);
      if (error) {
        return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
      }
    }

    await logAdminAction(service, {
      adminId: user.id,
      action: action === 'mark_done' ? 'transaction.mark_done' : 'transaction.process_payout',
      targetType: 'funded_job',
      targetId: transactionId,
      details: {
        job_id: txn.job_id,
        agency_id: txn.agency_id,
        freelancer_id: txn.freelancer_id,
        amount: txn.amount,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error on transaction action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
