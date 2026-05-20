import "server-only"
import { renderToBuffer } from "@react-pdf/renderer"
import { CotizacionPdf, type CotizacionPdfProps } from "@/components/pdf/cotizacion-document"

export async function renderCotizacionPdfToBuffer(
  props: CotizacionPdfProps
): Promise<Buffer> {
  return renderToBuffer(<CotizacionPdf {...props} />)
}
