import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { ProductosView } from "./productos-view"
import type { Database } from "@/types/database"

type Producto = Database["public"]["Tables"]["productos"]["Row"]

const PAGE_SIZE = 1000

async function fetchAllProductos(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Producto[]> {
  const all: Producto[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("activo", { ascending: false })
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

export default async function ProductosPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const productos = await fetchAllProductos(supabase)
  const lastUpdate = productos[0]?.updated_at ?? null

  return (
    <>
      <Topbar crumbs={["Catálogo"]} title="Productos" dolar={dolar} />
      <div className="flex-1 overflow-auto px-6 py-6">
        <ProductosView
          productos={productos}
          lastUpdate={lastUpdate}
          dolarVenta={dolar.venta}
        />
      </div>
    </>
  )
}
