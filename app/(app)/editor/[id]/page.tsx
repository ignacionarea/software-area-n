import { notFound } from "next/navigation"
import { loadEditorContext } from "../data"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { EditorView } from "../editor-view"
import { Topbar } from "@/components/layout/topbar"
import { formatCotizacionNumero } from "@/lib/format"

export default async function EditCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await loadEditorContext(id)
  const dolar = await getDolarVentaSafe()

  if (!ctx.cotizacion) notFound()
  if (!ctx.configuracion) throw new Error("Falta configuración.")

  return (
    <>
      <Topbar
        crumbs={["Cotizaciones", formatCotizacionNumero(ctx.cotizacion.numero)]}
        title={`Editar ${formatCotizacionNumero(ctx.cotizacion.numero)}`}
        dolar={dolar}
      />
      <EditorView
        clientes={ctx.clientes}
        productos={ctx.productos}
        configuracion={ctx.configuracion}
        cotizacion={ctx.cotizacion}
        items={ctx.items}
        dolarVenta={dolar.venta}
      />
    </>
  )
}
