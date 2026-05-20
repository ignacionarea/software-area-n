import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runScrapers } from "@/lib/scrapers/run"
import { isEmailAllowed } from "@/lib/auth/allowlist"

export const dynamic = "force-dynamic"
export const maxDuration = 300

async function isCronRequest(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

export async function POST(request: NextRequest) {
  const fromCron = await isCronRequest(request)

  if (!fromCron) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isEmailAllowed(user.email)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  let body: { sources?: ("sonoff" | "demasled")[]; demasledMaxPages?: number } = {}
  try {
    body = await request.json()
  } catch {
    // ok — no body, use defaults
  }

  const results = await runScrapers({
    sources: body.sources,
    demasledMaxPages: body.demasledMaxPages,
    asAdmin: fromCron,
  })

  return NextResponse.json({ results, source: fromCron ? "cron" : "manual" })
}

// Vercel Cron Jobs send GET requests. Mirror the POST behavior.
export async function GET(request: NextRequest) {
  return POST(request)
}
