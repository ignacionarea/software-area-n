"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import { CATEGORIES_CONFIG, EXPANSION_CATEGORY, type SurveyData, type SistemaTecnico } from "./categorias"
import { matchPreset } from "./presets"

type PpdEstado = Database["public"]["Enums"]["ppd_estado"]
type Result<T = void> = { ok: true; data: T } | { ok: false; error: string }

export type PpdPayload = {
  id?: string
  titulo: string
  descripcion: string | null
  cliente_id: string | null
  direccion_proyecto: string | null
  tecnico_relevador: string | null
  fecha_relevamiento: string | null
  estado?: PpdEstado
  survey: SurveyData
  notas: string | null
}

export async function savePpd(payload: PpdPayload): Promise<Result<{ id: string }>> {
  if (!payload.titulo.trim()) return { ok: false, error: "El título es obligatorio" }
  const supabase = await createClient()
  const targetEstado: PpdEstado = payload.estado ?? "borrador"

  const dbPayload = {
    titulo: payload.titulo,
    descripcion: payload.descripcion,
    cliente_id: payload.cliente_id,
    direccion_proyecto: payload.direccion_proyecto,
    tecnico_relevador: payload.tecnico_relevador,
    fecha_relevamiento: payload.fecha_relevamiento,
    estado: targetEstado,
    items: payload.survey as unknown as Database["public"]["Tables"]["ppd_proyectos"]["Insert"]["items"],
    notas: payload.notas,
  }

  if (payload.id) {
    const { error } = await supabase.from("ppd_proyectos").update(dbPayload).eq("id", payload.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/ppd")
    revalidatePath(`/ppd/${payload.id}`)
    return { ok: true, data: { id: payload.id } }
  }

  const { data, error } = await supabase.from("ppd_proyectos").insert(dbPayload).select("id").single()
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear" }
  revalidatePath("/ppd")
  return { ok: true, data: { id: data.id } }
}

export async function deletePpd(id: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.from("ppd_proyectos").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/ppd")
  return { ok: true, data: undefined }
}

export async function changeEstadoPpd(id: string, estado: PpdEstado): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.from("ppd_proyectos").update({ estado }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/ppd")
  revalidatePath(`/ppd/${id}`)
  return { ok: true, data: undefined }
}

const PAGE_SIZE = 1000
async function fetchAllActiveProducts(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: Database["public"]["Tables"]["productos"]["Row"][] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .gt("precio_origen", 0)
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

/** Convertir PPD en cotización borrador.
 *  Por cada sistema "applies", busca un producto del catálogo (vía preferredSku/keywords).
 *  Lo que no matchea queda anotado en `notas` de la cotización para que el dueño lo ajuste.
 */
export async function convertirAcotizacion(id: string): Promise<Result<{ cotizacionId: string }>> {
  const supabase = await createClient()

  const { data: ppd, error: ppdErr } = await supabase.from("ppd_proyectos").select("*").eq("id", id).single()
  if (ppdErr || !ppd) return { ok: false, error: ppdErr?.message ?? "PPD no encontrado" }
  if (!ppd.cliente_id) return { ok: false, error: "Asigná un cliente al PPD antes de convertirlo" }

  const survey = ppd.items as unknown as SurveyData
  if (!survey || typeof survey !== "object") return { ok: false, error: "El PPD está vacío" }

  // Dólar oficial venta para snapshot
  const dolarRes = await fetch("https://dolarapi.com/v1/dolares/oficial", { cache: "no-store" })
  let dolarVenta = 1000
  if (dolarRes.ok) {
    const d = (await dolarRes.json()) as { venta?: number }
    if (typeof d.venta === "number" && d.venta > 0) dolarVenta = d.venta
  }

  const { data: conf } = await supabase.from("configuracion").select("validez_default_dias").eq("id", true).single()
  const validez = conf?.validez_default_dias ?? 7

  const productos = await fetchAllActiveProducts(supabase)

  type Row = {
    tipo: "producto" | "mano_obra"
    producto_id: string | null
    concepto: string
    cantidad: number
    precio_unitario_ars: number
    precio_unitario_usd: number
    url_producto: string | null
    orden: number
  }
  const rows: Row[] = []
  const noMatched: string[] = []
  let orden = 0

  for (const [categoria, sistemas] of Object.entries(survey)) {
    const config = CATEGORIES_CONFIG[categoria] ?? []
    for (const sistema of sistemas) {
      if (!sistema.applies) continue
      if (categoria === EXPANSION_CATEGORY) {
        // Special case: just dump comments as an MO line
        rows.push({
          tipo: "mano_obra",
          producto_id: null,
          concepto: `Obra: ${sistema.name}${sistema.comments ? ` — ${sistema.comments}` : ""}`,
          cantidad: 1,
          precio_unitario_ars: 0,
          precio_unitario_usd: 0,
          url_producto: null,
          orden: orden++,
        })
        continue
      }
      const techDef: SistemaTecnico | undefined = config.find((s) => s.name === sistema.name)
      const presetCompat = techDef
        ? { id: sistema.name, label: sistema.name, hint: "", preferredSku: techDef.preferredSku, keywords: techDef.keywords }
        : null
      const matched = presetCompat ? matchPreset(presetCompat, productos) : null
      if (matched) {
        const ars = Number(matched.precio_origen)
        rows.push({
          tipo: "producto",
          producto_id: matched.id,
          concepto: matched.nombre,
          cantidad: sistema.quantity,
          precio_unitario_ars: ars,
          precio_unitario_usd: dolarVenta > 0 ? Number((ars / dolarVenta).toFixed(2)) : 0,
          url_producto: matched.url,
          orden: orden++,
        })
      } else {
        noMatched.push(`${sistema.name} (${categoria}, x${sistema.quantity}, ${sistema.environment})`)
      }
    }
  }

  // Compose notes for the cotización: PPD reference + non-matched systems
  const notas = [
    `Generado desde PPD: "${ppd.titulo}"`,
    ppd.notas ? `Notas del PPD: ${ppd.notas}` : null,
    noMatched.length > 0
      ? `Sistemas sin match automático (agregar mano de obra manual): ${noMatched.join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  // Create cotización + items
  const { data: cot, error: cotErr } = await supabase
    .from("cotizaciones")
    .insert({
      cliente_id: ppd.cliente_id,
      cotizacion_dolar: dolarVenta,
      validez_dias: validez,
      notas,
      estado: "borrador",
    })
    .select("id")
    .single()
  if (cotErr || !cot) return { ok: false, error: cotErr?.message ?? "No se pudo crear la cotización" }

  if (rows.length > 0) {
    const insertRows = rows.map((r) => ({ ...r, cotizacion_id: cot.id }))
    const { error: insErr } = await supabase.from("items_cotizacion").insert(insertRows)
    if (insErr) return { ok: false, error: insErr.message }
  }

  await supabase
    .from("ppd_proyectos")
    .update({ estado: "convertido", cotizacion_id: cot.id })
    .eq("id", id)

  revalidatePath("/ppd")
  revalidatePath("/cotizaciones")
  return { ok: true, data: { cotizacionId: cot.id } }
}

export async function convertirYRedirigir(id: string): Promise<void> {
  const r = await convertirAcotizacion(id)
  if (!r.ok) throw new Error(r.error)
  redirect(`/editor/${r.data.cotizacionId}`)
}
