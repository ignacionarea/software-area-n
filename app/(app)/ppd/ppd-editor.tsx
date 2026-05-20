"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus, Save, ArrowRight, Trash2, Lightbulb, Download, Wind, Droplets, Square,
  Shield, Sun, Hammer,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Database } from "@/types/database"
import { savePpd, deletePpd, convertirAcotizacion } from "./actions"
import { createCliente } from "../clientes/actions"
import {
  CATEGORIES_CONFIG, EXPANSION_CATEGORY, buildEmptySurvey, normalizeSurvey, countApplied,
  type SurveyData, type SistemaRelevado, type Prioridad,
} from "./categorias"

type Ppd = Database["public"]["Tables"]["ppd_proyectos"]["Row"]
type Cliente = Database["public"]["Tables"]["clientes"]["Row"]
type Estado = Database["public"]["Enums"]["ppd_estado"]

const PRIORIDAD_STYLES: Record<Prioridad, string> = {
  Alta: "bg-destructive/15 text-destructive border-destructive/30",
  Media: "bg-[color:var(--arean-warn)]/15 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30",
  Baja: "bg-[color:var(--arean-info)]/15 text-[color:var(--arean-info)] border-[color:var(--arean-info)]/30",
}
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "Iluminación Inteligente": Lightbulb,
  "Climatización y Eficiencia": Wind,
  "Gestión Eficiente del Agua": Droplets,
  "Carpinterías y Aislación": Square,
  Seguridad: Shield,
  "Energía Sustentable": Sun,
  [EXPANSION_CATEGORY]: Hammer,
}

const ESTADO_STYLES: Record<Estado, string> = {
  borrador: "bg-muted text-muted-foreground border-border",
  convertido: "bg-primary/15 text-primary border-primary/30",
  descartado: "bg-[color:var(--arean-warn)]/15 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30",
}
const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "Borrador",
  convertido: "Convertido",
  descartado: "Descartado",
}

