import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { PpdListView } from "./ppd-list-view"

export default async function PpdListPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const { data: ppds } = await supabase
    .from("ppd_proyectos")
    .select("*, clientes(nombre)")
    .order("updated_at", { ascending: false })

  return (
    <>
      <Topbar
        crumbs={["Operación"]}
        title="PPD · Para Pensar y Diseñar"
        dolar={dolar}
      />
      <div className="flex-1 overflow-auto px-6 py-6">
        <PpdListView ppds={ppds ?? []} />
      </div>
    </>
  )
}
