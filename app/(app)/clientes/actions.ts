"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

export async function createCliente(formData: FormData): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const nombre = strOrNull(formData.get("nombre"))
  if (!nombre) return { ok: false, error: "El nombre es obligatorio" }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre,
      telefono: strOrNull(formData.get("telefono")),
      email: strOrNull(formData.get("email")),
      direccion: strOrNull(formData.get("direccion")),
      cuit_dni: strOrNull(formData.get("cuit_dni")),
    })
    .select("id")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear" }
  revalidatePath("/clientes")
  return { ok: true, data: { id: data.id } }
}

export async function updateCliente(id: string, formData: FormData): Promise<Result> {
  const supabase = await createClient()
  const nombre = strOrNull(formData.get("nombre"))
  if (!nombre) return { ok: false, error: "El nombre es obligatorio" }

  const { error } = await supabase
    .from("clientes")
    .update({
      nombre,
      telefono: strOrNull(formData.get("telefono")),
      email: strOrNull(formData.get("email")),
      direccion: strOrNull(formData.get("direccion")),
      cuit_dni: strOrNull(formData.get("cuit_dni")),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/clientes")
  return { ok: true, data: undefined }
}

export async function deleteCliente(id: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.from("clientes").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/clientes")
  return { ok: true, data: undefined }
}
