"use client"

import { useTransition, useState } from "react"
import { toast } from "sonner"
import { Check, Save } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { saveFiscal, savePdfLegal } from "./actions"
import type { Database } from "@/types/database"

type Config = Database["public"]["Tables"]["configuracion"]["Row"]

export function ConfigForms({
  config,
  ultimaCotizacion,
  proximoNumero,
  userEmail,
}: {
  config: Config
  ultimaCotizacion: { numero: number; cliente: string | null; fecha: string | null } | null
  proximoNumero: number
  userEmail: string
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <Tabs defaultValue="fiscal" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="fiscal">Datos fiscales</TabsTrigger>
            <TabsTrigger value="pdf">PDF y legales</TabsTrigger>
            <TabsTrigger value="scraping">Scraping</TabsTrigger>
            <TabsTrigger value="numeracion">Numeración</TabsTrigger>
            <TabsTrigger value="iva">IVA</TabsTrigger>
          </TabsList>

          <TabsContent value="fiscal" className="mt-4">
            <FiscalForm config={config} />
          </TabsContent>

          <TabsContent value="pdf" className="mt-4">
            <PdfLegalForm config={config} />
          </TabsContent>

          <TabsContent value="scraping" className="mt-4">
            <ScrapingPanel />
          </TabsContent>

          <TabsContent value="numeracion" className="mt-4">
            <NumeracionPanel proximoNumero={proximoNumero} ultimaCotizacion={ultimaCotizacion} />
          </TabsContent>

          <TabsContent value="iva" className="mt-4">
            <IvaPanel categoria={config.condicion_iva} />
          </TabsContent>
        </Tabs>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
        <Card title="Ayuda">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Estos datos aparecen en cada PDF emitido. Cambiar el CUIT o la categoría AFIP no
            recalcula cotizaciones ya enviadas: solo aplica de aquí en adelante.
          </p>
        </Card>
        <Card title="Operadores" sub="acceso al panel">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">Admin</div>
              <div className="font-mono text-[10px] text-muted-foreground truncate">{userEmail}</div>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">HOY</span>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3 opacity-60" disabled>
            Agregar empleado (próximamente)
          </Button>
        </Card>
      </aside>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">{title}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function FormCard({
  title,
  sub,
  action,
  children,
}: {
  title: string
  sub?: string
  action: (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>
  children: React.ReactNode
}) {
  const [pending, start] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const r = await action(fd)
      if (r.ok) {
        toast.success("Configuración guardada")
        setSavedAt(Date.now())
        setTimeout(() => setSavedAt(null), 2500)
      } else {
        toast.error("No se pudo guardar", { description: r.error })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="border border-border rounded-lg bg-card">
      <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">{title}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        <div className="flex-1" />
        {savedAt && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-primary">
            <Check size={12} /> Guardado
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-4">{children}</div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-secondary/30">
        <Button type="submit" disabled={pending}>
          <Save size={14} className="mr-1.5" />
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  )
}

function FiscalForm({ config }: { config: Config }) {
  return (
    <FormCard title="Razón social y datos fiscales" sub="aparecen en el PDF" action={saveFiscal}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Razón social" name="razon_social" defaultValue={config.razon_social} required />
        <Field label="CUIT" name="cuit" defaultValue={config.cuit ?? ""} mono placeholder="20-00000000-0" />
        <Field label="Condición frente al IVA" name="condicion_iva" defaultValue={config.condicion_iva} />
        <Field label="Categoría AFIP" name="categoria_afip" defaultValue={config.categoria_afip ?? ""} placeholder="Monotributo · Cat. F" />
        <Field label="Fecha inicio actividad" name="fecha_inicio_actividad" type="date" defaultValue={config.fecha_inicio_actividad ?? ""} mono />
        <Field label="Email comercial" name="email" type="email" defaultValue={config.email ?? ""} mono placeholder="contacto@arean.com.ar" />
        <Field label="Teléfono" name="telefono" defaultValue={config.telefono ?? ""} mono placeholder="+54 9 11 0000-0000" />
        <Field label="Dirección legal" name="direccion" defaultValue={config.direccion ?? ""} className="md:col-span-2" />
      </div>
    </FormCard>
  )
}

function PdfLegalForm({ config }: { config: Config }) {
  return (
    <FormCard title="Condiciones de pago y texto legal" action={savePdfLegal}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="texto_legal_pdf" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Texto legal (pie del PDF)
        </Label>
        <Textarea
          id="texto_legal_pdf"
          name="texto_legal_pdf"
          defaultValue={config.texto_legal_pdf ?? ""}
          rows={4}
          className="font-sans text-sm"
          placeholder="Cotización válida por el plazo indicado. Los productos se abonan directamente al proveedor…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="condiciones_pago" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Condiciones de pago
        </Label>
        <Textarea
          id="condiciones_pago"
          name="condiciones_pago"
          defaultValue={config.condiciones_pago ?? ""}
          rows={3}
          className="font-sans text-sm"
          placeholder="Mano de obra: 50% al iniciar trabajos, 50% contra entrega. Transferencia o efectivo."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Validez por defecto (días)"
          name="validez_default_dias"
          type="number"
          min="1"
          defaultValue={String(config.validez_default_dias)}
          mono
        />
        <Field
          label="Comisión productos (%)"
          name="comision_porcentaje"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={String(config.comision_porcentaje)}
          mono
        />
        <Field label="Banco" name="banco" defaultValue={config.banco ?? ""} placeholder="Banco Galicia" />
        <Field label="CBU o Alias" name="cbu_alias" defaultValue={config.cbu_alias ?? ""} mono placeholder="arean.bariloche.mp" />
      </div>
    </FormCard>
  )
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  mono,
  required,
  placeholder,
  className,
  step,
  min,
  max,
}: {
  label: string
  name: string
  defaultValue?: string
  type?: string
  mono?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  step?: string
  min?: string
  max?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className={mono ? "font-mono" : ""}
      />
    </div>
  )
}

function ScrapingPanel() {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-medium">Fuentes de productos</div>
        <div className="text-xs text-muted-foreground mt-0.5">Próximamente: scrape diario + botón de actualizar manual</div>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <SourceRow name="Sonoff Argentina" url="https://sonoffargentina.com/productos" disabled />
        <SourceRow name="Demasled" url="https://demasled.com.ar/" disabled />
        <SourceRow name="Dólar oficial venta" url="dolarapi.com/v1/dolares/oficial" status="ok" />
      </div>
    </div>
  )
}

