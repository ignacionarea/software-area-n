import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type Producto = Database["public"]["Tables"]["productos"]["Row"]

const PAGE_SIZE = 1000

async function fetchAllActiveProducts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Producto[]> {
  const all: Producto[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .gt("precio_origen", 0)
      .order("marca")
      .order("nombre")
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export async function loadEditorContext(cotizacionId?: string) {
  const supabase = await createClient()

  const [clientesRes, productos, configRes, sourcesRes, cotRes, itemsRes] = await Promise.all([
    supabase.from("clientes").select("*").order("nombre"),
    fetchAllActiveProducts(supabase),
    supabase.from("configuracion").select("*").eq("id", true).single(),
    supabase.from("scrape_sources").select("*").order("nombre"),
    cotizacionId
      ? supabase.from("cotizaciones").select("*").eq("id", cotizacionId).maybeSingle()
      : Promise.resolve({ data: null }),
    cotizacionId
      ? supabase
          .from("items_cotizacion")
          .select("*")
          .eq("cotizacion_id", cotizacionId)
          .order("orden")
      : Promise.resolve({ data: [] }),
  ])

  return {
    clientes: clientesRes.data ?? [],
    productos,
    sources: sourcesRes.data ?? [],
    configuracion: configRes.data,
    cotizacion: cotRes.data,
    items: itemsRes.data ?? [],
  }
}
