"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Search, ArrowUp, ArrowDown, MoreHorizontal, Pencil, Copy, Trash2, FilePlus, ChevronDown, Download, Mail,
} from "lucide-react"
import { downloadCotizacionPdf } from "@/components/pdf/download"
import { SendCotizacionDialog } from "@/components/email/send-cotizacion-dialog"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatARS, formatUSD, formatDate, formatCotizacionNumero } from "@/lib/format"
import { changeEstado, duplicateCotizacion, deleteCotizacion, getPdfPayload } from "./actions"
import type { Database } from "@/types/database"

type Resumen = Database["public"]["Views"]["v_cotizaciones_resumen"]["Row"]
type Estado = Database["public"]["Enums"]["estado_cotizacion"]

const ESTADOS: { value: Estado; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "vencida", label: "Vencida" },
]

type SortKey = "numero" | "cliente" | "fecha" | "total" | "estado"
type SortDir = "asc" | "desc"

type Configuracion = { razon_social: string; email: string | null; telefono: string | null }

export function CotizacionesView({
  cotizaciones,
  configuracion,
}: {
  cotizaciones: Resumen[]
  configuracion: Configuracion
}) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"todas" | Estado>("todas")
  const [sort, setSort] = useState<{ k: SortKey; dir: SortDir }>({ k: "numero", dir: "desc" })
  const [sendingFor, setSendingFor] = useState<Resumen | null>(null)

  const counts = useMemo(() => {
    const base = { todas: cotizaciones.length } as Record<"todas" | Estado, number>
    for (const e of ESTADOS) base[e.value] = 0
    for (const c of cotizaciones) {
      if (c.estado) base[c.estado] = (base[c.estado] ?? 0) + 1
    }
    return base
  }, [cotizaciones])

  const filtered = useMemo(() => {
    let list = cotizaciones
    if (filter !== "todas") list = list.filter((c) => c.estado === filter)
    if (q) {
      const qq = q.toLowerCase()
      list = list.filter(
        (c) =>
          formatCotizacionNumero(c.numero ?? 0).toLowerCase().includes(qq) ||
          (c.cliente_nombre ?? "").toLowerCase().includes(qq) ||
          (c.cliente_email ?? "").toLowerCase().includes(qq)
      )
    }
    list = [...list].sort((a, b) => {
      let av: string | number, bv: string | number
      if (sort.k === "numero") {
        av = a.numero ?? 0; bv = b.numero ?? 0
      } else if (sort.k === "cliente") {
        av = (a.cliente_nombre ?? "").toLowerCase(); bv = (b.cliente_nombre ?? "").toLowerCase()
      } else if (sort.k === "fecha") {
        av = a.fecha_emision ?? ""; bv = b.fecha_emision ?? ""
      } else if (sort.k === "total") {
        av = a.total_ars ?? 0; bv = b.total_ars ?? 0
      } else {
        av = a.estado ?? ""; bv = b.estado ?? ""
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1
      if (av > bv) return sort.dir === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [cotizaciones, filter, q, sort])

  const totalFiltrado = filtered.reduce((s, c) => s + (c.total_ars ?? 0), 0)

  function sortBy(k: SortKey) {
    setSort((s) => (s.k === k ? { k, dir: s.dir === "asc" ? "desc" : "asc" } : { k, dir: "desc" }))
  }

  return (
    <>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-medium">Todas las cotizaciones</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} resultados · {formatARS(totalFiltrado)}
        </span>
        <div className="flex-1" />
        <Button asChild>
          <Link href="/editor">
            <FilePlus size={14} className="mr-1.5" />
            Nueva cotización
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-card flex-1 max-w-md">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por N°, cliente o email…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={filter === "todas"} onClick={() => setFilter("todas")} label="Todas" count={counts.todas} />
          {ESTADOS.map((e) => (
            <FilterChip
              key={e.value}
              active={filter === e.value}
              onClick={() => setFilter(e.value)}
              label={e.label}
              count={counts[e.value]}
            />
          ))}
        </div>
      </div>

      {cotizaciones.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-16 text-center">
          <h3 className="text-base font-medium mb-2">Sin cotizaciones todavía</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Cuando armes tu primera cotización aparecerá acá.
          </p>
          <Button asChild>
            <Link href="/editor">
              <FilePlus size={14} className="mr-1.5" />
              Crear la primera
            </Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Ninguna cotización coincide con esos filtros.
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-muted-foreground text-xs">
                <Th onClick={() => sortBy("numero")} active={sort.k === "numero"} dir={sort.dir}>N°</Th>
                <Th onClick={() => sortBy("cliente")} active={sort.k === "cliente"} dir={sort.dir}>Cliente</Th>
                <Th onClick={() => sortBy("fecha")} active={sort.k === "fecha"} dir={sort.dir}>Fecha · validez</Th>
                <th className="text-left font-medium px-4 py-2.5">Items</th>
                <Th onClick={() => sortBy("estado")} active={sort.k === "estado"} dir={sort.dir}>Estado</Th>
                <Th onClick={() => sortBy("total")} active={sort.k === "total"} dir={sort.dir} align="right">Total ARS</Th>
                <th className="text-right font-medium px-4 py-2.5">Total USD</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <Row
                  key={c.id ?? Math.random()}
                  c={c}
                  onRefresh={() => router.refresh()}
                  onSendEmail={() => setSendingFor(c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sendingFor && (
        <SendCotizacionDialog
          open={!!sendingFor}
          onOpenChange={(o) => !o && setSendingFor(null)}
          cotizacionId={sendingFor.id!}
          defaultTo={sendingFor.cliente_email ?? ""}
          clienteNombre={sendingFor.cliente_nombre ?? "Cliente"}
          numeroFormateado={formatCotizacionNumero(sendingFor.numero ?? 0)}
          fechaEmision={sendingFor.fecha_emision ?? new Date().toISOString().slice(0, 10)}
          validezDias={sendingFor.validez_dias ?? 7}
          totalArs={sendingFor.total_ars ?? 0}
          totalUsd={sendingFor.total_usd ?? 0}
          razonSocial={configuracion.razon_social}
          contactoEmail={configuracion.email}
          contactoTel={configuracion.telefono}
          onSent={() => {
            setSendingFor(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function FilterChip({
  active, onClick, label, count,
}: {
  active: boolean; onClick: () => void; label: string; count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-3 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5",
        active
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-card text-muted-foreground border-border hover:bg-secondary"
      )}
    >
      {label}
      <span className={cn("font-mono", active ? "opacity-80" : "opacity-60")}>{count}</span>
    </button>
  )
}

function Th({
  onClick, active, dir, align = "left", children,
}: {
  onClick: () => void; active: boolean; dir: SortDir; align?: "left" | "right"; children: React.ReactNode
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "font-medium px-4 py-2.5 cursor-pointer select-none hover:text-foreground transition-colors",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      <span className={cn("inline-flex items-center gap-1", align === "right" && "justify-end")}>
        {children}
        {active && (dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </th>
  )
}

function Row({ c, onRefresh, onSendEmail }: { c: Resumen; onRefresh: () => void; onSendEmail: () => void }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const fechaVencimiento = useMemo(() => {
    if (!c.fecha_emision || !c.validez_dias) return null
    const d = new Date(c.fecha_emision)
    d.setDate(d.getDate() + c.validez_dias)
    return d
  }, [c.fecha_emision, c.validez_dias])

  function onChangeEstado(estado: Estado) {
    if (!c.id) return
    start(async () => {
      const r = await changeEstado(c.id!, estado)
      if (r.ok) {
        toast.success("Estado actualizado")
        onRefresh()
      } else {
        toast.error("No se pudo actualizar", { description: r.error })
      }
    })
  }

  function onDuplicate() {
    if (!c.id) return
    start(async () => {
      const r = await duplicateCotizacion(c.id!)
      if (r.ok) {
        toast.success("Cotización duplicada")
        router.push(`/editor/${r.data.id}`)
      } else {
        toast.error("No se pudo duplicar", { description: r.error })
      }
    })
  }

  async function onDownloadPdf() {
    if (!c.id) return
    toast.loading("Generando PDF…", { id: "pdf-gen" })
    const r = await getPdfPayload(c.id)
    if (!r.ok) {
      toast.error("No se pudo cargar la cotización", { id: "pdf-gen", description: r.error })
      return
    }
    const p = r.data
    const subtotalProductos = p.items
      .filter((i) => i.tipo === "producto")
      .reduce((s, i) => s + i.cantidad * i.precio_unitario_ars, 0)
    const subtotalManoObra = p.items
      .filter((i) => i.tipo === "mano_obra")
      .reduce((s, i) => s + i.cantidad * i.precio_unitario_ars, 0)
    const total = subtotalProductos + subtotalManoObra
    try {
      await downloadCotizacionPdf({
        numeroFormateado: formatCotizacionNumero(p.numero),
        fechaEmision: p.fecha_emision,
        validezDias: p.validez_dias,
        cotizacionDolar: p.cotizacion_dolar,
        cliente: p.cliente,
        items: p.items,
        subtotalProductos,
        subtotalManoObra,
        total,
        totalUsd: total / (p.cotizacion_dolar || 1),
        configuracion: p.configuracion,
        logoUrl: `${window.location.origin}/logo.png`,
      })
      toast.success("PDF descargado", { id: "pdf-gen" })
    } catch (e) {
      toast.error("No se pudo generar el PDF", {
        id: "pdf-gen",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  function onDelete() {
    if (!c.id) return
    if (!confirm(`¿Eliminar ${formatCotizacionNumero(c.numero ?? 0)}? Esta acción no se puede deshacer.`)) return
    start(async () => {
      const r = await deleteCotizacion(c.id!)
      if (r.ok) {
        toast.success("Cotización eliminada")
        onRefresh()
      } else {
        toast.error("No se pudo eliminar", { description: r.error })
      }
    })
  }

  return (
    <tr className={cn("border-t border-border hover:bg-secondary/30", pending && "opacity-60")}>
      <td className="px-4 py-2.5">
        <Link href={`/editor/${c.id}`} className="font-mono text-xs font-medium hover:text-primary">
          {c.numero ? formatCotizacionNumero(c.numero) : "—"}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <Link href={`/editor/${c.id}`} className="block hover:text-primary">
          <div className="text-sm">{c.cliente_nombre ?? "(sin cliente)"}</div>
          {c.cliente_email && (
            <div className="font-mono text-[10px] text-muted-foreground">{c.cliente_email}</div>
          )}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <div className="font-mono text-xs">{c.fecha_emision ? formatDate(c.fecha_emision) : "—"}</div>
        {fechaVencimiento && (
          <div className="font-mono text-[10px] text-muted-foreground">
            vence {formatDate(fechaVencimiento)}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.cantidad_items ?? 0}</td>
      <td className="px-4 py-2.5">
        <EstadoSelector estado={c.estado ?? "borrador"} onChange={onChangeEstado} disabled={pending} />
      </td>
      <td className="px-4 py-2.5 text-right font-mono">{formatARS(c.total_ars ?? 0)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
        {formatUSD(c.total_usd ?? 0)}
      </td>
      <td className="px-4 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-7 h-7 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Acciones"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/editor/${c.id}`}>
                <Pencil size={13} className="mr-2" />
                Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadPdf}>
              <Download size={13} className="mr-2" />
              Descargar PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!c.cliente_email) {
                  toast.error("El cliente no tiene email cargado", {
                    description: "Editá el cliente desde /clientes y agregale un email.",
                  })
                  return
                }
                onSendEmail()
              }}
            >
              <Mail size={13} className="mr-2" />
              Enviar por mail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy size={13} className="mr-2" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2 size={13} className="mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

const ESTADO_STYLES: Record<Estado, string> = {
  borrador: "bg-muted text-muted-foreground border-border",
  enviada: "bg-[color:var(--arean-info)]/15 text-[color:var(--arean-info)] border-[color:var(--arean-info)]/30",
  aceptada: "bg-primary/15 text-primary border-primary/30",
  rechazada: "bg-destructive/15 text-destructive border-destructive/30",
  vencida: "bg-[color:var(--arean-warn)]/15 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30",
}

function EstadoSelector({
  estado, onChange, disabled,
}: {
  estado: Estado; onChange: (e: Estado) => void; disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-opacity",
            ESTADO_STYLES[estado],
            disabled ? "opacity-50 cursor-wait" : "hover:opacity-80 cursor-pointer"
          )}
        >
          {ESTADOS.find((e) => e.value === estado)?.label ?? estado}
          <ChevronDown size={10} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ESTADOS.map((e) => (
          <DropdownMenuItem key={e.value} onClick={() => e.value !== estado && onChange(e.value)}>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border mr-2",
                ESTADO_STYLES[e.value]
              )}
            >
              {e.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
