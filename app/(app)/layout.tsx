import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [cotCount, prodCount, cliCount, ppdCount] = await Promise.all([
    supabase.from("cotizaciones").select("id", { count: "exact", head: true }),
    supabase.from("productos").select("id", { count: "exact", head: true }),
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase
      .from("ppd_proyectos")
      .select("id", { count: "exact", head: true })
      .neq("estado", "convertido"),
  ])

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null

  const initials = (() => {
    const source = name ?? user.email ?? "?"
    return source
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "AN"
  })()

  return (
    <div className="grid grid-cols-[232px_1fr] h-screen bg-background">
      <Sidebar
        user={{ email: user.email ?? "", name, initials }}
        counts={{
          cotizaciones: cotCount.count ?? 0,
          productos: prodCount.count ?? 0,
          clientes: cliCount.count ?? 0,
          ppd: ppdCount.count ?? 0,
        }}
      />
      <main className="flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}
