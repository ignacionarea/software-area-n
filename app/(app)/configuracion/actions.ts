"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result = { ok: true } | { ok: false; error: string }

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function numOrDefault(v: FormDataEntryValue | null, def: number): number {
  if (v == null) return def
  const n = Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : def
}

export async function saveFiscal(formData: FormData): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("configuracion")
    .update({
      razon_social: strOrNull(formData.get("razon_social")) ?? "Area N",
      cuit: strOrNull(formData.get("cuit")),
      categoria_afip: strOrNull(formData.get("categoria_afip")),
      condicion_iva: strOrNull(formData.get("condicion_iva")) ?? "Monotributo",
      fecha_inicio_actividad: strOrNull(formData.get("fecha_inicio_actividad")),
      email: strOrNull(formData.get("email")),
      telefono: strOrNull(formData.get("telefono")),
      direccion: strOrNull(formData.get("direccion")),
    })
    .eq("id", true)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/configuracion")
  return { ok: true }
}

export async function savePdfLegal(formData: FormData): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("configuracion")
    .update({
      texto_legal_pdf: strOrNull(formData.get("texto_legal_pdf")),
      condiciones_pago: strOrNull(formData.get("condiciones_pago")),
      validez_default_dias: Math.max(1, Math.round(numOrDefault(formData.get("validez_default_dias"), 7))),
      comision_porcentaje: Math.min(100, Math.max(0, numOrDefault(formData.get("comision_porcentaje"), 10))),
      banco: strOrNull(formData.get("banco")),
      cbu_alias: strOrNull(formData.get("cbu_alias")),
    })
    .eq("id", true)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/configuracion")
  return { ok: true }
}
