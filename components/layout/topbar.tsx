import { formatNumber } from "@/lib/format"
import { ThemeToggle } from "@/components/layout/theme-toggle"

type Props = {
  crumbs: string[]
  title: string
  dolar: { venta: number; updatedAt: string | null; fallback: boolean }
  right?: React.ReactNode
}

export function Topbar({ crumbs, title, dolar, right }: Props) {
  const updated = dolar.updatedAt
    ? new Date(dolar.updatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background">
      <div className="flex flex-col leading-tight gap-0.5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {crumbs.join(" / ")}
        </div>
        <div className="text-lg font-medium tracking-tight">{title}</div>
      </div>

      <div className="flex-1" />

      <div
        title={dolar.fallback ? "No se pudo conectar a dolarapi.com — usando valor de respaldo" : "Dólar oficial venta — dolarapi.com"}
        className="flex items-center gap-2 font-mono text-xs px-2.5 py-1.5 rounded-md border border-border bg-card"
      >
        <span
          className={
            "w-1.5 h-1.5 rounded-full " +
            (dolar.fallback ? "bg-[color:var(--arean-warn)]" : "bg-primary")
          }
        />
        <span>USD/ARS · {formatNumber(dolar.venta, 2)}</span>
        {updated && <span className="text-muted-foreground">· upd {updated}</span>}
      </div>

      <ThemeToggle />

      {right}
    </div>
  )
}
