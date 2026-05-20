"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    // placeholder during SSR to avoid hydration mismatch
    return (
      <div
        aria-hidden
        className="w-8 h-8 grid place-items-center rounded-md border border-border bg-card text-muted-foreground"
      >
        <Sun size={14} className="opacity-0" />
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="w-8 h-8 grid place-items-center rounded-md border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
