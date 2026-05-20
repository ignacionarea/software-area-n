"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Mail, Paperclip, Send } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { buildSubjectDefault, buildBodyDefault } from "@/lib/email/cotizacion-template"
import { formatARS, formatUSD } from "@/lib/format"
import { sendCotizacionByEmail } from "@/app/(app)/cotizaciones/actions"

export type SendCotizacionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cotizacionId: string
  defaultTo: string
  clienteNombre: string
  numeroFormateado: string
  fechaEmision: string
  validezDias: number
  totalArs: number
  totalUsd: number
  razonSocial: string
  contactoEmail: string | null
  contactoTel: string | null
  onSent?: () => void
}

export function SendCotizacionDialog(props: SendCotizacionDialogProps) {
  const [pending, start] = useTransition()
  const [to, setTo] = useState(props.defaultTo)
  const [subject, setSubject] = useState(() => buildSubjectDefault(props.numeroFormateado))
  const [body, setBody] = useState(() =>
    buildBodyDefault({
      clienteNombre: props.clienteNombre,
      numeroFormateado: props.numeroFormateado,
      fechaEmision: props.fechaEmision,
      validezDias: props.validezDias,
      totalArs: formatARS(props.totalArs),
      totalUsd: formatUSD(props.totalUsd),
      razonSocial: props.razonSocial,
      contactoEmail: props.contactoEmail,
      contactoTel: props.contactoTel,
    })
  )

  // When dialog opens or props change, re-prefill (in case user changed cotización)
  useEffect(() => {
    if (props.open) {
      setTo(props.defaultTo)
      setSubject(buildSubjectDefault(props.numeroFormateado))
      setBody(
        buildBodyDefault({
          clienteNombre: props.clienteNombre,
          numeroFormateado: props.numeroFormateado,
          fechaEmision: props.fechaEmision,
          validezDias: props.validezDias,
          totalArs: formatARS(props.totalArs),
          totalUsd: formatUSD(props.totalUsd),
          razonSocial: props.razonSocial,
          contactoEmail: props.contactoEmail,
          contactoTel: props.contactoTel,
        })
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.cotizacionId])

  function handleSend() {
    if (!to.trim()) {
      toast.error("Falta el mail del destinatario")
      return
    }
    if (!subject.trim()) {
      toast.error("Falta el asunto")
      return
    }
    start(async () => {
      toast.loading("Enviando mail…", { id: "send-cot" })
      const logoUrl = `${window.location.origin}/logo.png`
      const r = await sendCotizacionByEmail({
        cotizacionId: props.cotizacionId,
        to: to.trim(),
        subject: subject.trim(),
        body,
        logoUrl,
      })
      if (!r.ok) {
        toast.error("No se pudo enviar", { id: "send-cot", description: r.error })
        return
      }
      toast.success(`Cotización enviada a ${to.trim()}`, { id: "send-cot" })
      props.onOpenChange(false)
      props.onSent?.()
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={(o) => !pending && props.onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={16} />
            Enviar cotización {props.numeroFormateado}
          </DialogTitle>
          <DialogDescription>
            Se envía el mail desde Area N con el PDF adjunto. Las 4 cuentas autorizadas
            quedan con copia oculta (BCC) para que tengan el registro.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Para (To)">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="cliente@dominio.com"
              className="font-mono"
            />
          </Field>

          <Field label="Asunto">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>

          <Field label="Cuerpo del mail">
            <Textarea
              rows={11}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-sm font-sans"
            />
          </Field>

          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary/40 text-xs text-muted-foreground">
            <Paperclip size={13} />
            <span>Se adjunta automáticamente <strong>{props.numeroFormateado}.pdf</strong></span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            <Send size={13} className="mr-1.5" />
            {pending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
