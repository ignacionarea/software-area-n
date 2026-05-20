import { loadEditorContext } from "./data"
import { getDolarVentaSafe } from "@/lib/dolar/fetch-rate"
import { EditorView } from "./editor-view"
import { Topbar } from "@/components/layout/topbar"

export default async function NewCotizacionPage() {
  const ctx = await loadEditorContext()
  const dolar = await getDolarVentaSafe()

  if (!ctx.configuracion) {
    throw new Error("Falta la fila de configuración. Migrations OK?")
  }

  return (
    <>
      <Topbar crumbs={["Cotizaciones", "Nueva"]} title="Editor de cotización" dolar={dolar} />
      <EditorView
        clientes={ctx.clientes}
        productos={ctx.productos}
        configuracion={ctx.configuracion}
        cotizacion={null}
        items={[]}
        dolarVenta={dolar.venta}
      />
    </>
  )
}
