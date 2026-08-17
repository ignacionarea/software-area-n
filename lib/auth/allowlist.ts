export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const envRaw = (process.env.ALLOWED_EMAILS ?? "").trim()
  if (!envRaw || envRaw === "*") {
    // If not configured, allow any authenticated user in Supabase
    return true
  }
  const allowed = envRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) return true
  return allowed.includes(email.toLowerCase())
}
