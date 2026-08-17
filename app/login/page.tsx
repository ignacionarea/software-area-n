import Image from "next/image"
import { Check, MailCheck, AlertCircle } from "lucide-react"
import { LoginTabs } from "./login-tabs"

const FEATURES = [
  "Catálogo sincronizado de Sonoff AR + Demasled, todos los días",
  "Conversión ARS / USD en vivo al dólar oficial",
  "Numeración correlativa, estados, mini-CRM de clientes",
  "PDF descargable con tu identidad de marca",
]

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "Esta cuenta de correo no tiene acceso autorizado al cotizador.",
  oauth_init_failed: "No se pudo iniciar el acceso con Google. Podés ingresar escribiendo tu correo arriba.",
  auth_failed: "Falló la autenticación o el enlace expiró. Por favor probá de nuevo.",
  missing_code: "Falta el código de autorización.",
  missing_email: "Por favor escribí tu dirección de correo.",
  missing_credentials: "Por favor completá tu correo y tu contraseña.",
  invalid_credentials: "Correo o contraseña incorrectos. Si no tenés contraseña creada, usá la opción 'Enlace por correo'.",
  otp_failed: "No se pudo enviar el enlace al correo. Verificá que la dirección sea válida.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; email?: string; detail?: string }>
}) {
  const params = await searchParams
  const errorMsg = params.error
    ? ERROR_MESSAGES[params.error] ?? (params.detail ? decodeURIComponent(params.detail) : "Ocurrió un error al ingresar.")
    : null
  const isSent = params.sent === "true"
  const sentEmail = params.email ? decodeURIComponent(params.email) : null

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Area N"
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Area N</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Cotizador interno · v0.1
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 max-w-md">
          <h1 className="text-3xl font-medium leading-tight tracking-tight">
            Cotizá <em className="text-primary not-italic font-medium">proyectos de domótica</em>,
            mandá PDFs prolijos y olvidate de la planilla de cálculo.
          </h1>
          <div className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Check size={14} className="text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Built in Argentina</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
          <span>Supabase + Next.js 16</span>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <Image src="/logo.png" alt="Area N" width={32} height={32} className="rounded-full" />
            <div className="font-semibold">Area N</div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Acceso al Cotizador</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Ingresá con tu correo electrónico o tu cuenta del equipo Area N.
            </p>
          </div>

          {/* Success Banner */}
          {isSent && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 text-sm flex items-start gap-3">
              <MailCheck size={20} className="shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">¡Enlace de acceso enviado!</span>
                <span className="text-xs leading-relaxed text-foreground/80">
                  Enviamos un enlace seguro a <strong className="text-foreground">{sentEmail ?? "tu correo"}</strong>. Hacé clic en el botón del correo para entrar directamente.
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-3.5 text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMsg}</div>
            </div>
          )}

          <LoginTabs />

          <p className="text-xs text-muted-foreground text-center">
            Acceso seguro para el equipo de Area N domótica.
          </p>
        </div>
      </div>
    </div>
  )
}

