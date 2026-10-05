import crypto from "node:crypto"
import { Router } from "express"
import { asyncHandler } from "../lib/http.js"
import { createServiceClient } from "../lib/supabase.js"
import { paystackRequest, PaystackError } from "../lib/paystack.js"
import { payoutAmounts } from "../lib/escrow.js"
import { payoutReference } from "../lib/payouts.js"

const payoutsRouter = Router()

// ── Bank details ───────────────────────────────────────────────────────────

let bankListCache: { at: number; banks: { name: string; code: string }[] } | null = null
const BANK_LIST_TTL_MS = 6 * 60 * 60 * 1000

// GET /api/payouts/banks -- Nigerian banks Paystack can pay out to.
payoutsRouter.get(
  "/banks",
  asyncHandler(async (_req, res) => {
    if (!bankListCache || Date.now() - bankListCache.at > BANK_LIST_TTL_MS) {
      try {
        const banks = await paystackRequest<{ name: string; code: string; active?: boolean }[]>("GET", "/bank?country=nigeria&currency=NGN")
        bankListCache = {
          at: Date.now(),
          banks: banks.filter((b) => b.active !== false).map((b) => ({ name: b.name, code: b.code })),
        }
      } catch (err) {
        res.status(502).json({ error: err instanceof PaystackError ? err.message : "Could not load banks" })
        return
      }
    }
    res.json({ banks: bankListCache.banks })
  })
)

// GET /api/payouts/bank-details -- the caller's saved payout account.
payoutsRouter.get(
  "/bank-details",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from("freelancer_bank_details")
      .select("account_number, bank_code, account_name, bank_name, updated_at")
      .eq("freelancer_id", req.user!.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    res.json({ bankDetails: data ?? null })
  })
)

