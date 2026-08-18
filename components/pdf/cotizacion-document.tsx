"use client"

import { Document, Page, View, Text, Image, Link, StyleSheet } from "@react-pdf/renderer"

export type PdfClienteData = {
  nombre: string
  cuit_dni: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
} | null

export type PdfItemData = {
  tipo: "producto" | "mano_obra"
  concepto: string
  aclaracion?: string | null
  tiene_cantidad?: boolean
  cantidad: number
  precio_unitario_ars: number
  url_producto: string | null
  marca?: string | null
}

export type PdfConfiguracionData = {
  razon_social: string
  cuit: string | null
  direccion: string | null
  email: string | null
  telefono: string | null
  condicion_iva: string
  texto_legal_pdf: string | null
  condiciones_pago: string | null
  banco: string | null
  cbu_alias: string | null
}

export type CotizacionPdfProps = {
  numeroFormateado: string
  fechaEmision: string
  validezDias: number
  cotizacionDolar: number
  mostrarUsd?: boolean
  condicionesPersonalizadas?: string | null
  cliente: PdfClienteData
  items: PdfItemData[]
  subtotalProductos: number
  subtotalManoObra: number
  total: number
  totalUsd: number
  configuracion: PdfConfiguracionData
  logoUrl: string
}

const COLOR = {
  bg: "#FBFAF6",
  text: "#23241F",
  muted: "#6F7066",
  border: "#D6D2C5",
  borderLight: "#E9E5D8",
  accent: "#3E7A4C",
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: COLOR.text, backgroundColor: COLOR.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.border,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 38, height: 38 },
  brandName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  brandLine: { fontSize: 8, color: COLOR.muted, marginTop: 2 },
  rightHead: { textAlign: "right" },
  rightLabel: {
    fontSize: 7,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  numero: { fontSize: 14, fontFamily: "Courier-Bold", marginBottom: 4 },
  metaLine: { fontSize: 8, color: COLOR.muted },

  sectionLabel: {
    fontSize: 7,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  clienteBlock: { marginBottom: 14 },
  clienteName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  clienteMeta: { fontSize: 9, color: COLOR.muted, marginTop: 1 },

  rateBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.75,
    borderColor: COLOR.borderLight,
    borderRadius: 4,
    marginBottom: 14,
    backgroundColor: "#F4F1E6",
  },
  rateLabel: { fontSize: 8, color: COLOR.muted },
  rateValue: { fontSize: 9, fontFamily: "Courier-Bold" },

  thead: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.border,
    marginBottom: 2,
  },
  th: { fontSize: 7, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1.2 },
  thConcepto: { flex: 1 },
  thCant: { width: 36, textAlign: "right" },
  thUnit: { width: 70, textAlign: "right" },
  thSubtotal: { width: 80, textAlign: "right" },

  row: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.borderLight,
    alignItems: "flex-start",
  },
  rowConcepto: { flex: 1, paddingRight: 6 },
  rowCant: { width: 36, textAlign: "right", fontFamily: "Courier" },
  rowUnit: { width: 70, textAlign: "right", fontFamily: "Courier" },
  rowSubtotal: { width: 80, textAlign: "right", fontFamily: "Courier" },
  rowConceptoText: { fontSize: 9 },
  rowMoText: { fontSize: 9, fontStyle: "italic" },
  rowAclaracionText: { fontSize: 7.5, color: COLOR.muted, marginTop: 2, lineHeight: 1.3 },
  rowSubLink: { fontSize: 7, color: COLOR.accent, marginTop: 1, textDecoration: "none" },

  totalsBlock: { marginTop: 14, marginLeft: "auto", width: "55%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { fontSize: 9, color: COLOR.muted },
  totalValue: { fontSize: 9, fontFamily: "Courier" },
  totalBig: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 0.75,
    borderTopColor: COLOR.border,
  },
  totalBigLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalBigValue: { fontSize: 14, fontFamily: "Courier-Bold" },
  totalUsdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  totalUsdLabel: { fontSize: 8, color: COLOR.muted },
  totalUsdValue: { fontSize: 9, fontFamily: "Courier", color: COLOR.muted },

  legalBlock: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.borderLight,
  },
  legalTitle: {
    fontSize: 7,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  legalBody: { fontSize: 8, color: COLOR.muted, lineHeight: 1.4 },

  pago: { marginTop: 12 },
  pagoLine: { fontSize: 8, color: COLOR.muted, lineHeight: 1.4 },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLOR.muted,
  },
})

function fmtARS(n: number): string {
  return "$ " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)
}
function fmtUSD(n: number): string {
  return "US$ " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00")
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(d)
}

