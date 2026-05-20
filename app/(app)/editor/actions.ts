"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type EstadoCotizacion = Database["public"]["Enums"]["estado_cotizacion"]
type TipoItem = Database["public"]["Enums"]["tipo_item"]

export type EditorItemInput = {
  tipo: TipoItem
  producto_id: string | null
  concepto: string
  cantidad: number
  precio_unitario_ars: number
  url_producto: string | null
}

export type EditorPayload = {
  id?: string
  cliente_id: string | null
  fecha_emision: string
  validez_dias: number
  cotizacion_dolar: number
  notas: string | null
  estado?: EstadoCotizacion
  items: EditorItemInput[]
}

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

function toUsd(ars: number, dolar: number): number {
  if (dolar <= 0) return 0
  return Number((ars / dolar).toFixed(2))
}

async function replaceItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cotId: string,
  items: EditorItemInput[],
  dolar: number
): Promise<string | null> {
  // Replace strategy: delete all + insert new. Simpler than diff/patch.
  const { error: delErr } = await supabase.from("items_cotizacion").delete().eq("cotizacion_id", cotId)
  if (delErr) return delErr.message

  if (items.length === 0) return null

  const rows = items.map((i, idx) => ({
    cotizacion_id: cotId,
    tipo: i.tipo,
    producto_id: i.tipo === "producto" ? i.producto_id : null,
    concepto: i.concepto,
    cantidad: i.cantidad,
    precio_unitario_ars: i.precio_unitario_ars,
    precio_unitario_usd: toUsd(i.precio_unitario_ars, dolar),
    url_producto: i.url_producto,
    orden: idx,
  }))

  const { error: insErr } = await supabase.from("items_cotizacion").insert(rows)
  return insErr?.message ?? null
}

export async function saveCotizacion(payload: EditorPayload): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const targetEstado: EstadoCotizacion = payload.estado ?? "borrador"

  if (payload.id) {
    // Update existing
    const { error: updErr } = await supabase
      .from("cotizaciones")
      .update({
        cliente_id: payload.cliente_id,
        fecha_emision: payload.fecha_emision,
        validez_dias: payload.validez_dias,
        cotizacion_dolar: payload.cotizacion_dolar,
        notas: payload.notas,
        estado: targetEstado,
      })
      .eq("id", payload.id)
    if (updErr) return { ok: false, error: updErr.message }

    const itemsErr = await replaceItems(supabase, payload.id, payload.items, payload.cotizacion_dolar)
    if (itemsErr) return { ok: false, error: itemsErr }

    revalidatePath("/cotizaciones")
    revalidatePath(`/editor/${payload.id}`)
    revalidatePath("/dashboard")
    return { ok: true, data: { id: payload.id } }
  }

  // Insert new
  const { data: cot, error: insErr } = await supabase
    .from("cotizaciones")
    .insert({
      cliente_id: payload.cliente_id,
      fecha_emision: payload.fecha_emision,
      validez_dias: payload.validez_dias,
      cotizacion_dolar: payload.cotizacion_dolar,
      notas: payload.notas,
      estado: targetEstado,
    })
    .select("id")
    .single()
  if (insErr || !cot) return { ok: false, error: insErr?.message ?? "No se pudo crear" }

  const itemsErr = await replaceItems(supabase, cot.id, payload.items, payload.cotizacion_dolar)
  if (itemsErr) return { ok: false, error: itemsErr }

  revalidatePath("/cotizaciones")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: cot.id } }
}

export async function saveAndGo(payload: EditorPayload): Promise<void> {
  const r = await saveCotizacion(payload)
  if (!r.ok) throw new Error(r.error)
  redirect(`/editor/${r.data.id}`)
}
