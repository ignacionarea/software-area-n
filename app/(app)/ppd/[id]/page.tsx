import { notFound } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import { createClient } from "@/lib/supabase/server"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { PpdEditor } from "../ppd-editor"

export default async function EditPpdPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const dolar = await getDolarVentaSafe()

  const [ppdRes, clientesRes, userRes] = await Promise.all([
    supabase.from("ppd_proyectos").select("*").eq("id", id).maybeSingle(),
    supabase.from("clientes").select("*").order("nombre"),
    supabase.auth.getUser(),
  ])

  if (!ppdRes.data) notFound()

  const tecnico =
    (userRes.data.user?.user_metadata?.full_name as string | undefined) ??
    (userRes.data.user?.user_metadata?.name as string | undefined) ??
    userRes.data.user?.email ??
    ""

  return (
    <>
      <Topbar crumbs={["PPD", ppdRes.data.titulo]} title={ppdRes.data.titulo} dolar={dolar} />
      <PpdEditor ppd={ppdRes.data} clientes={clientesRes.data ?? []} defaultTecnico={tecnico} />
    </>
  )
}
