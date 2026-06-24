import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase-service';
import { logAdminAction } from '@/lib/admin-audit';

// Admin job moderation: remove a job posting from the marketplace, or restore
// it. Admin-only and audited. A removed job (moderation_status = 'removed') is
// excluded by the get_jobs_with_details listing RPC.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const jobId = params.id;
    const { action, reason } = await req.json();

    if (action !== 'remove' && action !== 'restore') {
      return NextResponse.json({ error: "action must be 'remove' or 'restore'" }, { status: 400 });
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

    const { data: job, error: jobError } = await service
      .from('jobs')
      .select('id, title, agency_id, moderation_status')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: 'Failed to look up job' }, { status: 500 });
    }
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const removing = action === 'remove';
    const { error: updateError } = await service
      .from('jobs')
      .update({
        moderation_status: removing ? 'removed' : 'visible',
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        moderation_reason: removing ? reason ?? null : null,
      })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
    }

    await logAdminAction(service, {
      adminId: user.id,
      action: removing ? 'job.remove' : 'job.restore',
      targetType: 'job',
      targetId: jobId,
      details: { title: job.title, agency_id: job.agency_id, reason: removing ? reason ?? null : null },
    });

    return NextResponse.json({ success: true, moderation_status: removing ? 'removed' : 'visible' });
  } catch (error) {
    console.error('Server error moderating job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
