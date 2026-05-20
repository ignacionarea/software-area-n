export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) return false
  return allowed.includes(email.toLowerCase())
}