// PUT /api/payouts/bank-details { account_number, bank_code }
// The account name is resolved by Paystack, never typed by the user.
payoutsRouter.put(
  "/bank-details",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const accountNumber = typeof req.body?.account_number === "string" ? req.body.account_number.trim() : ""
    const bankCode = typeof req.body?.bank_code === "string" ? req.body.bank_code.trim() : ""
    if (!/^\d{10}$/.test(accountNumber)) {
      res.status(400).json({ error: "Account number must be 10 digits" })
      return
    }
    if (!/^[0-9A-Za-z]{2,10}$/.test(bankCode)) {
      res.status(400).json({ error: "A valid bank is required" })
      return
    }

    let resolved: { account_name: string }
    try {
      resolved = await paystackRequest(
        "GET",
        `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
      )
    } catch (err) {
      res.status(400).json({ error: err instanceof PaystackError ? err.message : "Could not verify that account" })
      return
    }

    const bankName = bankListCache?.banks.find((b) => b.code === bankCode)?.name ?? null
    const row = {
      account_number: accountNumber,
      bank_code: bankCode,
      account_name: resolved.account_name,
      bank_name: bankName,
      updated_at: new Date().toISOString(),
    }

    const { data: existing, error: existingError } = await req.supabase!
      .from("freelancer_bank_details")
      .select("id")
      .eq("freelancer_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    const { error } = existing
      ? await req.supabase!.from("freelancer_bank_details").update(row).eq("id", existing.id)
      : await req.supabase!.from("freelancer_bank_details").insert({ ...row, freelancer_id: userId })
    if (error) throw error

    res.json({ success: true, bankDetails: { account_number: accountNumber, bank_code: bankCode, account_name: resolved.account_name, bank_name: bankName } })
  })
)

// ── Payout request ─────────────────────────────────────────────────────────

// POST /api/payouts/request { escrowId }
// The freelancer withdraws a released escrow. Amount = amount_kobo minus the
// platform fee, derived here. Double-pay is prevented three ways:
//   1. the escrow must be 'released' (paid_out escrows can't pay again);
//   2. jobs.payout_status is claimed 'completed' -> 'processing' -- the same
//      lock the legacy Next.js payout route takes, so the two apps can't both
//      pay while they run side by side;
//   3. payouts_one_active_per_escrow allows a single pending/processing/
//      success payout per escrow.
payoutsRouter.post(
  "/request",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const escrowId = typeof req.body?.escrowId === "string" ? req.body.escrowId : ""
    if (!escrowId) {
      res.status(400).json({ error: "escrowId is required" })
      return
    }

    const service = createServiceClient()
    const { data: escrow, error: escrowError } = await service
      .from("escrow_deposits")
      .select("id, job_id, freelancer_id, amount_kobo, status_v2")
      .eq("id", escrowId)
      .maybeSingle()
    if (escrowError) throw escrowError
    if (!escrow || escrow.freelancer_id !== userId) {
      res.status(404).json({ error: "Escrow not found" })
      return
    }
    if (escrow.status_v2 !== "released") {
      res.status(409).json({ error: `Payout is only available once the work is approved (escrow is ${escrow.status_v2})` })
      return
    }

    const { data: bank, error: bankError } = await req.supabase!
      .from("freelancer_bank_details")
      .select("account_number, bank_code, account_name")
      .eq("freelancer_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (bankError) throw bankError
    if (!bank?.account_number || !bank?.bank_code || !bank?.account_name) {
      res.status(400).json({ error: "Add and verify your bank details before requesting a payout", code: "no_bank_details" })
      return
    }

    const amounts = payoutAmounts(Number(escrow.amount_kobo))

    // Cross-app lock (2).
    const { data: claimed, error: claimError } = await service
      .from("jobs")
      .update({ payout_status: "processing" })
      .eq("id", escrow.job_id)
      .eq("payout_status", "completed")
      .select("id")
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimed) {
      res.status(409).json({ error: "A payout for this job is already in progress or complete" })
      return
    }
    const releaseClaim = () =>
      service.from("jobs").update({ payout_status: "completed" }).eq("id", escrow.job_id).eq("payout_status", "processing")

    // One active payout per escrow (3).
    const { data: payout, error: insertError } = await service
      .from("payouts")
      .insert({
        escrow_id: escrow.id,
        freelancer_id: userId,
        gross_amount_kobo: amounts.grossKobo,
        platform_fee_kobo: amounts.feeKobo,
        net_amount_kobo: amounts.netKobo,
        bank_account_number: bank.account_number,
        bank_code: bank.bank_code,
        account_name: bank.account_name,
        status: "pending",
        idempotency_key: `payout:${escrow.id}:${crypto.randomUUID()}`,
      })
      .select("id")
      .single()
    if (insertError) {
      await releaseClaim()
      if ((insertError as { code?: string }).code === "23505") {
        res.status(409).json({ error: "A payout for this job is already in progress or complete" })
        return
      }
      throw insertError
    }

    const markFailed = async (reason: string) => {
      await service.from("payouts").update({ status: "failed", failure_reason: reason }).eq("id", payout.id).eq("status", "pending")
      await releaseClaim()
    }

    let recipientCode: string
    try {
      const recipient = await paystackRequest<{ recipient_code: string }>("POST", "/transferrecipient", {
        type: "nuban",
        name: bank.account_name,
        account_number: bank.account_number,
        bank_code: bank.bank_code,
        currency: "NGN",
      })
      recipientCode = recipient.recipient_code
    } catch (err) {
      // No transfer was attempted, so this is safely retryable.
      await markFailed(err instanceof Error ? err.message : "Recipient creation failed")
      res.status(502).json({ error: err instanceof PaystackError ? err.message : "Could not reach the payment service" })
      return
    }

    // Move to processing BEFORE asking Paystack to send money, so a crash
    // after the transfer can never leave a retryable 'pending' row behind.
    await service.from("payouts").update({ status: "processing", paystack_recipient_code: recipientCode }).eq("id", payout.id)

    try {
      const transfer = await paystackRequest<{ transfer_code?: string; status?: string }>("POST", "/transfer", {
        source: "balance",
        amount: amounts.netKobo,
        recipient: recipientCode,
        reason: `Bizimi payout for job ${escrow.job_id}`,
        // Paystack dedupes transfers by reference, and the webhook maps it back.
        reference: payoutReference(payout.id),
      })
      if (transfer.transfer_code) {
        await service.from("payouts").update({ paystack_transfer_code: transfer.transfer_code }).eq("id", payout.id)
      }
    } catch (err) {
      if (err instanceof PaystackError) {
        // Paystack explicitly rejected the transfer: nothing was sent.
        await service
          .from("payouts")
          .update({ status: "failed", failure_reason: err.message })
          .eq("id", payout.id)
          .eq("status", "processing")
        await releaseClaim()
        res.status(502).json({ error: err.message })
        return
      }
      // Network-level failure: the transfer may or may not have gone through.
      // Leave the payout 'processing' and the job claimed; the transfer.*
      // webhook settles it either way. Never retry blindly.
      console.error("[payouts] ambiguous transfer failure -- awaiting webhook", { payoutId: payout.id, err })
      res.status(202).json({ success: true, payout: { id: payout.id, status: "processing", net_amount_kobo: amounts.netKobo } })
      return
    }

    res.json({ success: true, payout: { id: payout.id, status: "processing", net_amount_kobo: amounts.netKobo } })
  })
)

export default payoutsRouter
