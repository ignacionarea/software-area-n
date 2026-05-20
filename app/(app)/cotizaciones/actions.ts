"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type EstadoCotizacion = Database["public"]["Enums"]["estado_cotizacion"]
type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

export type PdfPayload = {
  numero: number
  fecha_emision: string
  validez_dias: number
  cotizacion_dolar: number
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
    cantidad: number
    precio_unitario_ars: number
    url_producto: string | null
    marca: "sonoff" | "demasled" | null
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

  return {
    ok: true,
    data: {
      numero: cot.numero,
      fecha_emision: cot.fecha_emision,
      validez_dias: cot.validez_dias,
      cotizacion_dolar: Number(cot.cotizacion_dolar),
      cliente: cot.clientes
        ? {
            nombre: cot.clientes.nombre,
            cuit_dni: cot.clientes.cuit_dni,
            email: cot.clientes.email,
            telefono: cot.clientes.telefono,
            direccion: cot.clientes.direccion,
          }
        : null,
      items: (items ?? []).map((i) => ({
        tipo: i.tipo,
        concepto: i.concepto,
        cantidad: Number(i.cantidad),
        precio_unitario_ars: Number(i.precio_unitario_ars),
        url_producto: i.url_producto,
        marca: (i.productos as { marca: "sonoff" | "demasled" } | null)?.marca ?? null,
      })),
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