export function CotizacionPdf({
  numeroFormateado,
  fechaEmision,
  validezDias,
  cotizacionDolar,
  mostrarUsd = true,
  condicionesPersonalizadas,
  cliente,
  items,
  subtotalProductos,
  subtotalManoObra,
  total,
  totalUsd,
  configuracion,
  logoUrl,
}: CotizacionPdfProps) {
  const venc = new Date(fechaEmision + "T12:00:00")
  venc.setDate(venc.getDate() + validezDias)
  const vencIso = venc.toISOString().slice(0, 10)

  return (
    <Document
      title={`Cotización ${numeroFormateado}`}
      author={configuracion.razon_social}
      subject="Cotización"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <View>
              <Text style={styles.brandName}>{configuracion.razon_social}</Text>
              {configuracion.cuit && (
                <Text style={styles.brandLine}>CUIT {configuracion.cuit}</Text>
              )}
              {configuracion.direccion && (
                <Text style={styles.brandLine}>{configuracion.direccion}</Text>
              )}
              <Text style={styles.brandLine}>
                {[configuracion.email, configuracion.telefono].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.rightHead}>
            <Text style={styles.rightLabel}>Cotización N°</Text>
            <Text style={styles.numero}>{numeroFormateado}</Text>
            <Text style={styles.metaLine}>emitida {fmtDate(fechaEmision)}</Text>
            <Text style={styles.metaLine}>válida hasta {fmtDate(vencIso)}</Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.clienteBlock}>
          <Text style={styles.sectionLabel}>Cliente</Text>
          {cliente ? (
            <View>
              <Text style={styles.clienteName}>{cliente.nombre}</Text>
              {cliente.cuit_dni && <Text style={styles.clienteMeta}>{cliente.cuit_dni}</Text>}
              {cliente.direccion && <Text style={styles.clienteMeta}>{cliente.direccion}</Text>}
              {(cliente.email || cliente.telefono) && (
                <Text style={styles.clienteMeta}>
                  {[cliente.email, cliente.telefono].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.clienteMeta}>—</Text>
          )}
        </View>

        {/* USD rate — only if mostrarUsd is true */}
        {mostrarUsd && (
          <View style={styles.rateBox}>
            <Text style={styles.rateLabel}>Cotización USD oficial venta del día</Text>
            <Text style={styles.rateValue}>$ {cotizacionDolar.toFixed(2)} / USD</Text>
          </View>
        )}

        {/* Items */}
        <View style={styles.thead}>
          <Text style={[styles.th, styles.thConcepto]}>Concepto</Text>
          <Text style={[styles.th, styles.thCant]}>Cant.</Text>
          <Text style={[styles.th, styles.thUnit]}>P. unit ARS</Text>
          <Text style={[styles.th, styles.thSubtotal]}>Subtotal ARS</Text>
        </View>
        {items.length === 0 ? (
          <View style={styles.row}>
            <Text style={[styles.rowConceptoText, { color: COLOR.muted, fontStyle: "italic" }]}>
              (sin ítems)
            </Text>
          </View>
        ) : (
          items.map((it, idx) => {
            const showQty = it.tipo === "producto" || it.tiene_cantidad === true
            const subtotal = showQty ? it.precio_unitario_ars * it.cantidad : it.precio_unitario_ars
            return (
              <View key={idx} style={styles.row}>
                <View style={styles.rowConcepto}>
                  <Text style={it.tipo === "mano_obra" ? styles.rowMoText : styles.rowConceptoText}>
                    {it.concepto}
                  </Text>
                  {it.aclaracion ? (
                    <Text style={styles.rowAclaracionText}>{it.aclaracion}</Text>
                  ) : null}
                  {it.url_producto && (
                    <Link src={it.url_producto} style={styles.rowSubLink}>
                      {it.marca && it.marca !== "manual" ? `ver en ${it.marca}` : "ver producto"}
                    </Link>
                  )}
                </View>
                <Text style={styles.rowCant}>{showQty ? it.cantidad : "—"}</Text>
                <Text style={styles.rowUnit}>{showQty ? fmtARS(it.precio_unitario_ars) : "—"}</Text>
                <Text style={styles.rowSubtotal}>{fmtARS(subtotal)}</Text>
              </View>
            )
          })
        )}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal productos</Text>
            <Text style={styles.totalValue}>{fmtARS(subtotalProductos)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Mano de obra</Text>
            <Text style={styles.totalValue}>{fmtARS(subtotalManoObra)}</Text>
          </View>
          <View style={styles.totalBig}>
            <Text style={styles.totalBigLabel}>Total a pagar</Text>
            <Text style={styles.totalBigValue}>{fmtARS(total)}</Text>
          </View>
          {mostrarUsd && (
            <View style={styles.totalUsdRow}>
              <Text style={styles.totalUsdLabel}>al dólar BCRA del día</Text>
              <Text style={styles.totalUsdValue}>{fmtUSD(totalUsd)}</Text>
            </View>
          )}
        </View>

        {/* Condiciones de pago */}
        {(configuracion.condiciones_pago || configuracion.banco || configuracion.cbu_alias) && (
          <View style={styles.pago}>
            <Text style={styles.sectionLabel}>Condiciones de pago</Text>
            {configuracion.condiciones_pago && (
              <Text style={styles.pagoLine}>{configuracion.condiciones_pago}</Text>
            )}
            {(configuracion.banco || configuracion.cbu_alias) && (
              <Text style={styles.pagoLine}>
                {configuracion.banco ?? ""}
                {configuracion.banco && configuracion.cbu_alias ? " · " : ""}
                {configuracion.cbu_alias ? `CBU/Alias: ${configuracion.cbu_alias}` : ""}
              </Text>
            )}
          </View>
        )}

        {/* Condiciones / Términos de la cotización */}
        {condicionesPersonalizadas !== undefined ? (
          condicionesPersonalizadas && condicionesPersonalizadas.trim().length > 0 ? (
            <View style={styles.legalBlock}>
              <Text style={styles.legalTitle}>Condiciones</Text>
              <Text style={styles.legalBody}>{condicionesPersonalizadas.trim()}</Text>
            </View>
          ) : null
        ) : (
          configuracion.texto_legal_pdf && (
            <View style={styles.legalBlock}>
              <Text style={styles.legalTitle}>Condiciones</Text>
              <Text style={styles.legalBody}>{configuracion.texto_legal_pdf}</Text>
            </View>
          )
        )}

        <View style={styles.footer} fixed>
          <Text>{configuracion.razon_social}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
