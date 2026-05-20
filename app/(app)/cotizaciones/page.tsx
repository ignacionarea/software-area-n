import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { CotizacionesView } from "./cotizaciones-view"

export default async function CotizacionesPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  // Mark expired before fetching
  await supabase.rpc("marcar_cotizaciones_vencidas")

  const { data: cotizaciones } = await supabase
    .from("v_cotizaciones_resumen")
    .select("*")
    .order("numero", { ascending: false })

  return (
    <>
      <Topbar crumbs={["Area N"]} title="Cotizaciones" dolar={dolar} />
      <div className="flex-1 overflow-auto px-6 py-6">
        <CotizacionesView cotizaciones={cotizaciones ?? []} />
      </div>
    </>
  )
}
