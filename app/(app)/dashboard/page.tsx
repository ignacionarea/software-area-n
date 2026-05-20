import { ArrowDown, ArrowUp, FilePlus } from "lucide-react"
import Link from "next/link"
import { Topbar } from "@/components/layout/topbar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { formatARS, formatUSD, formatCotizacionNumero, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

// Parse YYYY-MM directly from the string — avoids the UTC vs local TZ trap.
function parseYearMonth(iso: string | null): { year: number; month: number } | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1 }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const now = new Date()
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`

  // Dashboard view (already aggregated by month)
  const { data: dashboardRows } = await supabase
    .from("v_dashboard_mensual")
    .select("*")
    .order("mes", { ascending: false })
    .limit(7)

  const currentMonth = dashboardRows?.find((r) => {
    const ym = parseYearMonth(r.mes)
    return ym?.year === now.getFullYear() && ym?.month === now.getMonth()
  })

  const plataMovida = currentMonth?.plata_movida_ars ?? 0
  const ganancia = currentMonth?.ganancia_ars ?? 0
  const enviadas = (currentMonth?.enviadas ?? 0) + (currentMonth?.aceptadas ?? 0) + (currentMonth?.rechazadas ?? 0) + (currentMonth?.vencidas ?? 0)
  const aceptadas = currentMonth?.aceptadas ?? 0
  const rechazadas = currentMonth?.rechazadas ?? 0
  const vencidas = currentMonth?.vencidas ?? 0
  const conversionRate = currentMonth?.conversion_rate_pct ?? 0

  // Recent cotizaciones
  const { data: recientes } = await supabase
    .from("v_cotizaciones_resumen")
    .select("*")
    .order("fecha_emision", { ascending: false })
    .limit(5)

  const hasData = (recientes?.length ?? 0) > 0

  return (
    <>
      <Topbar
        crumbs={["Area N"]}
        title="Dashboard"
        dolar={dolar}
        right={
          <Button asChild>
            <Link href="/editor">
              <FilePlus size={14} className="mr-1.5" />
              Nueva cotización
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="flex items-baseline gap-4 mb-4">
          <h2 className="text-base font-medium">Resumen</h2>
          <span className="font-mono text-xs text-muted-foreground">{monthLabel}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Plata movida"
            value={formatARS(plataMovida)}
            sub={`${formatUSD(plataMovida / (dolar.venta || 1))}`}
          />
          <Kpi
            label="Ganancia Area N"
            value={formatARS(ganancia)}
            sub="mano de obra + 10% comisión"
          />
          <Kpi
            label="Cotizaciones enviadas"
            value={String(enviadas)}
            sub={`${aceptadas} aceptadas · ${rechazadas} rechazadas`}
          />
          <Kpi
            label="Tasa de aceptación"
            value={`${conversionRate}%`}
            sub={`${aceptadas} de ${enviadas || 0}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mt-5">
          <div className="border border-border rounded-lg bg-card">
            <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Plata movida — últimos 7 meses</span>
              <span className="text-xs text-muted-foreground">ARS · acumulado mensual</span>
            </div>
            <div className="p-4">
              {dashboardRows && dashboardRows.length > 0 ? (
                <MonthlyChart rows={[...dashboardRows].reverse()} />
              ) : (
                <EmptyHint title="Sin datos todavía" body="Cuando aceptes tu primera cotización vas a ver el detalle mensual acá." />
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card">
            <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Embudo de conversión</span>
              <span className="text-xs text-muted-foreground">{monthLabel}</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <FunnelRow label="Enviadas" val={enviadas} max={enviadas} />
              <FunnelRow label="Aceptadas" val={aceptadas} max={enviadas} />
              <FunnelRow label="Rechazadas" val={rechazadas} max={enviadas} />
              <FunnelRow label="Vencidas" val={vencidas} max={enviadas} />
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-4 mt-7 mb-3">
          <h2 className="text-base font-medium">Cotizaciones recientes</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {hasData ? `${recientes!.length} mostradas` : "ninguna todavía"}
          </span>
          <div className="flex-1" />
          {hasData && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/cotizaciones">Ver todas</Link>
            </Button>
          )}
        </div>

        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {hasData ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-muted-foreground text-xs">
                  <th className="text-left font-medium px-4 py-2.5 w-28">N°</th>
                  <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                  <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                  <th className="text-left font-medium px-4 py-2.5">Items</th>
                  <th className="text-left font-medium px-4 py-2.5">Estado</th>
                  <th className="text-right font-medium px-4 py-2.5">Total ARS</th>
                  <th className="text-right font-medium px-4 py-2.5">Total USD</th>
                </tr>
              </thead>
              <tbody>
                {recientes!.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {c.numero ? formatCotizacionNumero(c.numero) : "—"}
                    </td>
                    <td className="px-4 py-2.5">{c.cliente_nombre ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {c.fecha_emision ? formatDate(c.fecha_emision) : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.cantidad_items ?? 0}</td>
                    <td className="px-4 py-2.5"><EstadoChip estado={c.estado ?? "borrador"} /></td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatARS(c.total_ars ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {formatUSD(c.total_usd ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">Todavía no creaste ninguna cotización.</p>
              <Button asChild>
                <Link href="/editor">
                  <FilePlus size={14} className="mr-1.5" />
                  Crear la primera
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, sub, delta, down }: { label: string; value: string; sub?: string; delta?: string; down?: boolean }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card flex flex-col gap-1.5 min-h-[110px]">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      {delta && (
        <div className="mt-auto pt-1 flex items-center gap-1 font-mono text-[11px]">
          <span className={cn("inline-flex items-center gap-0.5", down ? "text-destructive" : "text-primary")}>
            {down ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
            {delta}
          </span>
        </div>
      )}
    </div>
  )
}

function FunnelRow({ label, val, max }: { label: string; val: number; max: number }) {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-muted-foreground">{label}</div>
      <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden relative">
        <div
          className="h-full bg-primary/80 transition-all"
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono">
          {pct}%
        </span>
      </div>
      <div className="w-8 text-right font-mono text-sm">{val}</div>
    </div>
  )
}

function MonthlyChart({ rows }: { rows: { mes: string | null; plata_movida_ars: number | null; ganancia_ars: number | null }[] }) {
  const max = Math.max(...rows.map((r) => r.plata_movida_ars ?? 0), 1)
  return (
    <div className="flex items-end gap-3 h-[180px]">
      {rows.map((m, i) => {
        const plata = m.plata_movida_ars ?? 0
        const ganancia = m.ganancia_ars ?? 0
        const h = (plata / max) * 160
        const hG = plata > 0 ? (ganancia / plata) * h : 0
        const isCurrent = i === rows.length - 1
        const ym = parseYearMonth(m.mes)
        const lbl = ym ? MONTH_NAMES[ym.month].slice(0, 3) : "—"
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex flex-col w-full max-w-[40px] rounded-t overflow-hidden">
              <div
                style={{ height: Math.max(h - hG, 0), opacity: isCurrent ? 1 : 0.7 }}
                className="bg-primary/20 border border-primary/50"
              />
              <div
                style={{ height: hG, opacity: isCurrent ? 1 : 0.85 }}
                className="bg-primary"
              />
            </div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">{lbl}</div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-xs text-muted-foreground">{body}</div>
    </div>
  )
}

function EstadoChip({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    borrador: "bg-muted text-muted-foreground border-border",
    enviada: "bg-[color:var(--arean-info)]/15 text-[color:var(--arean-info)] border-[color:var(--arean-info)]/30",
    aceptada: "bg-primary/15 text-primary border-primary/30",
    rechazada: "bg-destructive/15 text-destructive border-destructive/30",
    vencida: "bg-[color:var(--arean-warn)]/15 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30",
  }
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border", styles[estado] ?? styles.borrador)}>
      {estado}
    </span>
  )
}
