"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

async function getBaseUrl(): Promise<string> {
  // Prefer NEXT_PUBLIC_SITE_URL when set (recommended in production).
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")

  const h = await headers()
  // Host header is always present; on Vercel it's the deployment domain.
  const host = h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const base = await getBaseUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/login?error=oauth_init_failed`)
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
