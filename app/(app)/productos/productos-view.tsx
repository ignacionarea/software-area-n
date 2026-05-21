"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, RefreshCw, ExternalLink, Package, Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatARS, formatUSD } from "@/lib/format"
import { ManualProductDialog } from "./manual-product-dialog"
import { deleteManualProducto } from "./actions"
import type { Database } from "@/types/database"

type Producto = Database["public"]["Tables"]["productos"]["Row"]
type Source = Database["public"]["Tables"]["scrape_sources"]["Row"]

const MANUAL_MARCA = "manual"

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca"
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "recién"
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const dy = Math.floor(hr / 24)
  return `hace ${dy} d`
}

function marcaLabel(marca: string, sources: Source[]): string {
  if (marca === MANUAL_MARCA) return "Manual"
  return sources.find((s) => s.slug === marca)?.nombre ?? marca
}

export function ProductosView({
  productos,
  sources,
  lastUpdate,
  dolarVenta,
}: {
  productos: Producto[]
  sources: Source[]
  lastUpdate: string | null
  dolarVenta: number
}) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [marca, setMarca] = useState<string>("todos")
  const [incluirDescontinuados, setIncluirDescontinuados] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [manualDialog, setManualDialog] = useState<{ open: boolean; editing: Producto | null }>({
    open: false,
    editing: null,
  })
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    let list = productos
    if (!incluirDescontinuados) list = list.filter((p) => p.activo)
    if (marca !== "todos") list = list.filter((p) => p.marca === marca)
    if (q) {
      const qq = q.toLowerCase()
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(qq) ||
          (p.sku ?? "").toLowerCase().includes(qq) ||
          (p.categoria ?? "").toLowerCase().includes(qq)
      )
    }
    return list
  }, [productos, marca, q, incluirDescontinuados])

  const counts = useMemo(() => {
    const base = incluirDescontinuados ? productos : productos.filter((p) => p.activo)
    const perMarca: Record<string, number> = {}
    for (const p of base) perMarca[p.marca] = (perMarca[p.marca] ?? 0) + 1
    return {
      total: base.length,
      perMarca,
      descontinuados: productos.filter((p) => !p.activo).length,
      manual: productos.filter((p) => p.marca === MANUAL_MARCA).length,
    }
  }, [productos, incluirDescontinuados])

  const filteredActivos = filtered.filter((p) => p.activo && p.precio_origen > 0)
  const promedio =
    filteredActivos.length > 0
      ? filteredActivos.reduce((s, p) => s + Number(p.precio_origen), 0) / filteredActivos.length
      : 0

  const activeSources = sources.filter((s) => s.activo)

  async function refresh() {
    if (activeSources.length === 0) {
      toast.error("No hay fuentes de scraping activas", {
        description: "Agregá fuentes desde Configuración → Scraping.",
      })
      return
    }
    setRefreshing(true)
    const sourcesNames = activeSources.map((s) => s.nombre).join(" + ")
    const t = toast.loading(`Sincronizando con ${sourcesNames}…`, {
      description: "Puede tardar entre 30 segundos y 2 minutos.",
    })
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: {
        results: Array<{ marca: string; ok: boolean; scraped: number; inserted: number; updated: number; errors: string[]; durationMs: number }>
      } = await res.json()

      const summary = data.results
        .map((r) =>
          r.ok
            ? `${marcaLabel(r.marca, sources)}: ${r.scraped} (${r.inserted} nuevos, ${r.updated} actualizados)`
            : `${r.marca}: ❌ ${r.errors[0] ?? "error"}`
        )
        .join(" · ")

      const anyError = data.results.some((r) => !r.ok)
      toast.dismiss(t)
      if (anyError) toast.error("Sincronización con errores", { description: summary })
      else toast.success("Catálogo actualizado", { description: summary })

      startTransition(() => router.refresh())
    } catch (e) {
      toast.dismiss(t)
      toast.error("No se pudo sincronizar", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-medium">Catálogo</h2>
        <span className="font-mono text-xs text-muted-foreground">
          última sincronización · {timeAgo(lastUpdate)}
        </span>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setManualDialog({ open: true, editing: null })}>
          <Plus size={14} className="mr-1.5" />
          Agregar manual
        </Button>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={14} className={cn("mr-1.5", refreshing && "animate-spin")} />
          {refreshing ? "Sincronizando…" : "Sincronizar"}
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-card flex-1 max-w-md">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, SKU o categoría…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={marca === "todos"} onClick={() => setMarca("todos")} label={`Todos · ${counts.total}`} />
          {sources.map((s) => (
            <FilterChip
              key={s.slug}
              active={marca === s.slug}
              onClick={() => setMarca(s.slug)}
              label={`${s.nombre} · ${counts.perMarca[s.slug] ?? 0}`}
            />
          ))}
          {counts.manual > 0 && (
            <FilterChip
              active={marca === MANUAL_MARCA}
              onClick={() => setMarca(MANUAL_MARCA)}
              label={`Manual · ${counts.manual}`}
            />
          )}
        </div>
        {counts.descontinuados > 0 && (
          <FilterChip
            active={incluirDescontinuados}
            onClick={() => setIncluirDescontinuados((v) => !v)}
            label={`Incluir descontinuados · ${counts.descontinuados}`}
          />
        )}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
        {filtered.length} productos
        {filtered.length > 0 && ` · precio promedio ${formatARS(promedio)}`}
      </div>

      {productos.length === 0 ? (
        <EmptyState
          refreshing={refreshing}
          onRefresh={refresh}
          onManual={() => setManualDialog({ open: true, editing: null })}
          sources={sources}
        />
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Ningún producto coincide con esos filtros.
        </div>
      ) : (
        <ProductosTable
          productos={filtered}
          sources={sources}
          dolarVenta={dolarVenta}
          onEdit={(p) => setManualDialog({ open: true, editing: p })}
          onDeleted={() => router.refresh()}
        />
      )}

      <ManualProductDialog
        open={manualDialog.open}
        editing={manualDialog.editing}
        onClose={() => setManualDialog({ open: false, editing: null })}
        onSaved={() => {
          setManualDialog({ open: false, editing: null })
          router.refresh()
        }}
      />
    </>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 px-3 rounded-md border text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-card text-muted-foreground border-border hover:bg-secondary"
      )}
    >
      {label}
    </button>
  )
}

