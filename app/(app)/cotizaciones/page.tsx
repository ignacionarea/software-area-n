import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { CotizacionesView } from "./cotizaciones-view"

export default async function CotizacionesPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  // Mark expired before fetching
  await supabase.rpc("marcar_cotizaciones_vencidas")

  const [{ data: cotizaciones }, { data: configuracion }] = await Promise.all([
    supabase.from("v_cotizaciones_resumen").select("*").order("numero", { ascending: false }),
    supabase.from("configuracion").select("razon_social, email, telefono").eq("id", true).single(),
  ])

  return (
    <>
      <Topbar crumbs={["Area N"]} title="Cotizaciones" dolar={dolar} />
      <div className="flex-1 overflow-auto px-6 py-6">
        <CotizacionesView
          cotizaciones={cotizaciones ?? []}
          configuracion={
            configuracion ?? { razon_social: "Area N", email: null, telefono: null }
          }
        />
      </div>
    </>
  )
}
