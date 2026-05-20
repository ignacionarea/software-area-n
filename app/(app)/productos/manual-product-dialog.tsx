"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveManualProducto } from "./actions"
import type { Database } from "@/types/database"

type Producto = Database["public"]["Tables"]["productos"]["Row"]

export function ManualProductDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: Producto | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, start] = useTransition()
  const [nombre, setNombre] = useState("")
  const [sku, setSku] = useState("")
  const [marca, setMarca] = useState("manual")
  const [categoria, setCategoria] = useState("")
  const [precio, setPrecio] = useState("")
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS")
  const [url, setUrl] = useState("")
  const [imagenUrl, setImagenUrl] = useState("")
  const [descripcion, setDescripcion] = useState("")

  useEffect(() => {
    if (open) {
      setNombre(editing?.nombre ?? "")
      setSku(editing?.sku ?? "")
      setMarca(editing?.marca ?? "manual")
      setCategoria(editing?.categoria ?? "")
      setPrecio(editing ? String(editing.precio_origen) : "")
      setMoneda((editing?.moneda_origen as "ARS" | "USD") ?? "ARS")
      setUrl(editing?.url ?? "")
      setImagenUrl(editing?.imagen_url ?? "")
      setDescripcion(editing?.descripcion ?? "")
    }
  }, [open, editing])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { toast.error("Falta el nombre"); return }
    const precioNum = Number(precio.replace(",", "."))
    if (!Number.isFinite(precioNum) || precioNum < 0) { toast.error("Precio inválido"); return }

    start(async () => {
      const r = await saveManualProducto({
        id: editing?.id,
        nombre: nombre.trim(),
        sku: sku || null,
        marca: marca || "manual",
        categoria: categoria || null,
        precio_origen: precioNum,
        moneda_origen: moneda,
        url: url || null,
        imagen_url: imagenUrl || null,
        descripcion: descripcion || null,
      })
      if (!r.ok) { toast.error(r.error); return }
      toast.success(editing ? "Producto actualizado" : "Producto creado")
      onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar producto manual" : "Agregar producto manual"}</DialogTitle>
          <DialogDescription>
            Para productos que no están en las páginas de proveedores (cables, accesorios, items custom, etc).
            Los productos manuales no se borran ni se sobreescriben con el scraping.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Nombre del producto">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder='Ej: "Cable HDMI 2m"' required autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU / Código (opcional)">
              <Input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="HDMI-2M" className="font-mono" />
            </Field>
            <Field label="Marca / Origen">
              <Input value={marca} onChange={(e) => setMarca(e.target.value.toLowerCase())} placeholder="manual" className="font-mono" />
            </Field>
          </div>

          <Field label="Categoría (opcional)">
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Cables, Accesorios, Iluminación…" />
          </Field>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Precio">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
                className="font-mono text-right"
                required
              />
            </Field>
            <Field label="Moneda">
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}
                className="h-10 px-3 rounded-md border border-input bg-transparent text-sm"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>

          <Field label="URL del producto (opcional)">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="font-mono"
            />
          </Field>

          <Field label="URL de la imagen (opcional)">
            <Input
              type="url"
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
              placeholder="https://…/imagen.jpg"
              className="font-mono"
            />
          </Field>

          <Field label="Descripción (opcional)">
            <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </Field>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              <Save size={13} className="mr-1.5" />
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
