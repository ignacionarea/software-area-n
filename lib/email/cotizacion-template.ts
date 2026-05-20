type TemplateInput = {
  clienteNombre: string
  numeroFormateado: string
  fechaEmision: string
  validezDias: number
  totalArs: string
  totalUsd: string
  razonSocial: string
  contactoEmail: string | null
  contactoTel: string | null
}

export function buildSubjectDefault(numero: string): string {
  return `Cotización ${numero} · Area N`
}

export function buildBodyDefault(i: TemplateInput): string {
  const vencimiento = computeVencimiento(i.fechaEmision, i.validezDias)
  return `Hola ${shortName(i.clienteNombre)},

Te pasamos la cotización para tu proyecto. La adjuntamos en formato PDF.

Resumen:
• N°: ${i.numeroFormateado}
• Fecha de emisión: ${formatDateAR(i.fechaEmision)}
• Válida hasta: ${formatDateAR(vencimiento)}
• Total: ${i.totalArs} (${i.totalUsd} al dólar oficial del día)

Cualquier consulta avisanos y la repasamos juntos.

Saludos,
${i.razonSocial}${i.contactoTel ? `\n${i.contactoTel}` : ""}${i.contactoEmail ? `\n${i.contactoEmail}` : ""}`
}

/** Convert plain text body to a minimally-styled HTML body (preserves line breaks). */
export function bodyToHtml(plain: string, razonSocial: string): string {
  const escaped = plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const paragraphs = escaped.split(/\n\n+/).map(
    (p) =>
      `<p style="margin:0 0 14px 0;line-height:1.5;color:#1a1a1a;">${p.replace(/\n/g, "<br/>")}</p>`
  )
  return `<!doctype html>
<html lang="es"><body style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#1a1a1a;background:#f6f5f0;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e2d8;border-radius:8px;padding:28px;">
    <div style="border-bottom:2px solid #2BD990;padding-bottom:12px;margin-bottom:18px;">
      <div style="font-size:18px;font-weight:600;color:#051510;letter-spacing:-0.01em;">${escapeHtml(razonSocial)}</div>
      <div style="font-size:11px;color:#647069;text-transform:uppercase;letter-spacing:0.08em;margin-top:3px;">Domótica · Automatización</div>
    </div>
    ${paragraphs.join("\n    ")}
    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#999;">
      El PDF de la cotización va adjunto a este mail.
    </div>
  </div>
</body></html>`
}

function shortName(nombre: string): string {
  const first = nombre.trim().split(/\s+/)[0]
  return first || nombre
}

function formatDateAR(iso: string): string {
  const d = new Date(iso + (iso.includes("T") ? "" : "T12:00:00"))
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(d)
}

function computeVencimiento(fechaIso: string, validezDias: number): string {
  const d = new Date(fechaIso + "T12:00:00")
  d.setDate(d.getDate() + validezDias)
  return d.toISOString().slice(0, 10)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