export function PpdEditor({
  ppd,
  clientes: clientesInitial,
  defaultTecnico,
}: {
  ppd: Ppd | null
  clientes: Cliente[]
  defaultTecnico?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [clientes, setClientes] = useState<Cliente[]>(clientesInitial)
  const [newClienteDialog, setNewClienteDialog] = useState<{ open: boolean; nombre: string }>({
    open: false, nombre: "",
  })

  const [titulo, setTitulo] = useState(ppd?.titulo ?? "")
  const [descripcion, setDescripcion] = useState(ppd?.descripcion ?? "")
  const [clienteId, setClienteId] = useState<string | null>(ppd?.cliente_id ?? null)
  const [direccion, setDireccion] = useState(ppd?.direccion_proyecto ?? "")
  const [tecnico, setTecnico] = useState(ppd?.tecnico_relevador ?? defaultTecnico ?? "")
  const [fecha, setFecha] = useState(ppd?.fecha_relevamiento ?? new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState(ppd?.notas ?? "")
  const [estado] = useState<Estado>(ppd?.estado ?? "borrador")
  const [survey, setSurvey] = useState<SurveyData>(() =>
    ppd ? normalizeSurvey(ppd.items) : buildEmptySurvey()
  )

  // When client selected & no dirección/tecnico set, prefill from client
  useEffect(() => {
    if (clienteId && !direccion) {
      const c = clientes.find((x) => x.id === clienteId)
      if (c?.direccion) setDireccion(c.direccion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const stats = useMemo(() => countApplied(survey), [survey])

  // Cliente search
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) ?? null
  const [clienteSearch, setClienteSearch] = useState<string>(clienteSeleccionado?.nombre ?? "")
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const clienteWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!clienteWrapRef.current?.contains(e.target as Node)) setShowClienteDropdown(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  const clienteMatches = useMemo(() => {
    if (!clienteSearch) return clientes.slice(0, 6)
    const q = clienteSearch.toLowerCase()
    return clientes
      .filter((c) => c.nombre.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || (c.cuit_dni ?? "").includes(q))
      .slice(0, 6)
  }, [clienteSearch, clientes])
  function selectCliente(c: Cliente | null) {
    setClienteId(c?.id ?? null)
    setClienteSearch(c?.nombre ?? "")
    setShowClienteDropdown(false)
  }

  function updateSistema(cat: string, idx: number, patch: Partial<SistemaRelevado>) {
    setSurvey((prev) => {
      const copy: SurveyData = { ...prev }
      const arr = [...copy[cat]]
      arr[idx] = { ...arr[idx], ...patch }
      copy[cat] = arr
      return copy
    })
  }

  function handleSave(navigateAfter = false) {
    if (!titulo.trim()) { toast.error("Ponele un título al PPD"); return }
    start(async () => {
      const r = await savePpd({
        id: ppd?.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        cliente_id: clienteId,
        direccion_proyecto: direccion.trim() || null,
        tecnico_relevador: tecnico.trim() || null,
        fecha_relevamiento: fecha,
        survey,
        notas: notas.trim() || null,
      })
      if (!r.ok) { toast.error("No se pudo guardar", { description: r.error }); return }
      toast.success(ppd ? "PPD actualizado" : "PPD guardado")
      if (!ppd && navigateAfter) router.push(`/ppd/${r.data.id}`)
      else if (!ppd) router.push(`/ppd/${r.data.id}`)
      else router.refresh()
    })
  }

  function handleConvert() {
    if (!ppd) { toast.error("Guardá el PPD primero"); return }
    if (!clienteId) { toast.error("Asigná un cliente"); return }
    if (stats.total === 0) { toast.error("No marcaste ningún sistema como aplicado"); return }
    start(async () => {
      // Save first to capture latest changes
      const saveRes = await savePpd({
        id: ppd.id,
        titulo: titulo.trim() || ppd.titulo,
        descripcion: descripcion.trim() || null,
        cliente_id: clienteId,
        direccion_proyecto: direccion.trim() || null,
        tecnico_relevador: tecnico.trim() || null,
        fecha_relevamiento: fecha,
        survey,
        notas: notas.trim() || null,
      })
      if (!saveRes.ok) { toast.error("No se pudo guardar antes de convertir", { description: saveRes.error }); return }
      const r = await convertirAcotizacion(ppd.id)
      if (!r.ok) { toast.error("No se pudo convertir", { description: r.error }); return }
      toast.success("Convertido a cotización · revisá los items y precios antes de enviar")
      router.push(`/editor/${r.data.cotizacionId}`)
    })
  }

  function handleDelete() {
    if (!ppd) return
    if (!confirm(`¿Eliminar el PPD "${ppd.titulo}"?`)) return
    start(async () => {
      const r = await deletePpd(ppd.id)
      if (r.ok) {
        toast.success("PPD eliminado")
        router.push("/ppd")
      } else {
        toast.error("No se pudo eliminar", { description: r.error })
      }
    })
  }

  async function handleDownloadPdf() {
    if (!ppd) { toast.error("Guardá el PPD antes de descargar el PDF"); return }
    if (stats.total === 0) { toast.error("Tildá al menos un sistema antes de descargar"); return }
    const { downloadPpdPdf } = await import("@/components/pdf/ppd-download")
    toast.loading("Generando reporte PDF…", { id: "ppd-pdf" })
    try {
      await downloadPpdPdf({
        numero: ppd.titulo,
        titulo: titulo.trim() || ppd.titulo,
        cliente: clienteSeleccionado?.nombre ?? "",
        direccion: direccion,
        fecha,
        tecnico,
        survey,
        notas,
        logoUrl: `${window.location.origin}/logo.png`,
      })
      toast.success("Reporte descargado", { id: "ppd-pdf" })
    } catch (e) {
      toast.error("No se pudo generar el PDF", {
        id: "ppd-pdf",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-sidebar flex-wrap">
        <Lightbulb size={14} className="text-[color:var(--arean-warn)]" />
        <strong className="text-sm">{titulo.trim() || "PPD sin título"}</strong>
        <span className="w-px h-4 bg-border" />
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border", ESTADO_STYLES[estado])}>
          {ESTADO_LABEL[estado]}
        </span>
        <span className="w-px h-4 bg-border" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {stats.total} aplicados · {stats.equipos} equipos · {stats.alta} alta · {stats.media} media · {stats.baja} baja
        </span>
        <div className="flex-1" />
        {ppd && (
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={pending}>
            <Download size={13} className="mr-1.5" />
            Descargar PDF
          </Button>
        )}
        {ppd && (
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={pending}>
            <Trash2 size={13} className="mr-1.5" />
            Eliminar
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={pending}>
          <Save size={13} className="mr-1.5" />
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button size="sm" onClick={handleConvert} disabled={pending || !ppd || estado === "convertido"}>
          <ArrowRight size={13} className="mr-1.5" />
          Convertir a cotización
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          {/* Datos generales */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel>Título del proyecto</FieldLabel>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder='Ej: "Casa Belgrano · Domótica"' />
            </div>

            <div ref={clienteWrapRef} className="relative">
              <FieldLabel>Cliente / Propietario</FieldLabel>
              <Input
                placeholder="Buscar por nombre, email o CUIT…"
                value={clienteSearch}
                onChange={(e) => { setClienteSearch(e.target.value); setShowClienteDropdown(true); setClienteId(null) }}
                onFocus={() => setShowClienteDropdown(true)}
              />
              {showClienteDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-auto border border-border rounded-md bg-card shadow-lg">
                  {clienteMatches.map((c) => (
                    <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b border-border last:border-b-0" onClick={() => selectCliente(c)}>
                      <div className="text-sm font-medium">{c.nombre}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{c.cuit_dni ?? "—"} · {c.email ?? "sin email"}</div>
                    </button>
                  ))}
                  <button type="button" onClick={() => setNewClienteDialog({ open: true, nombre: clienteSearch })} className="w-full text-left px-3 py-2.5 hover:bg-primary/10 text-primary border-t border-border flex items-center gap-2">
                    <Plus size={13} />
                    <span className="text-sm font-medium">Crear cliente{clienteSearch ? ` "${clienteSearch}"` : " nuevo"}</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <FieldLabel>Dirección de obra</FieldLabel>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej. Av. Libertador 1500, CABA" />
            </div>

            <div>
              <FieldLabel>Fecha del relevamiento</FieldLabel>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="font-mono" />
            </div>

            <div>
              <FieldLabel>Técnico relevador</FieldLabel>
              <Input value={tecnico} onChange={(e) => setTecnico(e.target.value)} placeholder="Ej. Ing. Ignacio Narea" />
            </div>

            <div className="md:col-span-2">
              <FieldLabel>Descripción (opcional)</FieldLabel>
              <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Resumen del proyecto, objetivos generales, etc." />
            </div>
          </section>

          {/* Relevamiento */}
          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-base font-medium">Relevamiento técnico por categorías</h2>
              <span className="font-mono text-xs text-muted-foreground">
                {stats.total} de {Object.values(CATEGORIES_CONFIG).flat().length} sistemas aplicados
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Tildá los sistemas que aplican al proyecto. Cantidad, ambiente, prioridad y comentarios solo aparecen
              cuando el sistema está activado.
            </p>

            <Accordion
              type="multiple"
              defaultValue={Object.keys(CATEGORIES_CONFIG).filter((cat) =>
                (survey[cat] ?? []).some((s) => s.applies)
              )}
              className="flex flex-col gap-2"
            >
              {Object.entries(CATEGORIES_CONFIG).map(([cat]) => (
                <CategoriaPanel
                  key={cat}
                  categoria={cat}
                  sistemas={survey[cat] ?? []}
                  onUpdate={(idx, patch) => updateSistema(cat, idx, patch)}
                />
              ))}
            </Accordion>
          </div>

          {/* Notas internas */}
          <section>
            <FieldLabel>Notas internas</FieldLabel>
            <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Anotá lo que necesites para acordarte después." />
          </section>

          {ppd?.cotizacion_id && (
            <div className="text-sm text-muted-foreground">
              Este PPD ya fue convertido. →{" "}
              <Link href={`/editor/${ppd.cotizacion_id}`} className="text-primary hover:underline">
                Ver cotización
              </Link>
            </div>
          )}
        </div>
      </div>

      <NewClienteDialog
        open={newClienteDialog.open}
        defaultNombre={newClienteDialog.nombre}
        onClose={() => setNewClienteDialog({ open: false, nombre: "" })}
        onCreated={(c) => {
          setClientes((prev) => [c, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)))
          selectCliente(c)
          setNewClienteDialog({ open: false, nombre: "" })
        }}
      />
    </>
  )
}

function CategoriaPanel({
  categoria,
  sistemas,
  onUpdate,
}: {
  categoria: string
  sistemas: SistemaRelevado[]
  onUpdate: (idx: number, patch: Partial<SistemaRelevado>) => void
}) {
  const applied = sistemas.filter((s) => s.applies).length
  const Icon = CATEGORY_ICONS[categoria] ?? Lightbulb
  const isExpansion = categoria === EXPANSION_CATEGORY

  return (
    <AccordionItem value={categoria} className="border border-border rounded-md bg-card overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <Icon size={15} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{categoria}</span>
          {applied > 0 && (
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-primary">
              {applied} aplicado{applied !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-0 pb-0">
        <div className="flex flex-col">
          {sistemas.map((sistema, idx) => (
            <SistemaRow
              key={sistema.name}
              sistema={sistema}
              onUpdate={(patch) => onUpdate(idx, patch)}
              isExpansion={isExpansion}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function SistemaRow({
  sistema,
  onUpdate,
  isExpansion,
}: {
  sistema: SistemaRelevado
  onUpdate: (patch: Partial<SistemaRelevado>) => void
  isExpansion: boolean
}) {
  return (
    <div
      className={cn(
        "border-t border-border px-4 py-3 transition-colors",
        sistema.applies ? "bg-card" : "bg-secondary/20 opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={sistema.applies}
          onCheckedChange={(v) => onUpdate({ applies: v === true })}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{sistema.name}</div>
          {isExpansion && sistema.applies && (
            <div className="mt-3">
              <FieldLabel>Observaciones de obra</FieldLabel>
              <Textarea
                rows={5}
                value={sistema.comments}
                onChange={(e) => onUpdate({ comments: e.target.value })}
                placeholder="Describí detalladamente: refacciones, ampliaciones, tendido eléctrico, aberturas adicionales, etc."
              />
            </div>
          )}
          {!isExpansion && sistema.applies && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-[100px_1fr_140px] gap-3">
              <div>
                <FieldLabel>Cantidad</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={sistema.quantity}
                  onChange={(e) => onUpdate({ quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="font-mono text-center"
                />
              </div>
              <div>
                <FieldLabel>Ambiente / Zona</FieldLabel>
                <Input
                  value={sistema.environment}
                  onChange={(e) => onUpdate({ environment: e.target.value })}
                  placeholder="Ej. Living, Cocina, Dormitorio"
                />
              </div>
              <div>
                <FieldLabel>Prioridad de obra</FieldLabel>
                <select
                  value={sistema.priority}
                  onChange={(e) => onUpdate({ priority: e.target.value as Prioridad })}
                  className={cn(
                    "h-10 w-full px-3 rounded-md border text-sm cursor-pointer",
                    PRIORIDAD_STYLES[sistema.priority]
                  )}
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <FieldLabel>Comentarios / especificaciones del cliente</FieldLabel>
                <Textarea
                  rows={2}
                  value={sistema.comments}
                  onChange={(e) => onUpdate({ comments: e.target.value })}
                  placeholder="Notas de instalación, marcas preferidas, cableados especiales, pedidos del cliente, etc."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
      {children}
    </Label>
  )
}

function NewClienteDialog({
  open, defaultNombre, onClose, onCreated,
}: {
  open: boolean; defaultNombre: string; onClose: () => void; onCreated: (c: Cliente) => void
}) {
  const [pending, start] = useTransition()
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    start(async () => {
      const r = await createCliente(fd)
      if (!r.ok) { toast.error(r.error); return }
      const newCliente: Cliente = {
        id: r.data.id,
        nombre: String(fd.get("nombre") ?? ""),
        telefono: (fd.get("telefono") ? String(fd.get("telefono")) : null) || null,
        email: (fd.get("email") ? String(fd.get("email")) : null) || null,
        direccion: (fd.get("direccion") ? String(fd.get("direccion")) : null) || null,
        cuit_dni: (fd.get("cuit_dni") ? String(fd.get("cuit_dni")) : null) || null,
        created_at: new Date().toISOString(),
      }
      toast.success(`Cliente creado · ${newCliente.nombre}`)
      onCreated(newCliente)
    })
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear cliente</DialogTitle>
          <DialogDescription>Mínimo el nombre. Los demás campos los podés completar después.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <QuickField label="Nombre o Razón social" name="nombre" defaultValue={defaultNombre} required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <QuickField label="Teléfono" name="telefono" mono placeholder="+54 9 …" />
            <QuickField label="CUIT / DNI" name="cuit_dni" mono />
          </div>
          <QuickField label="Email" name="email" type="email" mono />
          <QuickField label="Dirección del proyecto" name="direccion" />
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Creando…" : "Crear y seleccionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function QuickField({
  label, name, defaultValue, type = "text", required, mono, placeholder, autoFocus,
}: {
  label: string; name: string; defaultValue?: string; type?: string; required?: boolean; mono?: boolean; placeholder?: string; autoFocus?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
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
