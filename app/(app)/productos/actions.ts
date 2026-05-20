"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

export type ManualProductoInput = {
  id?: string
  nombre: string
  sku: string | null
  marca: string
  categoria: string | null
  precio_origen: number
  moneda_origen: "ARS" | "USD"
  url: string | null
  imagen_url: string | null
  descripcion: string | null
}

export async function saveManualProducto(input: ManualProductoInput): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" }
  if (!input.marca.trim()) return { ok: false, error: "La marca es obligatoria" }
  if (input.precio_origen < 0) return { ok: false, error: "El precio no puede ser negativo" }

  const payload = {
    nombre: input.nombre.trim(),
    sku: input.sku?.trim() || null,
    marca: input.marca.trim(),
    categoria: input.categoria?.trim() || null,
    precio_origen: input.precio_origen,
    moneda_origen: input.moneda_origen,
    url: input.url?.trim() || null,
    imagen_url: input.imagen_url?.trim() || null,
    descripcion: input.descripcion?.trim() || null,
    activo: true,
    es_manual: true,
  }

  if (input.id) {
    const { error } = await supabase.from("productos").update(payload).eq("id", input.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/productos")
    return { ok: true, data: { id: input.id } }
  }

  const { data, error } = await supabase.from("productos").insert(payload).select("id").single()
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear" }
  revalidatePath("/productos")
  return { ok: true, data: { id: data.id } }
}

export async function deleteManualProducto(id: string): Promise<Result> {
  const supabase = await createClient()
  // Only allow deleting manual products — scraped ones get refreshed by the cron
  const { data: prod } = await supabase
    .from("productos")
    .select("es_manual, nombre")
    .eq("id", id)
    .single()
  if (!prod) return { ok: false, error: "Producto no encontrado" }
  if (!prod.es_manual) {
    return {
      ok: false,
      error: "Los productos del catálogo automático no se pueden eliminar (los re-scrappea el cron). Marcalos como descontinuados en su web.",
    }
  }
  const { error } = await supabase.from("productos").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/productos")
  return { ok: true, data: undefined }
}
