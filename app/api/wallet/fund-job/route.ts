import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { user_id, amount, job_id, agency_name, job_title } = await req.json()

    console.log("🚀 Fund job request received:", { user_id, amount, job_id, agency_name, job_title })

    // Validate required fields
    if (!user_id || !amount || !job_id) {
      console.error("❌ Missing required fields:", { user_id, amount, job_id })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get current wallet balance from successful payments
    console.log("📊 Fetching wallet balance for user:", user_id)
    const { data: successfulPayments, error: paymentsError } = await supabase
      .from("wallet_fundings")
      .select("amount")
      .eq("user_id", user_id)
      .eq("status", "successful")

    if (paymentsError) {
      console.error("❌ Error fetching payments:", paymentsError)
      return NextResponse.json({ error: "Error fetching wallet balance: " + paymentsError.message }, { status: 500 })
    }

    console.log("💰 Raw payments data:", successfulPayments)
    const currentBalance = successfulPayments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0
    console.log("💳 Current balance calculated:", currentBalance)

    // Check if sufficient funds
    if (currentBalance < amount) {
      console.log("❌ Insufficient funds:", { currentBalance, requestedAmount: amount })
      return NextResponse.json(
        {
          error: "Insufficient funds",
          currentBalance,
          requestedAmount: amount,
        },
        { status: 400 },
      )
    }

    // Create deduction record in wallet_fundings
    console.log("💸 Creating deduction record...")
    const { data: deductionRecord, error: deductionError } = await supabase
      .from("wallet_fundings")
      .insert({
        user_id: user_id,
        amount: -amount, // Negative amount for deduction
        status: "successful",
        flutterwave_ref: `JOB_FUND_${job_id}_${Date.now()}`,
      })
      .select()
      .single()

    if (deductionError) {
      console.error("❌ Error creating deduction record:", deductionError)
      return NextResponse.json(
        {
          error: "Error processing deduction: " + deductionError.message,
          details: deductionError,
        },
        { status: 500 },
      )
    }

    console.log("✅ Deduction record created:", deductionRecord)

    // Store in Funded_jobs101 table
    console.log("📝 Creating funded job record...")
    const fundedJobData = {
      job_id: job_id,
      agency_id: user_id,
      agency_name: agency_name || "Unknown Agency",
      job_title: job_title || "Unknown Job",
      amount: amount,
      status: "funded",
      funded_at: new Date().toISOString(),
    }

    console.log("📋 Funded job data to insert:", fundedJobData)

    const { data: fundedJob, error: fundedJobError } = await supabase
      .from("Funded_jobs101")
      .insert(fundedJobData)
      .select()
      .single()

    if (fundedJobError) {
      console.error("❌ Error creating funded job record:", fundedJobError)
      console.error("❌ Error details:", {
        message: fundedJobError.message,
        details: fundedJobError.details,
        hint: fundedJobError.hint,
        code: fundedJobError.code,
      })

      // Rollback the deduction
      console.log("🔄 Rolling back deduction...")
      await supabase.from("wallet_fundings").delete().eq("id", deductionRecord.id)

      return NextResponse.json(
        {
          error: "Error creating funded job record: " + fundedJobError.message,
          details: fundedJobError.details,
          hint: fundedJobError.hint,
          code: fundedJobError.code,
        },
        { status: 500 },
      )
    }

    console.log("✅ Funded job record created:", fundedJob)

    const newBalance = currentBalance - amount
    console.log("🎉 Transaction completed successfully. New balance:", newBalance)

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      funded_job: fundedJob,
      deduction_record: deductionRecord,
      message: "Job funded successfully",
    })
  } catch (error) {
    console.error("💥 Unexpected error in fund job API:", error)
    return NextResponse.json(
      {
        error: "Internal server error: " + (error as Error).message,
        stack: (error as Error).stack,
      },
      { status: 500 },
    )
  }
}
