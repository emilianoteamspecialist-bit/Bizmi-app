import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    console.log("🎁 Welcome bonus API called")

    const { userId } = await request.json()

    if (!userId) {
      console.log("❌ No user ID provided")
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("👤 Processing welcome bonus for user:", userId)

    // Check if user is a freelancer
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .single()

    if (profileError) {
      console.log("❌ Error fetching profile:", profileError)
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      )
    }

    if (profile.account_type !== "freelancer") {
      console.log("❌ User is not a freelancer:", profile.account_type)
      return NextResponse.json(
        { error: "Welcome bonus only available for freelancers" },
        { status: 400 }
      )
    }

    // Check if user already has welcome bonus
    const { data: existingBonus, error: bonusCheckError } = await supabase
      .from("purchase_credits")
      .select("id")
      .eq("freelancer_id", userId)
      .like("paystack_reference", "welcome_bonus_%")
      .single()

    if (bonusCheckError && bonusCheckError.code !== "PGRST116") {
      console.log("❌ Error checking existing bonus:", bonusCheckError)
      return NextResponse.json(
        { error: "Failed to check existing bonus" },
        { status: 500 }
      )
    }

    if (existingBonus) {
      console.log("⚠️ User already has welcome bonus")
      return NextResponse.json(
        { message: "Welcome bonus already claimed" },
        { status: 200 }
      )
    }

    // Create welcome bonus record
    const welcomeReference = `welcome_bonus_${userId}_${Date.now()}`
    
    const { data: bonusRecord, error: bonusError } = await supabase
      .from("purchase_credits")
      .insert({
        freelancer_id: userId,
        amount: 0, // Free credits
        credits_amount: 80, // 80 welcome credits
        status: "completed",
        paystack_reference: welcomeReference,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (bonusError) {
      console.log("❌ Error creating welcome bonus:", bonusError)
      return NextResponse.json(
        { error: "Failed to create welcome bonus" },
        { status: 500 }
      )
    }

    console.log("✅ Welcome bonus created successfully:", bonusRecord)

    return NextResponse.json({
      success: true,
      message: "Welcome bonus of 80 credits added successfully!",
      credits: 80,
      reference: welcomeReference
    })

  } catch (error) {
    console.error("💥 Welcome bonus API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
