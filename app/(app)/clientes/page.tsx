import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { ClientesView } from "./clientes-view"

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id: selectedId } = await searchParams
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const [{ data: clientes }, detail] = await Promise.all([
    supabase.from("v_clientes_resumen").select("*").order("nombre"),
    selectedId
      ? Promise.all([
          supabase.from("clientes").select("*").eq("id", selectedId).maybeSingle(),
          supabase
            .from("v_cotizaciones_resumen")
            .select("*")
            .eq("cliente_id", selectedId)
            .order("fecha_emision", { ascending: false }),
        ]).then(([c, h]) => ({ cliente: c.data, historial: h.data ?? [] }))
      : Promise.resolve({ cliente: null, historial: [] }),
  ])

  return (
    <>
      <Topbar crumbs={["CRM"]} title="Clientes" dolar={dolar} />
      <div className="flex-1 overflow-auto px-6 py-6">
        <ClientesView
          clientes={clientes ?? []}
          selected={detail.cliente}
          historial={detail.historial}
        />
      </div>
    </>
  )
}
