"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function signInWithGoogle() {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get("origin") ?? headersList.get("host")
  const proto = headersList.get("x-forwarded-proto") ?? "http"
  const base = origin?.startsWith("http") ? origin : `${proto}://${origin}`

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
