"use client"

import { pdf } from "@react-pdf/renderer"
import { PpdPdf, type PpdPdfProps } from "./ppd-document"

export async function downloadPpdPdf(props: PpdPdfProps & { numero?: string }) {
  const blob = await pdf(<PpdPdf {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const safe = (props.titulo || props.numero || "PPD").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")
  a.download = `PPD_${safe}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
