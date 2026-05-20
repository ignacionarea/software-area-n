"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { runScrapers } from "@/lib/scrapers/run"

type Result = { ok: true } | { ok: false; error: string }
type ResultData<T> = { ok: true; data: T } | { ok: false; error: string }

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

// ─── Scrape sources ────────────────────────────────────────────────────

export type ScrapeSourceInput = {
  id?: string
  slug: string
  nombre: string
  url_base: string
  platform: "tiendanube" | "woocommerce"
  activo: boolean
  max_pages: number
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function saveScrapeSource(input: ScrapeSourceInput): Promise<ResultData<{ id: string }>> {
  if (!input.nombre.trim()) return { ok: false, error: "Falta el nombre" }
  if (!input.url_base.trim()) return { ok: false, error: "Falta la URL base" }
  let url = input.url_base.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  url = url.replace(/\/$/, "")

  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.nombre)
  if (!slug) return { ok: false, error: "Slug inválido" }

  const supabase = await createClient()
  const payload = {
    slug,
    nombre: input.nombre.trim(),
    url_base: url,
    platform: input.platform,
    activo: input.activo,
    max_pages: Math.max(1, Math.min(500, input.max_pages || 100)),
  }

  if (input.id) {
    const { error } = await supabase.from("scrape_sources").update(payload).eq("id", input.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/configuracion")
    revalidatePath("/productos")
    return { ok: true, data: { id: input.id } }
  }

  const { data, error } = await supabase.from("scrape_sources").insert(payload).select("id").single()
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear" }
  revalidatePath("/configuracion")
  revalidatePath("/productos")
  return { ok: true, data: { id: data.id } }
}

export async function deleteScrapeSource(id: string): Promise<Result> {
  const supabase = await createClient()
  const { data: source } = await supabase.from("scrape_sources").select("slug").eq("id", id).single()
  if (source) {
    const { count } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("marca", source.slug)
      .eq("es_manual", false)
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Hay ${count} productos sincronizados de esta fuente. Eliminalos primero o solo desactivá la fuente.`,
      }
    }
  }
  const { error } = await supabase.from("scrape_sources").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/configuracion")
  revalidatePath("/productos")
  return { ok: true }
}

export async function toggleScrapeSourceActivo(id: string, activo: boolean): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.from("scrape_sources").update({ activo }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/configuracion")
  revalidatePath("/productos")
  return { ok: true }
}

export async function runScrapeSource(
  slug: string
): Promise<ResultData<{ scraped: number; inserted: number; updated: number }>> {
  const results = await runScrapers({ slugs: [slug] })
  if (results.length === 0) return { ok: false, error: "Fuente no encontrada o inactiva" }
  const r = results[0]
  if (!r.ok) return { ok: false, error: r.errors.join(", ") || "Error desconocido" }
  revalidatePath("/configuracion")
  revalidatePath("/productos")
  return {
    ok: true,
    data: { scraped: r.scraped, inserted: r.inserted, updated: r.updated },
  }
}
