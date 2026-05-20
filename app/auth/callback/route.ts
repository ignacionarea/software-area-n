import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isEmailAllowed } from "@/lib/auth/allowlist"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (!isEmailAllowed(data.user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_allowed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