function ProductosTable({
  productos,
  sources,
  dolarVenta,
  onEdit,
  onDeleted,
}: {
  productos: Producto[]
  sources: Source[]
  dolarVenta: number
  onEdit: (p: Producto) => void
  onDeleted: () => void
}) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/50 text-muted-foreground text-xs">
            <th className="text-left font-medium px-4 py-2.5">SKU</th>
            <th className="text-left font-medium px-4 py-2.5">Producto</th>
            <th className="text-left font-medium px-4 py-2.5">Categoría</th>
            <th className="text-left font-medium px-4 py-2.5">Marca</th>
            <th className="text-right font-medium px-4 py-2.5">Precio ARS</th>
            <th className="text-right font-medium px-4 py-2.5">Precio USD</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <Row
              key={p.id}
              p={p}
              sources={sources}
              dolarVenta={dolarVenta}
              onEdit={() => onEdit(p)}
              onDeleted={onDeleted}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  p,
  sources,
  dolarVenta,
  onEdit,
  onDeleted,
}: {
  p: Producto
  sources: Source[]
  dolarVenta: number
  onEdit: () => void
  onDeleted: () => void
}) {
  const [pending, start] = useTransition()
  const ars = Number(p.precio_origen)
  const usd = ars > 0 ? ars / (dolarVenta || 1) : 0
  const tieneprecio = p.activo && ars > 0

  function handleDelete() {
    if (!confirm(`¿Eliminar el producto "${p.nombre}"? (solo se permite con productos manuales)`)) return
    start(async () => {
      const r = await deleteManualProducto(p.id)
      if (r.ok) {
        toast.success("Producto eliminado")
        onDeleted()
      } else {
        toast.error("No se pudo eliminar", { description: r.error })
      }
    })
  }

  return (
    <tr className={cn("border-t border-border hover:bg-secondary/30", !p.activo && "opacity-60", pending && "opacity-50")}>
      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{p.sku ?? "—"}</td>
      <td className="px-4 py-2.5">
        <div className="font-medium flex items-center gap-2 flex-wrap">
          <span>{p.nombre}</span>
          {Array.isArray(p.variantes) && p.variantes.length > 0 && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-primary/40 bg-primary/10 text-primary"
              title={p.variantes
                .map((v) => Object.values((v as { opciones?: Record<string, string> }).opciones ?? {}).join(" · "))
                .filter(Boolean)
                .join(" · ")}
            >
              {p.variantes.length} variantes
            </span>
          )}
          {!p.activo && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-[color:var(--arean-warn)]/40 bg-[color:var(--arean-warn)]/10 text-[color:var(--arean-warn)]">
              Descontinuado
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{p.categoria ?? "—"}</td>
      <td className="px-4 py-2.5">
        <MarcaBadge marca={p.marca} sources={sources} />
      </td>
      <td className="px-4 py-2.5 text-right font-mono">
        {tieneprecio ? formatARS(ars) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
        {tieneprecio ? formatUSD(usd) : "—"}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="inline-flex items-center gap-1">
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver en sitio del proveedor"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <ExternalLink size={13} />
            </a>
          )}
          {p.es_manual && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Acciones (solo manuales)"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil size={13} className="mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} variant="destructive">
                  <Trash2 size={13} className="mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </td>
    </tr>
  )
}

function MarcaBadge({ marca, sources }: { marca: string; sources: Source[] }) {
  const isManual = marca === MANUAL_MARCA
  const source = sources.find((s) => s.slug === marca)
  const label = isManual ? "Manual" : (source?.nombre ?? marca)
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
        isManual
          ? "bg-[color:var(--arean-warn)]/10 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30"
          : "bg-primary/10 text-primary border-primary/30"
      )}
    >
      {label}
    </span>
  )
}

function EmptyState({
  refreshing,
  onRefresh,
  onManual,
  sources,
}: {
  refreshing: boolean
  onRefresh: () => void
  onManual: () => void
  sources: Source[]
}) {
  const activeSources = sources.filter((s) => s.activo)
  return (
    <div className="border border-border rounded-lg bg-card px-6 py-16 text-center">
      <Package size={40} className="mx-auto text-muted-foreground/40 mb-4" />
      <h3 className="text-base font-medium mb-2">El catálogo está vacío</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        {activeSources.length > 0 ? (
          <>
            Sincronizá ahora con <strong>{activeSources.map((s) => s.nombre).join(", ")}</strong>, o agregá productos manualmente.
          </>
        ) : (
          <>
            No tenés fuentes de scraping activas. Agregá una desde <strong>Configuración → Scraping</strong> o
            sumá productos manuales.
          </>
        )}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" onClick={onManual}>
          <Plus size={14} className="mr-1.5" />
          Agregar manual
        </Button>
        {activeSources.length > 0 && (
          <Button onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={cn("mr-1.5", refreshing && "animate-spin")} />
            {refreshing ? "Sincronizando…" : "Sincronizar ahora"}
          </Button>
        )}
      </div>
    </div>
  )
}