function SourceRow({ name, url, disabled, status }: { name: string; url: string; disabled?: boolean; status?: "ok" }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border border-border rounded-md bg-secondary/30">
      <span
        className={
          "w-2 h-2 rounded-full " +
          (disabled
            ? "bg-muted-foreground"
            : status === "ok"
              ? "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_15%,transparent)]"
              : "bg-[color:var(--arean-warn)]")
        }
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">{url}</div>
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">{disabled ? "pendiente" : "activo"}</span>
    </div>
  )
}

function NumeracionPanel({
  proximoNumero,
  ultimaCotizacion,
}: {
  proximoNumero: number
  ultimaCotizacion: { numero: number; cliente: string | null; fecha: string | null } | null
}) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-medium">Numeración de cotizaciones</div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReadOnlyField label="Prefijo" value="CT-" mono />
        <ReadOnlyField label="Próximo número" value={`CT-${String(proximoNumero).padStart(5, "0")}`} mono accent />
        <ReadOnlyField label="Padding" value="5 dígitos" mono />
        <ReadOnlyField label="Reinicio anual" value="No" />
        <div className="md:col-span-2 px-3 py-2.5 rounded-md bg-secondary font-mono text-xs text-muted-foreground">
          {ultimaCotizacion
            ? `Última emitida: CT-${String(ultimaCotizacion.numero).padStart(5, "0")} (${ultimaCotizacion.cliente ?? "sin cliente"}${ultimaCotizacion.fecha ? `, ${ultimaCotizacion.fecha}` : ""})`
            : "Todavía no hay cotizaciones emitidas. La primera será CT-00088."}
        </div>
      </div>
    </div>
  )
}

function IvaPanel({ categoria }: { categoria: string }) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">Tratamiento de IVA</span>
        <span className="text-xs text-muted-foreground">se activa al pasar a Responsable Inscripto</span>
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div className="px-3 py-2.5 rounded-md border border-primary/40 bg-primary/10 text-sm">
          <strong>Categoría actual:</strong> {categoria} · IVA <em>no se discrimina</em> en el PDF.
          Los campos de IVA quedan listos en el código y se ocultan en la salida.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadOnlyField label="Alícuota productos" value="N/A (paga el cliente al proveedor)" />
          <ReadOnlyField label="Alícuota mano de obra" value="21% — al pasar a RI" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Estado</Label>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary text-xs">
              Monotributo · IVA oculto
            </span>
            <span className="px-2.5 py-1 rounded-md border border-border bg-secondary text-muted-foreground text-xs opacity-60">
              Resp. Inscripto · IVA discriminado
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyField({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div
        className={`px-3 py-2 rounded-md border border-border bg-secondary/40 text-sm ${mono ? "font-mono" : ""} ${accent ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  )
}
