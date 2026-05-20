"use client"

import { pdf } from "@react-pdf/renderer"
import { CotizacionPdf, type CotizacionPdfProps } from "./cotizacion-document"

export async function downloadCotizacionPdf(props: CotizacionPdfProps) {
  const blob = await pdf(<CotizacionPdf {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${props.numeroFormateado}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
