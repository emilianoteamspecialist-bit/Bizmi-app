import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase-service"
import { logAdminAction } from "@/lib/admin-audit"

// Records a manual payout of an influencer's full unpaid balance:
//   1. zero the balance (guarded against a concurrent qualify),
//   2. insert an influencer_payouts record,
//   3. flip the covered 'qualified' referrals → 'paid',
//   4. audit-log it.
// Admin only. No money actually moves here — this records that the admin paid
// the influencer out-of-band (matching the dispute/admin-action style).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const influencerId = params.id
    const body = await req.json().catch(() => ({}))
    const note: string | null = typeof body?.note === "string" ? body.note.slice(0, 500) : null

    // Authn + authz: admin only.
    const cookieStore = await cookies()
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { data: adminProfile } = await authClient
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle()
    if (adminProfile?.account_type !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    // Read the current balance + the qualified referrals it covers.
    const { data: influencer } = await service
      .from("influencer_profiles")
      .select("user_id, balance_unpaid_kobo")
      .eq("user_id", influencerId)
      .maybeSingle()
    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 })
    }

    const amountKobo = Number((influencer as any).balance_unpaid_kobo || 0)
    if (amountKobo <= 0) {
      return NextResponse.json({ error: "Nothing to pay out" }, { status: 409 })
    }

    const { data: qualifiedRefs } = await service
      .from("referrals")
      .select("id")
      .eq("influencer_id", influencerId)
      .eq("status", "qualified")
    const coveredIds = (qualifiedRefs as { id: string }[] | null)?.map((r) => r.id) ?? []

    // Zero the balance, guarded so a payout can't race a fresh qualify.
    const { data: zeroed } = await service
      .from("influencer_profiles")
      .update({ balance_unpaid_kobo: 0 })
      .eq("user_id", influencerId)
      .eq("balance_unpaid_kobo", amountKobo)
      .select("user_id")
      .maybeSingle()
    if (!zeroed) {
      return NextResponse.json(
        { error: "Balance changed — please refresh and try again" },
        { status: 409 },
      )
    }

    // Record the payout and mark the covered referrals paid.
    await service.from("influencer_payouts").insert({
      influencer_id: influencerId,
      amount_kobo: amountKobo,
      status: "paid",
      processed_by: user.id,
      note,
    })

    if (coveredIds.length > 0) {
      await service.from("referrals").update({ status: "paid" }).in("id", coveredIds)
    }

    await logAdminAction(service, {
      adminId: user.id,
      action: "influencer.payout",
      targetType: "influencer",
      targetId: influencerId,
      details: { amount_kobo: amountKobo, referrals_paid: coveredIds.length, note },
    })

    return NextResponse.json({ success: true, amount_kobo: amountKobo })
  } catch (error) {
    console.error("Influencer payout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
