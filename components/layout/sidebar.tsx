"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  List,
  FilePenLine,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { signOut } from "@/app/login/actions"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: number
  matchPrefix?: string
}

type Props = {
  user: { email: string; name: string | null; initials: string }
  counts: { cotizaciones: number; productos: number; clientes: number; ppd: number }
}

export function Sidebar({ user, counts }: Props) {
  const pathname = usePathname()

  const operationItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ppd", label: "PPD", icon: Lightbulb, badge: counts.ppd, matchPrefix: "/ppd" },
    { href: "/cotizaciones", label: "Cotizaciones", icon: List, badge: counts.cotizaciones, matchPrefix: "/cotizaciones" },
    { href: "/editor", label: "Nueva cotización", icon: FilePenLine, matchPrefix: "/editor" },
    { href: "/productos", label: "Productos", icon: Package, badge: counts.productos },
    { href: "/clientes", label: "Clientes", icon: Users, badge: counts.clientes },
  ]

  const lowerItems: NavItem[] = [
    { href: "/configuracion", label: "Configuración", icon: Settings },
  ]

  const isActive = (item: NavItem) =>
    item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href

  return (
    <aside className="w-[232px] bg-sidebar border-r border-sidebar-border flex flex-col p-[14px] gap-[18px]">
      <div className="flex items-center gap-2.5 pb-3.5 px-1.5 border-b border-sidebar-border">
        <Image src="/logo.png" alt="Area N" width={28} height={28} className="rounded-full" />
        <div className="leading-tight">
          <div className="font-semibold tracking-tight text-sm">Area N</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Cotizador · v0.1
          </div>
        </div>
      </div>

      <NavSection label="Operación">
        {operationItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item)} />
        ))}
      </NavSection>

      <NavSection label="Ajustes">
        {lowerItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item)} />
        ))}
      </NavSection>

      <div className="mt-auto pt-3 border-t border-sidebar-border flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground grid place-items-center font-mono text-[11px] font-semibold">
            {user.initials}
          </div>
          <div className="text-xs leading-tight min-w-0 flex-1">
            <div className="truncate">{user.name ?? "Area N · Admin"}</div>
            <div className="font-mono text-[10px] text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut size={14} />
            <span>Cerrar sesión</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-1.5">
        {label}
      </div>
      {children}
    </div>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors border border-transparent relative",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3.5 bg-primary rounded-sm -ml-0.5" />
      )}
      <Icon size={15} className="shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground">{item.badge}</span>
      )}
    </Link>
  )
}
