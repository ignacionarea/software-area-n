"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Search, Plus, Pencil, Trash2, Mail, Phone, MapPin, IdCard, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatARS, formatDate, formatCotizacionNumero } from "@/lib/format"
import { createCliente, updateCliente, deleteCliente } from "./actions"
import type { Database } from "@/types/database"

type ClienteResumen = Database["public"]["Views"]["v_clientes_resumen"]["Row"]
type Cliente = Database["public"]["Tables"]["clientes"]["Row"]
type CotizacionResumen = Database["public"]["Views"]["v_cotizaciones_resumen"]["Row"]

export function ClientesView({
  clientes,
  selected,
  historial,
}: {
  clientes: ClienteResumen[]
  selected: Cliente | null
  historial: CotizacionResumen[]
}) {
  const [q, setQ] = useState("")
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; cliente: Cliente } | null>(null)

  const router = useRouter()
  const sp = useSearchParams()
  const filtered = useMemo(() => {
    if (!q) return clientes
    const qq = q.toLowerCase()
    return clientes.filter(
      (c) =>
        (c.nombre ?? "").toLowerCase().includes(qq) ||
        (c.email ?? "").toLowerCase().includes(qq) ||
        (c.cuit_dni ?? "").includes(qq) ||
        (c.telefono ?? "").includes(qq)
    )
  }, [clientes, q])

  const totalFacturado = useMemo(
    () => historial.filter((c) => c.estado === "aceptada").reduce((s, c) => s + (c.total_ars ?? 0), 0),
    [historial]
  )

  function selectClient(id: string | null) {
    const params = new URLSearchParams(sp.toString())
    if (id) params.set("id", id)
    else params.delete("id")
    router.push(`/clientes${params.size > 0 ? `?${params}` : ""}`, { scroll: false })
  }

  return (
    <>
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-base font-medium">Clientes</h2>
        <span className="font-mono text-xs text-muted-foreground">{clientes.length} guardados</span>
        <div className="flex-1" />
        <Button onClick={() => setModal({ mode: "create" })}>
          <Plus size={14} className="mr-1.5" />
          Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">
        {/* List */}
        <div className="min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-card">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, email, teléfono o CUIT…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>

          <div className="border border-border rounded-lg bg-card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  {clientes.length === 0
                    ? "Todavía no agregaste clientes."
                    : "Ningún cliente coincide con tu búsqueda."}
                </p>
                {clientes.length === 0 && (
                  <Button onClick={() => setModal({ mode: "create" })}>
                    <Plus size={14} className="mr-1.5" />
                    Agregar el primero
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/50 text-muted-foreground text-xs">
                    <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                    <th className="text-left font-medium px-4 py-2.5">Contacto</th>
                    <th className="text-right font-medium px-4 py-2.5">Cotiz.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id ?? Math.random()}
                      onClick={() => c.id && selectClient(c.id)}
                      className={cn(
                        "border-t border-border cursor-pointer transition-colors",
                        c.id === selected?.id ? "bg-secondary/60" : "hover:bg-secondary/30"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Initials name={c.nombre ?? "?"} />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{c.nombre}</div>
                            {c.cuit_dni && (
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {c.cuit_dni}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs">{c.telefono ?? "—"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">
                          {c.email ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-muted-foreground">
                        {c.total_cotizaciones ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="min-w-0">
          {selected ? (
            <ClienteDetail
              cliente={selected}
              historial={historial}
              totalFacturado={totalFacturado}
              onEdit={() => setModal({ mode: "edit", cliente: selected })}
              onClose={() => selectClient(null)}
            />
          ) : (
            <div className="border border-border rounded-lg bg-card p-12 text-center text-sm text-muted-foreground">
              Seleccioná un cliente para ver su detalle.
            </div>
          )}
        </div>
      </div>

      {modal && (
        <ClienteModal
          mode={modal.mode}
          cliente={modal.mode === "edit" ? modal.cliente : undefined}
          onClose={() => setModal(null)}
          onSaved={(id) => {
            setModal(null)
            if (id) selectClient(id)
          }}
        />
      )}
    </>
  )
}

function Initials({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  return (
    <div className="w-7 h-7 rounded-md bg-secondary border border-border grid place-items-center font-mono text-[11px] text-muted-foreground shrink-0">
      {initials}
    </div>
  )
}

function ClienteDetail({
  cliente,
  historial,
  totalFacturado,
  onEdit,
  onClose,
}: {
  cliente: Cliente
  historial: CotizacionResumen[]
  totalFacturado: number
  onEdit: () => void
  onClose: () => void
}) {
  const [pending, start] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)
  const aceptadas = historial.filter((c) => c.estado === "aceptada").length

  function onDelete() {
    start(async () => {
      const r = await deleteCliente(cliente.id)
      if (r.ok) {
        toast.success(`Cliente eliminado · ${cliente.nombre}`)
        onClose()
      } else {
        toast.error("No se pudo eliminar", {
          description: r.error.includes("foreign key")
            ? "El cliente tiene cotizaciones vinculadas. Borrá las cotizaciones primero."
            : r.error,
        })
      }
      setConfirmDel(false)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-border rounded-lg bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{cliente.nombre}</div>
            <div className="font-mono text-[10px] text-muted-foreground">Cliente desde {formatDate(cliente.created_at)}</div>
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onEdit} title="Editar">
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)} title="Eliminar" disabled={pending}>
            <Trash2 size={14} />
          </Button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DetailRow icon={<Phone size={11} />} label="Teléfono" value={cliente.telefono} mono />
            <DetailRow icon={<Mail size={11} />} label="Email" value={cliente.email} mono />
            <DetailRow icon={<IdCard size={11} />} label="CUIT / DNI" value={cliente.cuit_dni} mono />
            <DetailRow icon={<MapPin size={11} />} label="Dirección del proyecto" value={cliente.direccion} />
          </div>
          <div className="border-t border-border pt-4 flex gap-6 flex-wrap">
            <Stat label="Cotizaciones" value={String(historial.length)} />
            <Stat label="Aceptadas" value={String(aceptadas)} />
            <Stat label="Total facturado" value={formatARS(totalFacturado)} />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Historial</span>
          <span className="text-xs text-muted-foreground">cotizaciones</span>
        </div>
        {historial.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Sin cotizaciones aún para este cliente.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-muted-foreground text-xs">
                <th className="text-left font-medium px-4 py-2">N°</th>
                <th className="text-left font-medium px-4 py-2">Fecha</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-right font-medium px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((c) => (
                <tr key={c.id ?? Math.random()} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-2 font-mono text-xs">
                    {c.numero ? formatCotizacionNumero(c.numero) : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {c.fecha_emision ? formatDate(c.fecha_emision) : "—"}
                  </td>
                  <td className="px-4 py-2"><EstadoChip estado={c.estado ?? "borrador"} /></td>
                  <td className="px-4 py-2 text-right font-mono">{formatARS(c.total_ars ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Vas a eliminar a <strong>{cliente.nombre}</strong>. Si tiene cotizaciones, no se puede borrar — primero eliminá las cotizaciones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
        {icon} {label}
      </div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${!value ? "text-muted-foreground" : ""}`}>
        {value || "—"}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-medium tabular-nums">{value}</div>
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

function ClienteModal({
  mode,
  cliente,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  cliente?: Cliente
  onClose: () => void
  onSaved: (id?: string) => void
}) {
  const [pending, start] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      if (mode === "create") {
        const r = await createCliente(fd)
        if (r.ok) {
          toast.success(`Cliente creado · ${fd.get("nombre")}`)
          onSaved(r.data.id)
        } else {
          toast.error(r.error)
        }
      } else if (cliente) {
        const r = await updateCliente(cliente.id, fd)
        if (r.ok) {
          toast.success("Cliente actualizado")
          onSaved(cliente.id)
        } else {
          toast.error(r.error)
        }
      }
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Se autocompleta al armar una cotización."
              : "Cambios se aplican de aquí en adelante."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <ModalField label="Nombre o Razón social" name="nombre" defaultValue={cliente?.nombre} required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Teléfono" name="telefono" defaultValue={cliente?.telefono ?? undefined} mono placeholder="+54 9 …" />
            <ModalField label="CUIT / DNI" name="cuit_dni" defaultValue={cliente?.cuit_dni ?? undefined} mono />
          </div>
          <ModalField label="Email" name="email" type="email" defaultValue={cliente?.email ?? undefined} mono />
          <ModalField label="Dirección del proyecto" name="direccion" defaultValue={cliente?.direccion ?? undefined} />
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <X size={14} className="mr-1.5" />
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : mode === "create" ? "Crear cliente" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ModalField({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  mono,
  placeholder,
  autoFocus,
}: {
  label: string
  name: string
  defaultValue?: string
  type?: string
  required?: boolean
  mono?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={mono ? "font-mono" : ""}
      />
    </div>
  )
}
