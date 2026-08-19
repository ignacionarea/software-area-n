"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import { getResend, getEmailFrom, getBccEmails } from "@/lib/email/resend"
import { bodyToHtml } from "@/lib/email/cotizacion-template"
import { renderCotizacionPdfToBuffer } from "@/lib/pdf/render-cotizacion"
import { formatCotizacionNumero, parseCotizacionNotas, serializeCotizacionNotas, type CotizacionMetadata } from "@/lib/format"

type EstadoCotizacion = Database["public"]["Enums"]["estado_cotizacion"]
type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

export type PdfPayload = {
  numero: number
  fecha_emision: string
  validez_dias: number
  cotizacion_dolar: number
  mostrar_usd: boolean
  condiciones_personalizadas: string | null
  condiciones_pago_personalizadas: string | null
  cliente: {
    nombre: string
    cuit_dni: string | null
    email: string | null
    telefono: string | null
    direccion: string | null
  } | null
  items: Array<{
    tipo: "producto" | "mano_obra"
    concepto: string
    aclaracion?: string | null
    tiene_cantidad?: boolean
    cantidad: number
    precio_unitario_ars: number
    url_producto: string | null
    marca: string | null
  }>
  configuracion: {
    razon_social: string
    cuit: string | null
    direccion: string | null
    email: string | null
    telefono: string | null
    condicion_iva: string
    texto_legal_pdf: string | null
    condiciones_pago: string | null
    banco: string | null
    cbu_alias: string | null
  }
}

export type SendEmailInput = {
  cotizacionId: string
  to: string
  subject: string
  body: string
  logoUrl: string
}

export async function sendCotizacionByEmail(input: SendEmailInput): Promise<Result<{ id: string }>> {
  const resend = getResend()
  if (!resend) {
    return { ok: false, error: "Falta configurar RESEND_API_KEY en las variables de entorno" }
  }
  if (!input.to.trim()) return { ok: false, error: "Falta el mail del destinatario" }

  const supabase = await createClient()
  const payloadRes = await getPdfPayload(input.cotizacionId)
  if (!payloadRes.ok) return { ok: false, error: payloadRes.error }
  const p = payloadRes.data

  const subtotalProductos = p.items
    .filter((i) => i.tipo === "producto")
    .reduce((s, i) => s + i.cantidad * i.precio_unitario_ars, 0)
  const subtotalManoObra = p.items
    .filter((i) => i.tipo === "mano_obra")
    .reduce((s, i) => s + i.cantidad * i.precio_unitario_ars, 0)
  const total = subtotalProductos + subtotalManoObra
  const totalUsd = total / (p.cotizacion_dolar || 1)
  const numeroStr = formatCotizacionNumero(p.numero)

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderCotizacionPdfToBuffer({
      numeroFormateado: numeroStr,
      fechaEmision: p.fecha_emision,
      validezDias: p.validez_dias,
      cotizacionDolar: p.cotizacion_dolar,
      mostrarUsd: p.mostrar_usd,
      condicionesPersonalizadas: p.condiciones_personalizadas,
      condicionesPagoPersonalizadas: p.condiciones_pago_personalizadas,
      cliente: p.cliente,
      items: p.items,
      subtotalProductos,
      subtotalManoObra,
      total,
      totalUsd,
      configuracion: p.configuracion,
      logoUrl: input.logoUrl,
    })
  } catch (e) {
    return { ok: false, error: `No se pudo generar el PDF: ${e instanceof Error ? e.message : String(e)}` }
  }

  const bcc = getBccEmails().filter((b) => b !== input.to.toLowerCase().trim())

  try {
    const { error: sendErr } = await resend.emails.send({
      from: getEmailFrom(),
      to: [input.to.trim()],
      bcc: bcc.length > 0 ? bcc : undefined,
      subject: input.subject,
      text: input.body,
      html: bodyToHtml(input.body, p.configuracion.razon_social),
      attachments: [
        {
          filename: `${numeroStr}.pdf`,
          content: pdfBuffer,
        },
      ],
    })
    if (sendErr) {
      return { ok: false, error: `Resend rechazó el envío: ${sendErr.message}` }
    }
  } catch (e) {
    return { ok: false, error: `Error al enviar: ${e instanceof Error ? e.message : String(e)}` }
  }

  // Marcar como enviada en DB
  await supabase
    .from("cotizaciones")
    .update({
      estado: "enviada",
      enviada_at: new Date().toISOString(),
      enviada_a: input.to.trim(),
    })
    .eq("id", input.cotizacionId)

  revalidatePath("/cotizaciones")
  revalidatePath(`/editor/${input.cotizacionId}`)
  revalidatePath("/dashboard")
  return { ok: true, data: { id: input.cotizacionId } }
}

