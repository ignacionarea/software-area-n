"use client"

import { useState } from "react"
import { Mail, Lock, Sparkles, ArrowRight } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { signInWithGoogle, signInWithEmailOtp, signInWithPassword } from "./actions"

export function LoginTabs() {
  const [activeTab, setActiveTab] = useState<string>("magic-link")
  const [emailValue, setEmailValue] = useState("")

  return (
    <div className="w-full flex flex-col gap-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-10 p-1 bg-muted/60">
          <TabsTrigger value="magic-link" className="text-xs sm:text-sm font-medium gap-1.5">
            <Mail size={15} />
            <span>Enlace por correo</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="text-xs sm:text-sm font-medium gap-1.5">
            <Lock size={15} />
            <span>Contraseña</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Magic Link / OTP */}
        <TabsContent value="magic-link" className="mt-4">
          <form action={signInWithEmailOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-otp" className="text-sm font-medium">
                Correo electrónico
              </Label>
              <div className="relative">
                <Input
                  id="email-otp"
                  name="email"
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="tu@arean.com"
                  autoComplete="email"
                  required
                  className="h-11 pl-10"
                />
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Te enviaremos un enlace de acceso seguro a tu correo para ingresar sin contraseña.
              </p>
            </div>

            <Button type="submit" size="lg" className="h-11 gap-2 font-medium w-full mt-1">
              <span>Enviar enlace de acceso</span>
              <ArrowRight size={16} />
            </Button>
          </form>
        </TabsContent>

        {/* Tab 2: Password */}
        <TabsContent value="password" className="mt-4">
          <form action={signInWithPassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-pwd" className="text-sm font-medium">
                Correo electrónico
              </Label>
              <div className="relative">
                <Input
                  id="email-pwd"
                  name="email"
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="tu@arean.com"
                  autoComplete="email"
                  required
                  className="h-11 pl-10"
                />
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password-field" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password-field"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="h-11 pl-10"
                />
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="h-11 gap-2 font-medium w-full mt-1">
              <span>Iniciar sesión</span>
              <ArrowRight size={16} />
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {/* Divider */}
      <div className="relative flex items-center justify-center my-1">
        <Separator className="w-full" />
        <span className="absolute bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
          O ingresar con
        </span>
      </div>

      {/* Google OAuth Button */}
      <form action={signInWithGoogle} className="w-full">
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full h-11 gap-2.5 font-medium border-border/80 hover:bg-muted/50"
        >
          <GoogleIcon />
          <span>Continuar con Google</span>
        </Button>
      </form>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
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
