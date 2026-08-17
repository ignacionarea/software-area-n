"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isEmailAllowed } from "@/lib/auth/allowlist"

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

export async function signInWithEmailOtp(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim()

  if (!email) {
    redirect("/login?error=missing_email")
  }

  if (!isEmailAllowed(email)) {
    redirect("/login?error=not_allowed")
  }

  const supabase = await createClient()
  const base = await getBaseUrl()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${base}/auth/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    redirect(`/login?error=otp_failed&detail=${encodeURIComponent(error.message)}`)
  }

  redirect(`/login?sent=true&email=${encodeURIComponent(email)}`)
}

export async function signInWithPassword(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim()
  const password = formData.get("password") as string | null

  if (!email || !password) {
    redirect("/login?error=missing_credentials")
  }

  if (!isEmailAllowed(email)) {
    redirect("/login?error=not_allowed")
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?error=invalid_credentials`)
  }

  if (!isEmailAllowed(data.user?.email)) {
    await supabase.auth.signOut()
    redirect("/login?error=not_allowed")
  }

  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

