"use client"

import { useMemo, useRef, useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Search, Plus, Minus, X, Save, Send, Download, Package, FilePenLine, Check, Mail, ArrowUp, ArrowDown,
} from "lucide-react"
import { downloadCotizacionPdf } from "@/components/pdf/download"
import { SendCotizacionDialog } from "@/components/email/send-cotizacion-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useDefaultLayout } from "react-resizable-panels"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { createCliente } from "../clientes/actions"
import { cn } from "@/lib/utils"
import { formatARS, formatUSD, formatCotizacionNumero, parseCotizacionNotas, serializeCotizacionNotas } from "@/lib/format"
import type { Database } from "@/types/database"
import { saveCotizacion, saveAndGo, type EditorPayload, type EditorItemInput } from "./actions"
import type { PdfItemData } from "@/components/pdf/cotizacion-document"

type Cliente = Database["public"]["Tables"]["clientes"]["Row"]
type Producto = Database["public"]["Tables"]["productos"]["Row"]
type Configuracion = Database["public"]["Tables"]["configuracion"]["Row"]
type Cotizacion = Database["public"]["Tables"]["cotizaciones"]["Row"]
type ItemRow = Database["public"]["Tables"]["items_cotizacion"]["Row"]
type Source = Database["public"]["Tables"]["scrape_sources"]["Row"]
type EstadoCotizacion = Database["public"]["Enums"]["estado_cotizacion"]

function marcaLabel(marca: string, sources: Source[]): string {
  if (marca === "manual") return "Manual"
  return sources.find((s) => s.slug === marca)?.nombre ?? marca
}

type Variante = {
  sku: string | null
  opciones: Record<string, string>
  precio_ars: number
  imagen_url: string | null
  disponible: boolean
}

type ProductoItem = {
  uid: string
  producto_id: string
  sku: string | null
  nombre: string
  aclaracion: string
  categoria: string | null
  marca: string
  precio_unitario_ars: number
  cantidad: number
  url_producto: string | null
  variante_key: string | null // identifies which variant; null for products without variants
}

function getVariantes(p: Producto): Variante[] {
  const v = p.variantes as unknown
  if (!Array.isArray(v)) return []
  return v as Variante[]
}

function varianteKey(opciones: Record<string, string>): string {
  return Object.entries(opciones)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => val)
    .join(" · ")
}

function varianteLabel(v: Variante): string {
  return Object.values(v.opciones).join(" · ")
}

