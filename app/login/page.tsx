import Image from "next/image"
import { Check } from "lucide-react"
import { signInWithGoogle } from "./actions"
import { Button } from "@/components/ui/button"

const FEATURES = [
  "Catálogo sincronizado de Sonoff AR + Demasled, todos los días",
  "Conversión ARS / USD en vivo al dólar oficial",
  "Numeración correlativa, estados, mini-CRM de clientes",
  "PDF descargable con tu identidad de marca",
]

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "Esta cuenta de Google no tiene acceso al cotizador.",
  oauth_init_failed: "No se pudo iniciar el login con Google. Probá de nuevo.",
  auth_failed: "Falló la autenticación. Probá de nuevo.",
  missing_code: "Falta el código de autorización.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] ?? "Algo salió mal." : null

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
      <div className="flex items-center justify-center p-8">
        <form
          action={signInWithGoogle}
          className="w-full max-w-sm flex flex-col gap-6"
        >
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <Image src="/logo.png" alt="Area N" width={32} height={32} className="rounded-full" />
            <div className="font-semibold">Area N</div>
          </div>

          <div>
            <h2 className="text-2xl font-medium tracking-tight">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Entrá con tu cuenta de Google del equipo Area N.
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {errorMsg}
            </div>
          )}

          <Button type="submit" size="lg" className="gap-2 h-11">
            <GoogleIcon />
            Continuar con Google
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Por ahora el acceso es solo para el dueño. Pronto: empleados.
          </p>
        </form>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
