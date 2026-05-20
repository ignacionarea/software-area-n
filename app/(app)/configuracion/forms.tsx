"use client"

import { useEffect, useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Save, Plus, Pencil, Trash2, Play, RefreshCw } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  saveFiscal, savePdfLegal, saveScrapeSource, deleteScrapeSource,
  toggleScrapeSourceActivo, runScrapeSource, type ScrapeSourceInput,
} from "./actions"
import type { Database } from "@/types/database"

type Config = Database["public"]["Tables"]["configuracion"]["Row"]
type ScrapeSource = Database["public"]["Tables"]["scrape_sources"]["Row"]

export function ConfigForms({
  config,
  ultimaCotizacion,
  proximoNumero,
  userEmail,
  sources,
}: {
  config: Config
  ultimaCotizacion: { numero: number; cliente: string | null; fecha: string | null } | null
  proximoNumero: number
  userEmail: string
  sources: ScrapeSource[]
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
            <ScrapingPanel sources={sources} />
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

function ScrapingPanel({ sources }: { sources: ScrapeSource[] }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; editing: ScrapeSource | null }>({ open: false, editing: null })
  const [pending, start] = useTransition()
  const [runningSlug, setRunningSlug] = useState<string | null>(null)

  function onToggle(s: ScrapeSource) {
    start(async () => {
      const r = await toggleScrapeSourceActivo(s.id, !s.activo)
      if (!r.ok) toast.error("No se pudo cambiar el estado", { description: r.error })
      else router.refresh()
    })
  }

  function onDelete(s: ScrapeSource) {
    if (!confirm(`¿Eliminar la fuente "${s.nombre}"? Si tiene productos sincronizados, no se va a poder eliminar.`)) return
    start(async () => {
      const r = await deleteScrapeSource(s.id)
      if (!r.ok) toast.error("No se pudo eliminar", { description: r.error })
      else {
        toast.success("Fuente eliminada")
        router.refresh()
      }
    })
  }

  async function onRun(s: ScrapeSource) {
    if (!s.activo) {
      toast.error("Activá la fuente primero")
      return
    }
    setRunningSlug(s.slug)
    toast.loading(`Scrapeando ${s.nombre}…`, { id: `run-${s.slug}`, description: "Puede tardar entre 30 segundos y 2 minutos." })
    const r = await runScrapeSource(s.slug)
    setRunningSlug(null)
    if (!r.ok) {
      toast.error(`Falló el scrape de ${s.nombre}`, { id: `run-${s.slug}`, description: r.error })
      return
    }
    toast.success(`${s.nombre} actualizada`, {
      id: `run-${s.slug}`,
      description: `${r.data.scraped} productos · ${r.data.inserted} nuevos · ${r.data.updated} actualizados`,
    })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-border rounded-lg bg-card">
        <div className="flex items-baseline gap-2 px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Fuentes de scraping</span>
          <span className="text-xs text-muted-foreground">{sources.length} configurada(s)</span>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
            <Plus size={13} className="mr-1.5" />
            Agregar fuente
          </Button>
        </div>
        {sources.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No hay fuentes configuradas. Agregá una tienda Tienda Nube o WooCommerce para empezar a sincronizar productos.
          </div>
        ) : (
          <div className="flex flex-col">
            {sources.map((s) => (
              <SourceRow
                key={s.id}
                source={s}
                running={runningSlug === s.slug || pending}
                onEdit={() => setDialog({ open: true, editing: s })}
                onDelete={() => onDelete(s)}
                onToggle={() => onToggle(s)}
                onRun={() => onRun(s)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        El cron automático corre todos los días a las 10:00 ART (en Vercel). Las fuentes <strong>desactivadas</strong> se saltean.
        El botón <em>Ejecutar</em> dispara un scrape inmediato de esa fuente.
      </p>

      <SourceDialog
        open={dialog.open}
        editing={dialog.editing}
        onClose={() => setDialog({ open: false, editing: null })}
        onSaved={() => {
          setDialog({ open: false, editing: null })
          router.refresh()
        }}
      />
    </div>
  )
}

function SourceRow({
  source,
  running,
  onEdit,
  onDelete,
  onToggle,
  onRun,
}: {
  source: ScrapeSource
  running: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onRun: () => void
}) {
  const lastRunText = (() => {
    if (!source.last_run_at) return "Nunca ejecutado"
    const d = new Date(source.last_run_at)
    const diff = Date.now() - d.getTime()
    const hr = Math.floor(diff / 3600000)
    const stem =
      hr < 1 ? "hace pocos minutos" : hr < 24 ? `hace ${hr} h` : `hace ${Math.floor(hr / 24)} d`
    if (source.last_run_ok === false) return `Error ${stem}: ${source.last_run_error ?? "?"}`
    return `${stem} · ${source.last_run_count ?? 0} productos`
  })()
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 border-t border-border first:border-t-0", !source.activo && "opacity-60")}>
      <Checkbox checked={source.activo} onCheckedChange={onToggle} disabled={running} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{source.nombre}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {source.platform}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">· {source.slug}</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">{source.url_base}</div>
        <div
          className={cn(
            "font-mono text-[10px] mt-0.5",
            source.last_run_ok === false ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {lastRunText}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRun} disabled={running || !source.activo} title="Ejecutar ahora">
        {running ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onEdit} disabled={running} title="Editar">
        <Pencil size={13} />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={running} title="Eliminar">
        <Trash2 size={13} />
      </Button>
    </div>
  )
}

function SourceDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: ScrapeSource | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, start] = useTransition()
  const [nombre, setNombre] = useState("")
  const [slug, setSlug] = useState("")
  const [urlBase, setUrlBase] = useState("")
  const [platform, setPlatform] = useState<"tiendanube" | "woocommerce">("tiendanube")
  const [activo, setActivo] = useState(true)
  const [maxPages, setMaxPages] = useState(100)

  useEffect(() => {
    if (!open) return
    setNombre(editing?.nombre ?? "")
    setSlug(editing?.slug ?? "")
    setUrlBase(editing?.url_base ?? "")
    setPlatform((editing?.platform as "tiendanube" | "woocommerce") ?? "tiendanube")
    setActivo(editing?.activo ?? true)
    setMaxPages(editing?.max_pages ?? 100)
  }, [open, editing])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: ScrapeSourceInput = {
      id: editing?.id,
      slug,
      nombre,
      url_base: urlBase,
      platform,
      activo,
      max_pages: maxPages,
    }
    start(async () => {
      const r = await saveScrapeSource(input)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(editing ? "Fuente actualizada" : "Fuente creada")
      onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fuente" : "Agregar fuente de scraping"}</DialogTitle>
          <DialogDescription>
            Por ahora soporta tiendas de <strong>Tienda Nube</strong> (la mayoría de tiendas argentinas)
            y <strong>WooCommerce</strong> (como Sonoff). La página tiene que tener una ruta <code>/productos</code> que liste el catálogo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <FieldRow label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Demasled" required autoFocus />
          </FieldRow>
          <FieldRow label="URL base (sin / al final)">
            <Input
              value={urlBase}
              onChange={(e) => setUrlBase(e.target.value)}
              placeholder="https://demasled.com.ar"
              className="font-mono"
              required
            />
          </FieldRow>
          <div className="grid grid-cols-[1fr_140px_120px] gap-3">
            <FieldRow label="Slug (auto si vacío)">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="demasled"
                className="font-mono"
              />
            </FieldRow>
            <FieldRow label="Plataforma">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as "tiendanube" | "woocommerce")}
                className="h-10 px-3 rounded-md border border-input bg-transparent text-sm"
              >
                <option value="tiendanube">Tienda Nube</option>
                <option value="woocommerce">WooCommerce</option>
              </select>
            </FieldRow>
            <FieldRow label="Páginas máx.">
              <Input
                type="number"
                min={1}
                max={500}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value) || 100)}
                className="font-mono"
              />
            </FieldRow>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={activo} onCheckedChange={(v) => setActivo(v === true)} />
            <span>Activa (se ejecuta en el cron diario)</span>
          </label>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear fuente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
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
