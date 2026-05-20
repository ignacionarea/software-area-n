"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, FilePlus, MoreHorizontal, Pencil, Trash2, ArrowRight, Lightbulb } from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { deletePpd, convertirAcotizacion } from "./actions"
import { normalizeSurvey, countApplied } from "./categorias"
import type { Database } from "@/types/database"

type Row = Database["public"]["Tables"]["ppd_proyectos"]["Row"] & {
  clientes: { nombre: string } | null
}
type Estado = Database["public"]["Enums"]["ppd_estado"]

const ESTADOS: { value: Estado; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "convertido", label: "Convertido" },
  { value: "descartado", label: "Descartado" },
]

const ESTADO_STYLES: Record<Estado, string> = {
  borrador: "bg-muted text-muted-foreground border-border",
  convertido: "bg-primary/15 text-primary border-primary/30",
  descartado: "bg-[color:var(--arean-warn)]/15 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30",
}

export function PpdListView({ ppds }: { ppds: Row[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"todos" | Estado>("todos")

  const counts = useMemo(() => {
    const base = { todos: ppds.length } as Record<"todos" | Estado, number>
    for (const e of ESTADOS) base[e.value] = 0
    for (const p of ppds) base[p.estado] = (base[p.estado] ?? 0) + 1
    return base
  }, [ppds])

  const filtered = useMemo(() => {
    let list = ppds
    if (filter !== "todos") list = list.filter((p) => p.estado === filter)
    if (q) {
      const qq = q.toLowerCase()
      list = list.filter(
        (p) =>
          p.titulo.toLowerCase().includes(qq) ||
          (p.descripcion ?? "").toLowerCase().includes(qq) ||
          (p.clientes?.nombre ?? "").toLowerCase().includes(qq)
      )
    }
    return list
  }, [ppds, filter, q])

  return (
    <>
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <h2 className="text-base font-medium">Proyectos para pensar y diseñar</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} resultados
        </span>
        <div className="flex-1" />
        <Button asChild>
          <Link href="/ppd/nuevo">
            <FilePlus size={14} className="mr-1.5" />
            Nuevo relevamiento
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
        Relevamiento técnico en obra: tildá los sistemas (iluminación, climatización, agua, carpinterías,
        seguridad, energía, expansión) que aplican al proyecto y agregale ambiente, prioridad y comentarios.
        Cuando esté listo, generás el PDF para el cliente y/o lo convertís en cotización.
      </p>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-card flex-1 max-w-md">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, descripción o cliente…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={counts.todos} />
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

      {ppds.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-16 text-center">
          <Lightbulb size={36} className="mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-medium mb-2">Sin relevamientos todavía</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Acá vas a tener todos los relevamientos técnicos de obra. Cuando uno está completo, sale el
            PDF para mostrarle al cliente y se convierte en cotización de un click.
          </p>
          <Button asChild>
            <Link href="/ppd/nuevo">
              <FilePlus size={14} className="mr-1.5" />
              Crear el primero
            </Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Ningún PPD coincide con esos filtros.
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-muted-foreground text-xs">
                <th className="text-left font-medium px-4 py-2.5">Título</th>
                <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                <th className="text-left font-medium px-4 py-2.5">Sistemas aplicados</th>
                <th className="text-left font-medium px-4 py-2.5">Estado</th>
                <th className="text-left font-medium px-4 py-2.5">Actualizado</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <PpdRow key={p.id} row={p} onRefresh={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
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

function PpdRow({ row, onRefresh }: { row: Row; onRefresh: () => void }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const stats = useMemo(() => countApplied(normalizeSurvey(row.items)), [row.items])

  function onConvert() {
    if (!row.cliente_id) {
      toast.error("Asigná un cliente al PPD antes de convertir", {
        description: "Abrí el PPD y seleccioná un cliente.",
      })
      return
    }
    start(async () => {
      const r = await convertirAcotizacion(row.id)
      if (r.ok) {
        toast.success("Convertido a cotización")
        router.push(`/editor/${r.data.cotizacionId}`)
      } else {
        toast.error("No se pudo convertir", { description: r.error })
      }
    })
  }

  function onDelete() {
    if (!confirm(`¿Eliminar el PPD "${row.titulo}"? Esta acción no se puede deshacer.`)) return
    start(async () => {
      const r = await deletePpd(row.id)
      if (r.ok) {
        toast.success("PPD eliminado")
        onRefresh()
      } else {
        toast.error("No se pudo eliminar", { description: r.error })
      }
    })
  }

  return (
    <tr className={cn("border-t border-border hover:bg-secondary/30", pending && "opacity-60")}>
      <td className="px-4 py-2.5">
        <Link href={`/ppd/${row.id}`} className="block hover:text-primary">
          <div className="text-sm font-medium">{row.titulo}</div>
          {row.descripcion && (
            <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-md">
              {row.descripcion}
            </div>
          )}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-sm">
        {row.clientes?.nombre ?? <span className="text-muted-foreground italic text-xs">(sin asignar)</span>}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs">
        <span className="font-medium">{stats.total}</span>
        <span className="text-muted-foreground"> · {stats.equipos} equipos</span>
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
            ESTADO_STYLES[row.estado]
          )}
        >
          {ESTADOS.find((e) => e.value === row.estado)?.label ?? row.estado}
        </span>
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
        {formatDate(row.updated_at)}
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
              <Link href={`/ppd/${row.id}`}>
                <Pencil size={13} className="mr-2" />
                Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onConvert}
              disabled={row.estado === "convertido" || !row.cliente_id}
            >
              <ArrowRight size={13} className="mr-2" />
              Convertir a cotización
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
