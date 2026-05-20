import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { ConfigForms } from "./forms"

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const [{ data: config }, { data: user }, { data: lastCot }] = await Promise.all([
    supabase.from("configuracion").select("*").eq("id", true).single(),
    supabase.auth.getUser(),
    supabase
      .from("v_cotizaciones_resumen")
      .select("numero, cliente_nombre, fecha_emision")
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const proximoNumero = lastCot?.numero != null ? lastCot.numero + 1 : 88

  if (!config) {
    throw new Error("No se encontró la fila de configuración. ¿Migrations aplicadas?")
  }

  const ultimaCotizacion = lastCot
    ? { numero: lastCot.numero!, cliente: lastCot.cliente_nombre, fecha: lastCot.fecha_emision }
    : null

  return (
    <>
      <Topbar crumbs={["Ajustes"]} title="Configuración" dolar={dolar} />
      <div className="flex-1 overflow-auto px-6 py-6">
        <ConfigForms
          config={config}
          ultimaCotizacion={ultimaCotizacion}
          proximoNumero={proximoNumero}
          userEmail={user.user?.email ?? ""}
        />
      </div>
    </>
  )
}
