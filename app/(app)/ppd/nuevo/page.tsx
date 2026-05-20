import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { PpdEditor } from "../ppd-editor"

export default async function NuevoPpdPage() {
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const [clientesRes, userRes] = await Promise.all([
    supabase.from("clientes").select("*").order("nombre"),
    supabase.auth.getUser(),
  ])

  const tecnico =
    (userRes.data.user?.user_metadata?.full_name as string | undefined) ??
    (userRes.data.user?.user_metadata?.name as string | undefined) ??
    userRes.data.user?.email ??
    ""

  return (
    <>
      <Topbar crumbs={["PPD", "Nuevo"]} title="Nuevo PPD · relevamiento" dolar={dolar} />
      <PpdEditor ppd={null} clientes={clientesRes.data ?? []} defaultTecnico={tecnico} />
    </>
  )
}
