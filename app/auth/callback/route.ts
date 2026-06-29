import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// Handles the PKCE redirect from Supabase email confirmation links.
// Supabase appends `?code=...` to this URL after verifying the token; we
// exchange it for a session (setting the auth cookies) and then send the
// user to the login page.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/login?confirmed=true`)
}