export async function getPdfPayload(id: string): Promise<Result<PdfPayload>> {
  const supabase = await createClient()

  const [{ data: cot, error: cotErr }, { data: items, error: itemsErr }, { data: conf, error: confErr }] =
    await Promise.all([
      supabase
        .from("cotizaciones")
        .select("*, clientes(nombre, cuit_dni, email, telefono, direccion)")
        .eq("id", id)
        .single(),
      supabase
        .from("items_cotizacion")
        .select("*, productos(marca)")
        .eq("cotizacion_id", id)
        .order("orden"),
      supabase.from("configuracion").select("*").eq("id", true).single(),
    ])

  if (cotErr || !cot) return { ok: false, error: cotErr?.message ?? "No encontré la cotización" }
  if (itemsErr) return { ok: false, error: itemsErr.message }
  if (confErr || !conf) return { ok: false, error: confErr?.message ?? "No hay configuración" }

  const meta = parseCotizacionNotas(cot.notas)

  return {
    ok: true,
    data: {
      numero: cot.numero,
      fecha_emision: cot.fecha_emision,
      validez_dias: cot.validez_dias,
      cotizacion_dolar: Number(cot.cotizacion_dolar),
      mostrar_usd: meta.mostrarUsd ?? true,
      condiciones_personalizadas: meta.condiciones || null,
      condiciones_pago_personalizadas: meta.condicionesPago !== undefined && meta.condicionesPago !== "" ? meta.condicionesPago : null,
      cliente: cot.clientes
        ? {
            nombre: cot.clientes.nombre,
            cuit_dni: cot.clientes.cuit_dni,
            email: cot.clientes.email,
            telefono: cot.clientes.telefono,
            direccion: cot.clientes.direccion,
          }
        : null,
      items: (items ?? []).map((i) => {
        const lines = (i.concepto || "").split("\n")
        const concepto = lines[0] ?? ""
        const aclaracion = lines.slice(1).join("\n").trim() || null
        const isMo = i.tipo === "mano_obra"
        const tiene_cantidad = isMo ? Number(i.cantidad) > 1 : true
        return {
          tipo: i.tipo,
          concepto,
          aclaracion,
          tiene_cantidad,
          cantidad: Number(i.cantidad),
          precio_unitario_ars: Number(i.precio_unitario_ars),
          url_producto: i.url_producto,
          marca: (i.productos as { marca: string } | null)?.marca ?? null,
        }
      }),
      configuracion: {
        razon_social: conf.razon_social,
        cuit: conf.cuit,
        direccion: conf.direccion,
        email: conf.email,
        telefono: conf.telefono,
        condicion_iva: conf.condicion_iva,
        texto_legal_pdf: conf.texto_legal_pdf,
        condiciones_pago: conf.condiciones_pago,
        banco: conf.banco,
        cbu_alias: conf.cbu_alias,
      },
    },
  }
}

export async function changeEstado(
  id: string,
  estado: EstadoCotizacion
): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.from("cotizaciones").update({ estado }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/cotizaciones")
  revalidatePath("/dashboard")
  return { ok: true, data: undefined }
}

export async function deleteCotizacion(id: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.from("cotizaciones").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/cotizaciones")
  revalidatePath("/dashboard")
  return { ok: true, data: undefined }
}

export async function duplicateCotizacion(id: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()

  const { data: orig, error: origErr } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", id)
    .single()
  if (origErr || !orig) return { ok: false, error: origErr?.message ?? "No se encontró la cotización" }

  const { data: items, error: itemsErr } = await supabase
    .from("items_cotizacion")
    .select("*")
    .eq("cotizacion_id", id)
    .order("orden")
  if (itemsErr) return { ok: false, error: itemsErr.message }

  const today = new Date().toISOString().slice(0, 10)
  const { data: nueva, error: nuevaErr } = await supabase
    .from("cotizaciones")
    .insert({
      cliente_id: orig.cliente_id,
      cotizacion_dolar: orig.cotizacion_dolar,
      validez_dias: orig.validez_dias,
      notas: orig.notas,
      fecha_emision: today,
      estado: "borrador",
    })
    .select("id")
    .single()
  if (nuevaErr || !nueva) return { ok: false, error: nuevaErr?.message ?? "No se pudo duplicar" }

  if (items && items.length > 0) {
    const rows = items.map((i) => ({
      cotizacion_id: nueva.id,
      tipo: i.tipo,
      producto_id: i.producto_id,
      concepto: i.concepto,
      cantidad: i.cantidad,
      precio_unitario_ars: i.precio_unitario_ars,
      precio_unitario_usd: i.precio_unitario_usd,
      url_producto: i.url_producto,
      orden: i.orden,
    }))
    const { error: insErr } = await supabase.from("items_cotizacion").insert(rows)
    if (insErr) return { ok: false, error: insErr.message }
  }

  revalidatePath("/cotizaciones")
  return { ok: true, data: { id: nueva.id } }
}
