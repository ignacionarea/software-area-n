import "server-only"
import { Resend } from "resend"

let cached: Resend | null = null

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (cached) return cached
  cached = new Resend(process.env.RESEND_API_KEY)
  return cached
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "Area N <onboarding@resend.dev>"
}

export function getBccEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? ""
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}