type ManoObraItem = {
  uid: string
  concepto: string
  aclaracion: string
  tiene_cantidad: boolean
  cantidad: number
  precio_unitario: number
  monto: number
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function EditorView({
  clientes: clientesInitial,
  productos,
  sources,
  configuracion,
  cotizacion,
  items: existingItems,
  dolarVenta,
}: {
  clientes: Cliente[]
  productos: Producto[]
  sources: Source[]
  configuracion: Configuracion
  cotizacion: Cotizacion | null
  items: ItemRow[]
  dolarVenta: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [clientes, setClientes] = useState<Cliente[]>(clientesInitial)
  const [showNewClienteDialog, setShowNewClienteDialog] = useState<{ open: boolean; nombre: string }>({
    open: false,
    nombre: "",
  })
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [variantPicker, setVariantPicker] = useState<Producto | null>(null)

  // Persist panel sizes in localStorage (client-only)
  const [layoutStorage, setLayoutStorage] = useState<Storage | undefined>(undefined)
  useEffect(() => {
    if (typeof window !== "undefined") setLayoutStorage(window.localStorage)
  }, [])
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "editor-panels-v2",
    storage: layoutStorage,
    panelIds: ["cat", "center", "preview"],
  })

  // Initial state from existing cotización or defaults
  const today = new Date().toISOString().slice(0, 10)
  const initialMeta = useMemo(() => parseCotizacionNotas(cotizacion?.notas ?? null), [cotizacion?.notas])
  const [clienteId, setClienteId] = useState<string | null>(cotizacion?.cliente_id ?? null)
  const [fecha, setFecha] = useState<string>(cotizacion?.fecha_emision ?? today)
  const [validezDias, setValidezDias] = useState<number>(
    cotizacion?.validez_dias ?? configuracion.validez_default_dias
  )
  const [mostrarUsd, setMostrarUsd] = useState<boolean>(initialMeta.mostrarUsd ?? true)
  const [condicionesPago, setCondicionesPago] = useState<string>(
    initialMeta.condicionesPago !== undefined && initialMeta.condicionesPago !== ""
      ? initialMeta.condicionesPago
      : (configuracion.condiciones_pago || "")
  )
  const [condiciones, setCondiciones] = useState<string>(
    initialMeta.condiciones !== undefined && initialMeta.condiciones !== ""
      ? initialMeta.condiciones
      : (configuracion.texto_legal_pdf || "")
  )
  const [notas, setNotas] = useState<string>(initialMeta.notas ?? "")
  const [estado] = useState<EstadoCotizacion>(cotizacion?.estado ?? "borrador")

  const [productoItems, setProductoItems] = useState<ProductoItem[]>(() =>
    existingItems
      .filter((i) => i.tipo === "producto")
      .map((i) => {
        const prod = productos.find((p) => p.id === i.producto_id)
        const lines = (i.concepto || "").split("\n")
        const rawConcepto = lines[0] ?? ""
        const aclaracion = lines.slice(1).join("\n").trim()

        // Reconstruct variante_key from concepto if applicable
        const baseNombre = prod?.nombre
        let key: string | null = null
        if (baseNombre && rawConcepto !== baseNombre && rawConcepto.startsWith(baseNombre + " · ")) {
          key = rawConcepto.slice(baseNombre.length + 3)
        }
        return {
          uid: i.id,
          producto_id: i.producto_id ?? "",
          sku: prod?.sku ?? null,
          nombre: rawConcepto,
          aclaracion,
          categoria: prod?.categoria ?? null,
          marca: prod?.marca ?? "—",
          precio_unitario_ars: Number(i.precio_unitario_ars),
          cantidad: Number(i.cantidad),
          url_producto: i.url_producto,
          variante_key: key,
        }
      })
  )
  const [manoObras, setManoObras] = useState<ManoObraItem[]>(() =>
    existingItems
      .filter((i) => i.tipo === "mano_obra")
      .map((i) => {
        const lines = (i.concepto || "").split("\n")
        const concepto = lines[0] ?? ""
        const aclaracion = lines.slice(1).join("\n").trim()
        const tiene_cantidad = Number(i.cantidad) > 1
        const cant = Number(i.cantidad) || 1
        const pUnit = Number(i.precio_unitario_ars)
        const monto = tiene_cantidad ? pUnit * cant : pUnit
        return {
          uid: i.id,
          concepto,
          aclaracion,
          tiene_cantidad,
          cantidad: cant,
          precio_unitario: pUnit,
          monto,
        }
      })
  )

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
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.cuit_dni ?? "").includes(q)
      )
      .slice(0, 6)
  }, [clienteSearch, clientes])

  // Producto search
  const [productoQ, setProductoQ] = useState("")
  const [showProductoDropdown, setShowProductoDropdown] = useState(false)
  const productoWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!productoWrapRef.current?.contains(e.target as Node)) setShowProductoDropdown(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  const productoMatches = useMemo(() => {
    if (!productoQ) return []
    const q = productoQ.toLowerCase()
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.categoria ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [productoQ, productos])

  // Totales
  const totals = useMemo(() => {
    const subProductos = productoItems.reduce((s, i) => s + i.precio_unitario_ars * i.cantidad, 0)
    const subMo = manoObras.reduce((s, m) => s + (Number(m.monto) || 0), 0)
    const total = subProductos + subMo
    const comision = subProductos * (Number(configuracion.comision_porcentaje) / 100)
    const ganancia = subMo + comision
    return {
      subProductos,
      subMo,
      total,
      comision,
      ganancia,
      subProductosUsd: subProductos / (dolarVenta || 1),
      subMoUsd: subMo / (dolarVenta || 1),
      totalUsd: total / (dolarVenta || 1),
    }
  }, [productoItems, manoObras, configuracion.comision_porcentaje, dolarVenta])

  // Validación
  const errors = useMemo(() => {
    const e: { cliente?: string; items?: string } = {}
    if (!clienteId) e.cliente = "Seleccioná un cliente"
    if (productoItems.length === 0 && manoObras.every((m) => !m.monto)) {
      e.items = "Agregá productos o mano de obra"
    }
    return e
  }, [clienteId, productoItems, manoObras])
  const isValid = Object.keys(errors).length === 0

  function selectCliente(c: Cliente | null) {
    setClienteId(c?.id ?? null)
    setClienteSearch(c?.nombre ?? "")
    setShowClienteDropdown(false)
  }

  function handleProductoClick(p: Producto) {
    const variantes = getVariantes(p)
    if (variantes.length > 0) {
      setVariantPicker(p)
      setProductoQ("")
      setShowProductoDropdown(false)
      return
    }
    addProducto(p)
  }

  function addProducto(p: Producto, variante: Variante | null = null) {
    const key = variante ? varianteKey(variante.opciones) : null
    setProductoItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === p.id && i.variante_key === key)
      if (idx > -1) {
        toast.message(`+1 ${p.nombre}${variante ? ` · ${varianteLabel(variante)}` : ""}`)
        return prev.map((it, i) => (i === idx ? { ...it, cantidad: it.cantidad + 1 } : it))
      }
      const nombreCompuesto = variante ? `${p.nombre} · ${varianteLabel(variante)}` : p.nombre
      toast.message(`Agregado: ${nombreCompuesto}`)
      return [
        ...prev,
        {
          uid: uid(),
          producto_id: p.id,
          sku: variante?.sku ?? p.sku,
          nombre: nombreCompuesto,
          aclaracion: "",
          categoria: p.categoria,
          marca: p.marca,
          precio_unitario_ars: variante?.precio_ars ?? Number(p.precio_origen),
          cantidad: 1,
          url_producto: p.url,
          variante_key: key,
        },
      ]
    })
    setProductoQ("")
    setShowProductoDropdown(false)
  }

  function updateQty(uidVal: string, delta: number) {
    setProductoItems((prev) =>
      prev
        .map((i) => (i.uid === uidVal ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i))
        .filter((i) => i.cantidad > 0)
    )
  }
  function setQty(uidVal: string, val: string) {
    const n = Math.max(0, Math.floor(Number(val.replace(/[^0-9]/g, "")) || 0))
    setProductoItems((prev) =>
      prev.map((i) => (i.uid === uidVal ? { ...i, cantidad: n } : i)).filter((i) => i.cantidad > 0)
    )
  }
  function updateProducto(uidVal: string, patch: Partial<ProductoItem>) {
    setProductoItems((prev) => prev.map((i) => (i.uid === uidVal ? { ...i, ...patch } : i)))
  }
  function moveProducto(index: number, direction: "up" | "down") {
    setProductoItems((prev) => {
      const next = [...prev]
      const targetIdx = direction === "up" ? index - 1 : index + 1
      if (targetIdx < 0 || targetIdx >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIdx]
      next[targetIdx] = temp
      return next
    })
  }
  function removeProducto(uidVal: string) {
    setProductoItems((prev) => prev.filter((i) => i.uid !== uidVal))
  }

  function addManoObra() {
    setManoObras((prev) => [
      ...prev,
      {
        uid: uid(),
        concepto: "",
        aclaracion: "",
        tiene_cantidad: false,
        cantidad: 1,
        precio_unitario: 0,
        monto: 0,
      },
    ])
  }
  function updateMo(uidVal: string, patch: Partial<ManoObraItem>) {
    setManoObras((prev) =>
      prev.map((m) => {
        if (m.uid !== uidVal) return m
        const updated = { ...m, ...patch }
        if (updated.tiene_cantidad) {
          updated.monto = (Number(updated.cantidad) || 0) * (Number(updated.precio_unitario) || 0)
        }
        return updated
      })
    )
  }
  function moveMo(index: number, direction: "up" | "down") {
    setManoObras((prev) => {
      const next = [...prev]
      const targetIdx = direction === "up" ? index - 1 : index + 1
      if (targetIdx < 0 || targetIdx >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIdx]
      next[targetIdx] = temp
      return next
    })
  }
  function removeMo(uidVal: string) {
    setManoObras((prev) => prev.filter((m) => m.uid !== uidVal))
  }

  function buildPayload(targetEstado: EstadoCotizacion): EditorPayload {
    const items: EditorItemInput[] = []
    for (const p of productoItems) {
      items.push({
        tipo: "producto",
        producto_id: p.producto_id,
        concepto: p.nombre,
        aclaracion: p.aclaracion || null,
        tiene_cantidad: true,
        cantidad: p.cantidad,
        precio_unitario_ars: p.precio_unitario_ars,
        url_producto: p.url_producto,
      })
    }
    for (const m of manoObras) {
      if (!m.concepto.trim() && !m.monto) continue
      items.push({
        tipo: "mano_obra",
        producto_id: null,
        concepto: m.concepto.trim() || "Mano de obra",
        aclaracion: m.aclaracion || null,
        tiene_cantidad: m.tiene_cantidad,
        cantidad: m.tiene_cantidad ? (Number(m.cantidad) || 1) : 1,
        precio_unitario_ars: m.tiene_cantidad ? (Number(m.precio_unitario) || 0) : (Number(m.monto) || 0),
        url_producto: null,
      })
    }
    const serializedNotas = serializeCotizacionNotas({
      notas: notas.trim(),
      mostrarUsd,
      condiciones: condiciones.trim(),
      condicionesPago: condicionesPago.trim(),
    })
    return {
      id: cotizacion?.id,
      cliente_id: clienteId,
      fecha_emision: fecha,
      validez_dias: validezDias,
      cotizacion_dolar: cotizacion?.cotizacion_dolar ?? dolarVenta,
      notas: serializedNotas,
      estado: targetEstado,
      items,
    }
  }

  function handleSave() {
    if (!clienteId) {
      toast.error("Seleccioná un cliente antes de guardar")
      return
    }
    start(async () => {
      const r = await saveCotizacion(buildPayload(estado === "borrador" ? "borrador" : estado))
      if (!r.ok) {
        toast.error("No se pudo guardar", { description: r.error })
        return
      }
      toast.success(cotizacion ? "Cotización actualizada" : "Borrador guardado")
      if (!cotizacion) {
        router.push(`/editor/${r.data.id}`)
      } else {
        router.refresh()
      }
    })
  }

  async function handleDownloadPdf() {
    if (!clienteId) {
      toast.error("Seleccioná un cliente antes de descargar el PDF")
      return
    }
    if (productoItems.length === 0 && manoObras.every((m) => !m.monto)) {
      toast.error("Agregá productos o mano de obra antes de descargar")
      return
    }
    const pdfItems: PdfItemData[] = [
      ...productoItems.map((p) => ({
        tipo: "producto" as const,
        concepto: p.nombre,
        aclaracion: p.aclaracion || null,
        tiene_cantidad: true,
        cantidad: p.cantidad,
        precio_unitario_ars: p.precio_unitario_ars,
        url_producto: p.url_producto,
        marca: p.marca,
      })),
      ...manoObras
        .filter((m) => m.concepto.trim() || m.monto > 0)
        .map((m) => ({
          tipo: "mano_obra" as const,
          concepto: m.concepto.trim() || "Mano de obra",
          aclaracion: m.aclaracion || null,
          tiene_cantidad: m.tiene_cantidad,
          cantidad: m.tiene_cantidad ? (Number(m.cantidad) || 1) : 1,
          precio_unitario_ars: m.tiene_cantidad ? (Number(m.precio_unitario) || 0) : (Number(m.monto) || 0),
          url_producto: null,
          marca: null,
        })),
    ]
    const logoUrl = `${window.location.origin}/logo.png`
    try {
      toast.loading("Generando PDF…", { id: "pdf-gen" })
      await downloadCotizacionPdf({
        numeroFormateado: numeroDisplay,
        fechaEmision: fecha,
        validezDias,
        cotizacionDolar: cotizacion?.cotizacion_dolar ?? dolarVenta,
        mostrarUsd,
        condicionesPersonalizadas: condiciones.trim() || null,
        condicionesPagoPersonalizadas: condicionesPago.trim() || null,
        cliente: clienteSeleccionado
          ? {
              nombre: clienteSeleccionado.nombre,
              cuit_dni: clienteSeleccionado.cuit_dni,
              email: clienteSeleccionado.email,
              telefono: clienteSeleccionado.telefono,
              direccion: clienteSeleccionado.direccion,
            }
          : null,
        items: pdfItems,
        subtotalProductos: totals.subProductos,
        subtotalManoObra: totals.subMo,
        total: totals.total,
        totalUsd: totals.totalUsd,
        configuracion,
        logoUrl,
      })
      toast.success("PDF descargado", { id: "pdf-gen" })
    } catch (e) {
      toast.error("No se pudo generar el PDF", {
        id: "pdf-gen",
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  function handleSend() {
    if (!isValid) {
      const msg = errors.cliente ?? errors.items ?? "Completá los campos"
      toast.error(msg)
      return
    }
    start(async () => {
      const r = await saveCotizacion(buildPayload("enviada"))
      if (!r.ok) {
        toast.error("No se pudo enviar", { description: r.error })
        return
      }
      toast.success("Cotización marcada como enviada")
      if (!cotizacion) router.push(`/editor/${r.data.id}`)
      else router.refresh()
    })
  }

  void saveAndGo // keep import for possible future use

  const numeroDisplay = cotizacion ? formatCotizacionNumero(cotizacion.numero) : "CT-????"

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-sidebar flex-wrap">
        <span className="font-mono text-xs text-muted-foreground">N°</span>
        <strong className="font-mono text-sm">{numeroDisplay}</strong>
        <span className="w-px h-4 bg-border" />
        <EstadoChip estado={estado} />
        <span className="w-px h-4 bg-border" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {productoItems.length} items · MO {formatARS(totals.subMo)} · Total {formatARS(totals.total)} / {formatUSD(totals.totalUsd)}
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
          <Download size={13} className="mr-1.5" />
          Descargar PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!cotizacion) {
              toast.error("Guardá la cotización primero antes de enviarla")
              return
            }
            if (!clienteSeleccionado?.email) {
              toast.error("El cliente no tiene email cargado")
              return
            }
            setShowSendDialog(true)
          }}
        >
          <Mail size={13} className="mr-1.5" />
          Enviar por mail
        </Button>
        <Button variant="outline" size="sm" onClick={handleSave} disabled={pending}>
          <Save size={13} className="mr-1.5" />
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button size="sm" onClick={handleSend} disabled={pending || !isValid}>
          <Send size={13} className="mr-1.5" />
          Marcar enviada
        </Button>
      </div>

      {/* Body — 3 resizable panels (catálogo · form/items · preview) */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1 overflow-hidden"
        id="editor-panels-v2"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        {/* LEFT — Catálogo */}
        <ResizablePanel
          id="cat"
          defaultSize="22%"
          minSize="14%"
          maxSize="45%"
          className="flex flex-col bg-sidebar/40 overflow-hidden"
        >
          <CatalogoPane
            productos={productos}
            sources={sources}
            productosEnCotizacion={new Set(productoItems.map((i) => i.producto_id))}
            onProductClick={handleProductoClick}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* CENTER — form + items */}
        <ResizablePanel id="center" defaultSize="45%" minSize="25%" className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
          {/* Datos generales */}
          <section>
            <SectionHeader title="Datos generales" sub="paso 1 / 3" />
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px] gap-3">
              <div ref={clienteWrapRef} className="relative">
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cliente
                </Label>
                <Input
                  placeholder="Buscar por nombre, email o CUIT…"
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value)
                    setShowClienteDropdown(true)
                    setClienteId(null)
                  }}
                  onFocus={() => setShowClienteDropdown(true)}
                  className="mt-1.5"
                />
                {errors.cliente && !clienteId && (
                  <span className="text-[11px] text-destructive mt-1 block">{errors.cliente}</span>
                )}
                {showClienteDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-auto border border-border rounded-md bg-card shadow-lg">
                    {clienteMatches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b border-border last:border-b-0"
                        onClick={() => selectCliente(c)}
                      >
                        <div className="text-sm font-medium">{c.nombre}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {c.cuit_dni ?? "—"} · {c.email ?? "sin email"}
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowNewClienteDialog({ open: true, nombre: clienteSearch })}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary/10 text-primary border-t border-border flex items-center gap-2"
                    >
                      <Plus size={13} />
                      <span className="text-sm font-medium">
                        Crear cliente{clienteSearch ? ` "${clienteSearch}"` : " nuevo"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Fecha
                </Label>
                <Input
                  type="date"
                  className="font-mono mt-1.5"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Validez (días)
                </Label>
                <Input
                  type="number"
                  min="1"
                  className="font-mono mt-1.5"
                  value={validezDias}
                  onChange={(e) => setValidezDias(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>

            {clienteSeleccionado && (
              <div className="mt-3 border border-border rounded-md bg-card px-4 py-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <Field label="Teléfono" value={clienteSeleccionado.telefono} mono />
                  <Field label="Email" value={clienteSeleccionado.email} mono />
                  <Field label="CUIT/DNI" value={clienteSeleccionado.cuit_dni} mono />
                  <Field label="Cliente desde" value={new Date(clienteSeleccionado.created_at).toLocaleDateString("es-AR")} mono />
                  <div className="col-span-2 md:col-span-4">
                    <Field label="Dirección del proyecto" value={clienteSeleccionado.direccion} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Productos */}
          <section>
            <SectionHeader title="Productos" sub="paso 2 / 3" right={`${productoItems.length} agregados`} />

            <div ref={productoWrapRef} className="relative mb-3">
              <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-card">
                <Search size={14} className="text-muted-foreground" />
                <input
                  value={productoQ}
                  onChange={(e) => {
                    setProductoQ(e.target.value)
                    setShowProductoDropdown(true)
                  }}
                  onFocus={() => setShowProductoDropdown(true)}
                  placeholder="Agregar producto: nombre, SKU, categoría…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
                <span className="font-mono text-[10px] text-muted-foreground">{productos.length}</span>
              </div>
              {showProductoDropdown && productoQ && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-80 overflow-auto border border-border rounded-md bg-card shadow-lg">
                  {productoMatches.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">
                      Sin resultados para &ldquo;{productoQ}&rdquo;
                    </div>
                  ) : (
                    productoMatches.map((p) => {
                      const variantesCount = getVariantes(p).length
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProductoClick(p)}
                          className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b border-border last:border-b-0 grid grid-cols-[1fr_auto_auto] gap-3 items-center"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{p.nombre}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {p.sku ?? "—"} · {p.marca} {p.categoria ? `· ${p.categoria}` : ""}
                              {variantesCount > 0 && (
                                <span className="text-primary"> · {variantesCount} variantes</span>
                              )}
                            </div>
                          </div>
                          <div className="font-mono text-sm">
                            {variantesCount > 0 ? "desde " : ""}{formatARS(Number(p.precio_origen))}
                          </div>
                          <Plus size={14} className="text-primary" />
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="border border-border rounded-md bg-card overflow-hidden">
              <div className="grid grid-cols-[36px_1fr_120px_120px_120px_40px] text-[11px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary/50 px-3 py-2">
                <div />
                <div>Concepto</div>
                <div className="text-center">Cant.</div>
                <div className="text-right">Unit. ARS</div>
                <div className="text-right">Subtotal</div>
                <div />
              </div>
              {productoItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  <Package size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                  Sin productos. Buscá arriba para agregar.
                </div>
              ) : (
                productoItems.map((it, idx) => (
                  <div
                    key={it.uid}
                    className="flex flex-col gap-1.5 px-3 py-2 border-t border-border"
                  >
                    <div className="grid grid-cols-[36px_1fr_120px_120px_120px_40px] items-center">
                      <div className="flex flex-col gap-0.5 pr-2">
                        <button
                          type="button"
                          onClick={() => moveProducto(idx, "up")}
                          disabled={idx === 0}
                          className="w-5 h-4 grid place-items-center rounded hover:bg-secondary text-muted-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Mover arriba"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProducto(idx, "down")}
                          disabled={idx === productoItems.length - 1}
                          className="w-5 h-4 grid place-items-center rounded hover:bg-secondary text-muted-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Mover abajo"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-medium truncate">{it.nombre}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">
                          {it.sku ?? "—"} · {it.marca} {it.categoria ? `· ${it.categoria}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          type="button"
                          onClick={() => updateQty(it.uid, -1)}
                          className="w-6 h-6 grid place-items-center rounded border border-border hover:bg-secondary"
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          value={it.cantidad}
                          onChange={(e) => setQty(it.uid, e.target.value)}
                          className="w-10 h-6 text-center font-mono text-sm bg-transparent border border-border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(it.uid, +1)}
                          className="w-6 h-6 grid place-items-center rounded border border-border hover:bg-secondary"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                      <div className="text-right font-mono text-sm">{formatARS(it.precio_unitario_ars)}</div>
                      <div className="text-right font-mono text-sm font-medium">
                        {formatARS(it.precio_unitario_ars * it.cantidad)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProducto(it.uid)}
                        className="w-7 h-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground ml-auto"
                        title="Quitar"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div className="pl-9 pr-8">
                      <Input
                        placeholder="Aclaración / detalle del producto (opcional)..."
                        value={it.aclaracion || ""}
                        onChange={(e) => updateProducto(it.uid, { aclaracion: e.target.value })}
                        className="h-7 text-xs text-muted-foreground bg-muted/20 border-dashed placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Mano de obra */}
          <section>
            <SectionHeader
              title="Mano de obra"
              sub={`comisión ${configuracion.comision_porcentaje}% s/ productos · ${formatARS(totals.comision)}`}
              right={
                <Button variant="outline" size="sm" onClick={addManoObra}>
                  <Plus size={12} className="mr-1.5" /> Agregar ítem
                </Button>
              }
            />
            <div className="border border-border rounded-md bg-card overflow-hidden">
              {manoObras.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Sin mano de obra. <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={addManoObra}>+ Agregar primer ítem</button>
                </div>
              ) : (
                manoObras.map((m, idx) => (
                  <div
                    key={m.uid}
                    className={cn(
                      "flex flex-col gap-2 p-3 bg-card transition-colors",
                      idx > 0 && "border-t border-border"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Subir / Bajar */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveMo(idx, "up")}
                          disabled={idx === 0}
                          className="w-5 h-4 grid place-items-center rounded hover:bg-secondary text-muted-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Mover arriba"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMo(idx, "down")}
                          disabled={idx === manoObras.length - 1}
                          className="w-5 h-4 grid place-items-center rounded hover:bg-secondary text-muted-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Mover abajo"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>

                      <span className="font-mono text-[11px] text-muted-foreground w-4 text-center shrink-0">
                        #{idx + 1}
                      </span>

                      {/* Título principal del concepto */}
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder={`Concepto: ej "Dimerización de tiras led sector Estudio"`}
                          value={m.concepto}
                          onChange={(e) => updateMo(m.uid, { concepto: e.target.value })}
                          className="h-9 text-sm font-medium"
                        />
                      </div>

                      {/* Toggle Cantidad vs Monto Global */}
                      <button
                        type="button"
                        onClick={() =>
                          updateMo(m.uid, {
                            tiene_cantidad: !m.tiene_cantidad,
                            precio_unitario: !m.tiene_cantidad ? m.monto : m.precio_unitario,
                          })
                        }
                        className={cn(
                          "h-9 px-2.5 rounded border text-xs font-mono transition-colors shrink-0 flex items-center gap-1",
                          m.tiene_cantidad
                            ? "bg-primary/15 border-primary/40 text-primary font-medium"
                            : "bg-muted/40 border-border text-muted-foreground hover:bg-secondary"
                        )}
                        title={m.tiene_cantidad ? "Cambiar a monto global directo" : "Habilitar cálculo por cantidad (Cant. x P. unit)"}
                      >
                        <span>{m.tiene_cantidad ? "Por cantidad" : "Monto global"}</span>
                      </button>

                      {/* Campos numéricos */}
                      {m.tiene_cantidad ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Cant."
                            className="w-14 h-9 font-mono text-center text-xs"
                            value={m.cantidad || ""}
                            onChange={(e) => updateMo(m.uid, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                          />
                          <span className="text-muted-foreground text-xs font-mono">×</span>
                          <Input
                            type="number"
                            placeholder="$ Unit."
                            className="w-24 h-9 font-mono text-right text-xs"
                            value={m.precio_unitario || ""}
                            onChange={(e) => updateMo(m.uid, { precio_unitario: Number(e.target.value) || 0 })}
                          />
                          <div className="w-24 text-right font-mono text-xs font-semibold truncate pl-1">
                            {formatARS((m.cantidad || 1) * (m.precio_unitario || 0))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            placeholder="$ Monto"
                            className="w-32 h-9 font-mono text-right text-sm font-semibold"
                            value={m.monto || ""}
                            onChange={(e) =>
                              updateMo(m.uid, {
                                monto: Number(e.target.value) || 0,
                                precio_unitario: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      )}

                      {/* Botón quitar */}
                      <button
                        type="button"
                        onClick={() => removeMo(m.uid)}
                        className="w-8 h-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0"
                        title="Quitar"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Aclaración / Detalle de la tarea */}
                    <div className="pl-11 pr-10">
                      <Input
                        placeholder="Aclaración / detalle (ej: Incluye las 4 tiras led cálidas + transformador...)"
                        value={m.aclaracion || ""}
                        onChange={(e) => updateMo(m.uid, { aclaracion: e.target.value })}
                        className="h-8 text-xs text-muted-foreground bg-muted/20 border-dashed placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                ))
              )}
              {manoObras.length > 1 && (
                <div className="flex justify-between items-center px-3 py-2 bg-secondary/40 border-t border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Subtotal mano de obra · {manoObras.length} ítems</span>
                  <span className="text-foreground">{formatARS(totals.subMo)}</span>
                </div>
              )}
            </div>
            {errors.items && (
              <span className="text-[11px] text-destructive mt-2 block">{errors.items}</span>
            )}
          </section>

          {/* Totales */}
          <section>
            <div className="border border-border rounded-md bg-card px-4 py-4">
              <TotalRow label="Subtotal productos" ars={totals.subProductos} dolarVenta={dolarVenta} />
              <TotalRow label="Mano de obra" ars={totals.subMo} dolarVenta={dolarVenta} />
              <div className="h-px bg-border my-3" />
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{formatUSD(totals.totalUsd)}</div>
                </div>
                <strong className="font-mono text-3xl tracking-tight font-medium tabular-nums">
                  {formatARS(totals.total)}
                </strong>
              </div>
              <div className="h-px bg-border my-3" />
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider">
                <span className="text-muted-foreground">Ganancia Area N</span>
                <span className="text-primary">
                  {formatARS(totals.ganancia)} · MO + {configuracion.comision_porcentaje}% comisión
                </span>
              </div>
            </div>

            {/* Switch / Toggle para mostrar o no conversión a USD */}
            <div className="mt-3 flex items-center justify-between p-3.5 rounded-md border border-border bg-card">
              <div className="flex flex-col gap-0.5">
                <div className="text-xs font-medium">Conversión y tipo de cambio USD en el PDF</div>
                <div className="text-[11px] text-muted-foreground">
                  {mostrarUsd
                    ? "Activado: Muestra la cotización del dólar y el total equivalente en USD en el presupuesto."
                    : "Desactivado: Presupuesto 100% en pesos (ARS), no muestra cotización de dólar ni USD en el PDF."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarUsd((v) => !v)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors shrink-0 ml-3",
                  mostrarUsd
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted/50 border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {mostrarUsd ? "✓ Mostrar USD" : "Solo Pesos (ARS)"}
              </button>
            </div>
          </section>

          {/* Condiciones de pago */}
          <section>
            <SectionHeader
              title="Condiciones de pago (PDF)"
              sub="aparece en el PDF · editable para este presupuesto"
            />
            <Input
              value={condicionesPago}
              onChange={(e) => setCondicionesPago(e.target.value)}
              placeholder="Ej: 50% de anticipo para reserva de equipos, 50% contra entrega e instalación."
              className="text-xs"
            />
          </section>

          {/* Términos y condiciones generales */}
          <section>
            <SectionHeader
              title="Términos y condiciones generales (PDF)"
              sub="opcional · aparece al pie del PDF"
            />
            <Textarea
              rows={3}
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              placeholder="Escribí aquí términos de validez, plazos de entrega, garantías, etc."
              className="text-xs leading-relaxed"
            />
          </section>

          {/* Notas internas */}
          <section>
            <SectionHeader title="Notas internas" sub="opcional · solo uso interno, no aparece en el PDF" />
            <Textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Recordatorios, acuerdos internos, etc."
              className="text-xs"
            />
          </section>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT — live preview */}
        <ResizablePanel
          id="preview"
          defaultSize="33%"
          minSize="20%"
          maxSize="60%"
          className="bg-sidebar/40 flex flex-col overflow-hidden"
        >
          <PreviewPane
            numero={numeroDisplay}
            cliente={clienteSeleccionado}
            fecha={fecha}
            validezDias={validezDias}
            productoItems={productoItems}
            manoObras={manoObras}
            totals={totals}
            configuracion={configuracion}
            mostrarUsd={mostrarUsd}
            condicionesPago={condicionesPago}
            condiciones={condiciones}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <NewClienteDialog
        open={showNewClienteDialog.open}
        defaultNombre={showNewClienteDialog.nombre}
        onClose={() => setShowNewClienteDialog({ open: false, nombre: "" })}
        onCreated={(c) => {
          setClientes((prev) => [c, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)))
          selectCliente(c)
          setShowNewClienteDialog({ open: false, nombre: "" })
        }}
      />

      {variantPicker && (
        <VariantPickerDialog
          producto={variantPicker}
          onClose={() => setVariantPicker(null)}
          onPick={(v) => {
            addProducto(variantPicker, v)
            setVariantPicker(null)
          }}
        />
      )}

      {cotizacion && clienteSeleccionado && (
        <SendCotizacionDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          cotizacionId={cotizacion.id}
          defaultTo={clienteSeleccionado.email ?? ""}
          clienteNombre={clienteSeleccionado.nombre}
          numeroFormateado={numeroDisplay}
          fechaEmision={fecha}
          validezDias={validezDias}
          totalArs={totals.total}
          totalUsd={totals.totalUsd}
          razonSocial={configuracion.razon_social}
          contactoEmail={configuracion.email}
          contactoTel={configuracion.telefono}
          onSent={() => router.refresh()}
        />
      )}
    </>
  )
}

function VariantPickerDialog({
  producto,
  onClose,
  onPick,
}: {
  producto: Producto
  onClose: () => void
  onPick: (v: Variante) => void
}) {
  const variantes = getVariantes(producto).filter((v) => v.disponible)
  // Group axes & their unique values
  const axesNames = variantes[0] ? Object.keys(variantes[0].opciones) : []

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{producto.nombre}</DialogTitle>
          <DialogDescription>
            Este producto tiene {variantes.length} variante{variantes.length !== 1 ? "s" : ""}.
            Elegí la que quieras agregar a la cotización.
            {axesNames.length > 0 && (
              <span className="block mt-1 text-[10px] font-mono uppercase tracking-wider">
                Axes: {axesNames.join(" · ")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-auto flex flex-col gap-1.5">
          {variantes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No hay variantes disponibles para este producto.
            </div>
          ) : (
            variantes.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPick(v)}
                className="text-left px-3 py-2.5 rounded-md border border-border bg-card hover:border-primary/60 hover:bg-secondary/40 transition-colors grid grid-cols-[1fr_auto_auto] gap-3 items-center"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{varianteLabel(v) || "(sin opciones)"}</div>
                  {v.sku && (
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      SKU {v.sku}
                    </div>
                  )}
                </div>
                <div className="font-mono text-sm">{formatARS(v.precio_ars)}</div>
                <Plus size={14} className="text-primary" />
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewClienteDialog({
  open,
  defaultNombre,
  onClose,
  onCreated,
}: {
  open: boolean
  defaultNombre: string
  onClose: () => void
  onCreated: (cliente: Cliente) => void
}) {
  const [pending, start] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    start(async () => {
      const r = await createCliente(fd)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      // Construct the new Cliente from form data (we have the id from the action)
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
          <DialogDescription>
            Mínimo el nombre. Los demás campos los podés completar después desde Clientes.
          </DialogDescription>
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
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear y seleccionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function QuickField({
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

function SectionHeader({
  title,
  sub,
  right,
}: {
  title: string
  sub?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {sub && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{sub}</span>}
      <div className="flex-1" />
      {typeof right === "string" ? (
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{right}</span>
      ) : (
        right
      )}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className={cn("text-xs", mono && "font-mono", !value && "text-muted-foreground")}>
        {value || "—"}
      </div>
    </div>
  )
}

function TotalRow({
  label,
  ars,
  dolarVenta,
}: {
  label: string
  ars: number
  dolarVenta: number
}) {
  const usd = ars / (dolarVenta || 1)
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">
        {formatARS(ars)}{" "}
        <small className="text-muted-foreground">· {formatUSD(usd)}</small>
      </span>
    </div>
  )
}

function EstadoChip({ estado }: { estado: EstadoCotizacion }) {
  const styles: Record<EstadoCotizacion, string> = {
    borrador: "bg-muted text-muted-foreground border-border",
    enviada: "bg-[color:var(--arean-info)]/15 text-[color:var(--arean-info)] border-[color:var(--arean-info)]/30",
    aceptada: "bg-primary/15 text-primary border-primary/30",
    rechazada: "bg-destructive/15 text-destructive border-destructive/30",
    vencida: "bg-[color:var(--arean-warn)]/15 text-[color:var(--arean-warn)] border-[color:var(--arean-warn)]/30",
  }
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border", styles[estado])}>
      {estado}
    </span>
  )
}

function CatalogoPane({
  productos,
  sources,
  productosEnCotizacion,
  onProductClick,
}: {
  productos: Producto[]
  sources: Source[]
  productosEnCotizacion: Set<string>
  onProductClick: (p: Producto) => void
}) {
  const [q, setQ] = useState("")
  const [marca, setMarca] = useState<string>("todos")

  // List of available marca filters: each source slug + "manual" if any manual exists
  const marcasDisponibles = useMemo(() => {
    const result = sources.map((s) => ({ slug: s.slug, label: s.nombre }))
    if (productos.some((p) => p.marca === "manual")) {
      result.push({ slug: "manual", label: "Manual" })
    }
    return result
  }, [sources, productos])

  const filtered = useMemo(() => {
    let list = productos
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
  }, [productos, marca, q])

  return (
    <>
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-sm font-medium">Catálogo</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2 px-2.5 h-9 border border-border rounded-md bg-card mb-2.5">
          <Search size={13} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar"
            className="flex-1 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <CatChip active={marca === "todos"} onClick={() => setMarca("todos")} label="Todos" />
          {marcasDisponibles.map((m) => (
            <CatChip key={m.slug} active={marca === m.slug} onClick={() => setMarca(m.slug)} label={m.label} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-1.5">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            Ningún producto coincide
          </div>
        ) : (
          filtered.map((p) => (
            <CatalogCard
              key={p.id}
              producto={p}
              sources={sources}
              inCart={productosEnCotizacion.has(p.id)}
              onClick={() => onProductClick(p)}
            />
          ))
        )}
      </div>
    </>
  )
}

function CatChip({
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
        "h-7 px-2.5 rounded text-[11px] font-medium border transition-colors",
        active
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-card text-muted-foreground border-border hover:bg-secondary"
      )}
    >
      {label}
    </button>
  )
}

function CatalogCard({
  producto,
  sources,
  inCart,
  onClick,
}: {
  producto: Producto
  sources: Source[]
  inCart: boolean
  onClick: () => void
}) {
  const variantes = getVariantes(producto)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left px-3 py-2 rounded border border-border bg-card hover:border-primary/60 hover:bg-secondary/40 transition-colors group",
        inCart && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-1.5 mb-0.5">
        <div className="text-[12px] font-medium leading-tight flex-1 line-clamp-2">
          {producto.nombre}
        </div>
        {inCart && <Check size={12} className="text-primary shrink-0 mt-0.5" />}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground mb-1 truncate">
        {producto.sku ?? "—"} · {marcaLabel(producto.marca, sources)}
        {variantes.length > 0 && <span className="text-primary"> · {variantes.length} var.</span>}
      </div>
      <div className="font-mono text-xs">
        {variantes.length > 0 ? "desde " : ""}{formatARS(Number(producto.precio_origen))}
      </div>
    </button>
  )
}

function PreviewPane({
  numero,
  cliente,
  fecha,
  validezDias,
  productoItems,
  manoObras,
  totals,
  configuracion,
  mostrarUsd = true,
  condicionesPago = "",
  condiciones = "",
}: {
  numero: string
  cliente: Cliente | null
  fecha: string
  validezDias: number
  productoItems: ProductoItem[]
  manoObras: ManoObraItem[]
  totals: {
    subProductos: number
    subMo: number
    total: number
    totalUsd: number
  }
  configuracion: Configuracion
  mostrarUsd?: boolean
  condicionesPago?: string
  condiciones?: string
}) {
  const fechaVencimiento = new Date(fecha)
  fechaVencimiento.setDate(fechaVencimiento.getDate() + validezDias)

  return (
    <div className="h-full flex flex-col p-5 min-h-0">
      <div className="flex items-baseline gap-2 mb-4 shrink-0">
        <h3 className="text-sm font-medium">Vista previa PDF</h3>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">en vivo</span>
      </div>

      {/* Paper — always cream/white regardless of theme — stretches to fill */}
      <div className="flex-1 min-h-0 overflow-auto rounded-md p-5 text-[11px] leading-relaxed shadow-sm bg-[oklch(0.99_0.008_80)] text-[oklch(0.22_0.008_145)] border border-[oklch(0.85_0.012_80)] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-[oklch(0.85_0.012_80)]">
          <div>
            <div className="text-base font-semibold tracking-tight">{configuracion.razon_social}</div>
            {configuracion.cuit && (
              <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)] mt-0.5">
                CUIT {configuracion.cuit}
              </div>
            )}
            <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)]">
              {configuracion.email ?? ""} · {configuracion.telefono ?? ""}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)] uppercase tracking-wider">Cotización N°</div>
            <div className="font-mono text-base">{numero}</div>
            <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)]">
              emitida {new Date(fecha).toLocaleDateString("es-AR")}
            </div>
            <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)]">
              válida hasta {fechaVencimiento.toLocaleDateString("es-AR")}
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-4">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[oklch(0.45_0.010_145)]">Cliente</div>
          {cliente ? (
            <>
              <div className="font-medium">{cliente.nombre}</div>
              {cliente.cuit_dni && <div className="font-mono text-[10px] text-[oklch(0.45_0.010_145)]">{cliente.cuit_dni}</div>}
              {cliente.direccion && <div className="text-[10px] text-[oklch(0.45_0.010_145)]">{cliente.direccion}</div>}
            </>
          ) : (
            <div className="text-[oklch(0.60_0.010_145)] italic">(seleccionar cliente)</div>
          )}
        </div>

        {/* Items */}
        <table className="w-full text-[10px] mb-3">
          <thead>
            <tr className="border-b border-[oklch(0.85_0.012_80)]">
              <th className="text-left font-medium py-1">Concepto</th>
              <th className="text-right font-medium py-1 w-10">Cant.</th>
              <th className="text-right font-medium py-1 w-16">P. unit</th>
              <th className="text-right font-medium py-1 w-20">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {productoItems.length === 0 && manoObras.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-[oklch(0.60_0.010_145)] py-3 italic">
                  (sin ítems todavía)
                </td>
              </tr>
            )}
            {productoItems.map((it) => (
              <tr key={it.uid} className="border-b border-[oklch(0.90_0.010_80)]">
                <td className="py-1.5 pr-2">
                  <div className="font-medium">{it.nombre}</div>
                  {it.aclaracion && (
                    <div className="text-[9px] text-[oklch(0.48_0.010_145)] mt-0.5 leading-snug">
                      {it.aclaracion}
                    </div>
                  )}
                  {it.url_producto && (
                    <a
                      href={it.url_producto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[8px] text-[oklch(0.48_0.13_155)] truncate block max-w-[160px]"
                    >
                      ver en {it.marca}
                    </a>
                  )}
                </td>
                <td className="text-right font-mono py-1.5">{it.cantidad}</td>
                <td className="text-right font-mono py-1.5">{formatARS(it.precio_unitario_ars)}</td>
                <td className="text-right font-mono py-1.5 font-medium">{formatARS(it.precio_unitario_ars * it.cantidad)}</td>
              </tr>
            ))}
            {manoObras.map(
              (m) =>
                (m.concepto.trim() || m.monto > 0) && (
                  <tr key={m.uid} className="border-b border-[oklch(0.90_0.010_80)]">
                    <td className="py-1.5 pr-2">
                      <div className="italic font-medium">{m.concepto || "Mano de obra"}</div>
                      {m.aclaracion && (
                        <div className="text-[9px] text-[oklch(0.48_0.010_145)] not-italic mt-0.5 leading-snug">
                          {m.aclaracion}
                        </div>
                      )}
                    </td>
                    <td className="text-right font-mono py-1.5 text-[oklch(0.55_0.010_145)]">
                      {m.tiene_cantidad ? m.cantidad : "—"}
                    </td>
                    <td className="text-right font-mono py-1.5 text-[oklch(0.55_0.010_145)]">
                      {m.tiene_cantidad ? formatARS(m.precio_unitario || 0) : "—"}
                    </td>
                    <td className="text-right font-mono py-1.5 font-medium">
                      {formatARS(m.tiene_cantidad ? (m.cantidad || 1) * (m.precio_unitario || 0) : m.monto)}
                    </td>
                  </tr>
                )
            )}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end">
          <div className="w-1/2 text-[10px]">
            <div className="flex justify-between py-0.5">
              <span className="text-[oklch(0.45_0.010_145)]">Subtotal productos</span>
              <span className="font-mono">{formatARS(totals.subProductos)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[oklch(0.45_0.010_145)]">Mano de obra</span>
              <span className="font-mono">{formatARS(totals.subMo)}</span>
            </div>
            <div className="flex justify-between py-1 pt-2 border-t border-[oklch(0.85_0.012_80)] mt-1">
              <strong>Total</strong>
              <strong className="font-mono">{formatARS(totals.total)}</strong>
            </div>
            {mostrarUsd && (
              <div className="flex justify-between py-0.5">
                <span className="text-[oklch(0.45_0.010_145)]">en USD</span>
                <span className="font-mono text-[oklch(0.45_0.010_145)]">{formatUSD(totals.totalUsd)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Condiciones de pago */}
        {(() => {
          const textoPago = condicionesPago.trim()
          const hasBanco = configuracion.banco || configuracion.cbu_alias
          if (!textoPago && !hasBanco) return null
          return (
            <div className="mt-auto pt-3 border-t border-[oklch(0.85_0.012_80)] text-[9px] text-[oklch(0.45_0.010_145)] leading-snug">
              <div className="font-semibold uppercase tracking-wider mb-0.5 text-[8px] text-[oklch(0.40_0.010_145)]">
                Condiciones de pago
              </div>
              {textoPago && <div className="text-[10px] text-[oklch(0.22_0.008_145)]">{textoPago}</div>}
              {hasBanco && (
                <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)] mt-0.5">
                  {configuracion.banco ?? ""}
                  {configuracion.banco && configuracion.cbu_alias ? " · " : ""}
                  {configuracion.cbu_alias ? `CBU/Alias: ${configuracion.cbu_alias}` : ""}
                </div>
              )}
            </div>
          )
        })()}

        {/* Términos y condiciones adicionales */}
        {condiciones && condiciones.trim().length > 0 && (
          <div className="pt-2 border-t border-[oklch(0.90_0.010_80)] text-[9px] text-[oklch(0.45_0.010_145)] leading-snug whitespace-pre-line mt-2">
            <div className="font-semibold uppercase tracking-wider mb-0.5 text-[8px] text-[oklch(0.40_0.010_145)]">
              Condiciones
            </div>
            {condiciones.trim()}
          </div>
        )}
      </div>

      <div className="mt-3 font-mono text-[10px] text-muted-foreground text-center shrink-0">
        <FilePenLine size={11} className="inline mr-1" />
        Preview en HTML · el PDF descargable se arma con react-pdf
      </div>
    </div>
  )
}
