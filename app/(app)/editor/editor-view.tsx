"use client"

import { useMemo, useRef, useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Search, Plus, Minus, X, Save, Send, Download, Package, FilePenLine, Check, Mail,
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
import { formatARS, formatUSD, formatCotizacionNumero } from "@/lib/format"
import type { Database } from "@/types/database"
import { saveCotizacion, saveAndGo, type EditorPayload, type EditorItemInput } from "./actions"

type Cliente = Database["public"]["Tables"]["clientes"]["Row"]
type Producto = Database["public"]["Tables"]["productos"]["Row"]
type Configuracion = Database["public"]["Tables"]["configuracion"]["Row"]
type Cotizacion = Database["public"]["Tables"]["cotizaciones"]["Row"]
type ItemRow = Database["public"]["Tables"]["items_cotizacion"]["Row"]
type EstadoCotizacion = Database["public"]["Enums"]["estado_cotizacion"]

type ProductoItem = {
  uid: string
  producto_id: string
  sku: string | null
  nombre: string
  categoria: string | null
  marca: string
  precio_unitario_ars: number
  cantidad: number
  url_producto: string | null
}

type ManoObraItem = {
  uid: string
  concepto: string
  monto: number
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function EditorView({
  clientes: clientesInitial,
  productos,
  configuracion,
  cotizacion,
  items: existingItems,
  dolarVenta,
}: {
  clientes: Cliente[]
  productos: Producto[]
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
  const [clienteId, setClienteId] = useState<string | null>(cotizacion?.cliente_id ?? null)
  const [fecha, setFecha] = useState<string>(cotizacion?.fecha_emision ?? today)
  const [validezDias, setValidezDias] = useState<number>(
    cotizacion?.validez_dias ?? configuracion.validez_default_dias
  )
  const [notas, setNotas] = useState<string>(cotizacion?.notas ?? "")
  const [estado] = useState<EstadoCotizacion>(cotizacion?.estado ?? "borrador")

  const [productoItems, setProductoItems] = useState<ProductoItem[]>(() =>
    existingItems
      .filter((i) => i.tipo === "producto")
      .map((i) => {
        const prod = productos.find((p) => p.id === i.producto_id)
        return {
          uid: i.id,
          producto_id: i.producto_id ?? "",
          sku: prod?.sku ?? null,
          nombre: i.concepto,
          categoria: prod?.categoria ?? null,
          marca: prod?.marca ?? "—",
          precio_unitario_ars: Number(i.precio_unitario_ars),
          cantidad: Number(i.cantidad),
          url_producto: i.url_producto,
        }
      })
  )
  const [manoObras, setManoObras] = useState<ManoObraItem[]>(() =>
    existingItems
      .filter((i) => i.tipo === "mano_obra")
      .map((i) => ({
        uid: i.id,
        concepto: i.concepto,
        monto: Number(i.precio_unitario_ars) * Number(i.cantidad),
      }))
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

  function addProducto(p: Producto) {
    setProductoItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === p.id)
      if (idx > -1) {
        toast.message(`+1 ${p.nombre}`)
        return prev.map((it, i) => (i === idx ? { ...it, cantidad: it.cantidad + 1 } : it))
      }
      toast.message(`Agregado: ${p.nombre}`)
      return [
        ...prev,
        {
          uid: uid(),
          producto_id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          categoria: p.categoria,
          marca: p.marca,
          precio_unitario_ars: Number(p.precio_origen),
          cantidad: 1,
          url_producto: p.url,
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
  function removeProducto(uidVal: string) {
    setProductoItems((prev) => prev.filter((i) => i.uid !== uidVal))
  }

  function addManoObra() {
    setManoObras((prev) => [...prev, { uid: uid(), concepto: "", monto: 0 }])
  }
  function updateMo(uidVal: string, patch: Partial<ManoObraItem>) {
    setManoObras((prev) => prev.map((m) => (m.uid === uidVal ? { ...m, ...patch } : m)))
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
        cantidad: 1,
        precio_unitario_ars: Number(m.monto) || 0,
        url_producto: null,
      })
    }
    return {
      id: cotizacion?.id,
      cliente_id: clienteId,
      fecha_emision: fecha,
      validez_dias: validezDias,
      cotizacion_dolar: cotizacion?.cotizacion_dolar ?? dolarVenta,
      notas: notas.trim() || null,
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
    const items = [
      ...productoItems.map((p) => ({
        tipo: "producto" as const,
        concepto: p.nombre,
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
          cantidad: 1,
          precio_unitario_ars: Number(m.monto) || 0,
          url_producto: null,
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
        cliente: clienteSeleccionado
          ? {
              nombre: clienteSeleccionado.nombre,
              cuit_dni: clienteSeleccionado.cuit_dni,
              email: clienteSeleccionado.email,
              telefono: clienteSeleccionado.telefono,
              direccion: clienteSeleccionado.direccion,
            }
          : null,
        items,
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
            productosEnCotizacion={new Set(productoItems.map((i) => i.producto_id))}
            onAdd={addProducto}
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
                    productoMatches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProducto(p)}
                        className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b border-border last:border-b-0 grid grid-cols-[1fr_auto_auto] gap-3 items-center"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.nombre}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {p.sku ?? "—"} · {p.marca} {p.categoria ? `· ${p.categoria}` : ""}
                          </div>
                        </div>
                        <div className="font-mono text-sm">{formatARS(Number(p.precio_origen))}</div>
                        <Plus size={14} className="text-primary" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border border-border rounded-md bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_120px_120px_40px] text-[11px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary/50 px-3 py-2">
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
                productoItems.map((it) => (
                  <div
                    key={it.uid}
                    className="grid grid-cols-[1fr_120px_120px_120px_40px] items-center px-3 py-2 border-t border-border"
                  >
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
                      className="w-7 h-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                      title="Quitar"
                    >
                      <X size={13} />
                    </button>
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
                      "grid grid-cols-[1fr_180px_40px] items-center gap-2 px-3 py-2.5",
                      idx > 0 && "border-t border-border"
                    )}
                  >
                    <Input
                      placeholder={`Concepto ${idx + 1}: ej "Instalación 8 puntos"`}
                      value={m.concepto}
                      onChange={(e) => updateMo(m.uid, { concepto: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="$ 0"
                      className="font-mono text-right"
                      value={m.monto || ""}
                      onChange={(e) => updateMo(m.uid, { monto: Number(e.target.value) || 0 })}
                    />
                    <button
                      type="button"
                      onClick={() => removeMo(m.uid)}
                      className="w-7 h-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                      title="Quitar"
                    >
                      <X size={13} />
                    </button>
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
          </section>

          {/* Notas internas */}
          <section>
            <SectionHeader title="Notas internas" sub="opcional · no aparece en el PDF" />
            <Textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Recordatorios, condiciones especiales con el cliente, etc."
              className="text-sm"
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
  productosEnCotizacion,
  onAdd,
}: {
  productos: Producto[]
  productosEnCotizacion: Set<string>
  onAdd: (p: Producto) => void
}) {
  const [q, setQ] = useState("")
  const [marca, setMarca] = useState<"todos" | "sonoff" | "demasled">("todos")

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
          <CatChip active={marca === "sonoff"} onClick={() => setMarca("sonoff")} label="Sonoff" />
          <CatChip active={marca === "demasled"} onClick={() => setMarca("demasled")} label="Demasled" />
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
              inCart={productosEnCotizacion.has(p.id)}
              onClick={() => onAdd(p)}
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
  inCart,
  onClick,
}: {
  producto: Producto
  inCart: boolean
  onClick: () => void
}) {
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
        {producto.sku ?? "—"} · {producto.marca === "sonoff" ? "Sonoff AR" : "Demasled"}
      </div>
      <div className="font-mono text-xs">{formatARS(Number(producto.precio_origen))}</div>
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
            <div className="font-mono text-[9px] text-[oklch(0.45_0.010_145)] mt-1">
              {configuracion.cuit ?? "—"} · {configuracion.condicion_iva}
            </div>
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
                <td className="py-1 pr-2">
                  <div>{it.nombre}</div>
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
                <td className="text-right font-mono py-1">{it.cantidad}</td>
                <td className="text-right font-mono py-1">{formatARS(it.precio_unitario_ars)}</td>
                <td className="text-right font-mono py-1">{formatARS(it.precio_unitario_ars * it.cantidad)}</td>
              </tr>
            ))}
            {manoObras.map(
              (m) =>
                (m.concepto.trim() || m.monto > 0) && (
                  <tr key={m.uid} className="border-b border-[oklch(0.90_0.010_80)]">
                    <td className="py-1 pr-2 italic">{m.concepto || "Mano de obra"}</td>
                    <td className="text-right font-mono py-1">1</td>
                    <td className="text-right font-mono py-1">{formatARS(m.monto)}</td>
                    <td className="text-right font-mono py-1">{formatARS(m.monto)}</td>
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
            <div className="flex justify-between py-0.5">
              <span className="text-[oklch(0.45_0.010_145)]">en USD</span>
              <span className="font-mono text-[oklch(0.45_0.010_145)]">{formatUSD(totals.totalUsd)}</span>
            </div>
          </div>
        </div>

        {/* Legal — anchored to bottom when paper has extra height */}
        {configuracion.texto_legal_pdf && (
          <div className="mt-auto pt-4 border-t border-[oklch(0.85_0.012_80)] text-[9px] text-[oklch(0.45_0.010_145)] leading-snug">
            {configuracion.texto_legal_pdf}
          </div>
        )}
      </div>

      <div className="mt-3 font-mono text-[10px] text-muted-foreground text-center shrink-0">
        <FilePenLine size={11} className="inline mr-1" />
        Preview en HTML · el PDF descargable se arma con react-pdf (próximo paso)
      </div>
    </div>
  )
}
