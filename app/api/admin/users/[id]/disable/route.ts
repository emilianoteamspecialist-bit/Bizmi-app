import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase-service';
import { logAdminAction } from '@/lib/admin-audit';

// Disable (suspend) or re-enable a user. Disabling bans the auth account so the
// user can no longer sign in or refresh their session. Admin-only.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const targetUserId = params.id;
    const { disabled } = await req.json();

    if (typeof disabled !== 'boolean') {
      return NextResponse.json({ error: 'Body must include { disabled: boolean }' }, { status: 400 });
    }

    // Authn + authz: caller must be a signed-in admin.
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

    // An admin can't lock themselves out.
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'You cannot disable your own account' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    // Don't allow disabling another admin.
    const { data: targetProfile } = await service
      .from('profiles')
      .select('account_type')
      .eq('id', targetUserId)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (targetProfile.account_type === 'admin') {
      return NextResponse.json({ error: 'Cannot disable an admin account' }, { status: 403 });
    }

    // ban_duration "none" lifts the ban; a long duration effectively suspends.
    const { error } = await service.auth.admin.updateUserById(targetUserId, {
      ban_duration: disabled ? '876000h' : 'none',
    });

    if (error) {
      console.error('Failed to update user ban state:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAdminAction(service, {
      adminId: user.id,
      action: disabled ? 'user.disable' : 'user.enable',
      targetType: 'user',
      targetId: targetUserId,
    });

    return NextResponse.json({ success: true, disabled });
  } catch (error) {
    console.error('Server error disabling user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
