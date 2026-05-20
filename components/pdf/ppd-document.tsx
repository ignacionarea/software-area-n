"use client"

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import type { SurveyData, Prioridad } from "@/app/(app)/ppd/categorias"
import { EXPANSION_CATEGORY } from "@/app/(app)/ppd/categorias"

export type PpdPdfProps = {
  titulo: string
  cliente: string
  direccion: string
  fecha: string
  tecnico: string
  survey: SurveyData
  notas: string
  logoUrl: string
}

// Paleta del dueño (Streamlit)
const COLOR = {
  dark: "#051510",
  mint: "#2BD990",
  beige: "#F5F2EB",
  beigeSoft: "#F8F6F1",
  beigeBorder: "#E1DED7",
  text: "#1E2522",
  muted: "#647069",
  white: "#FFFFFF",
}

const PRIO_COLORS: Record<Prioridad, { fill: string; text: string }> = {
  Alta: { fill: "#FFECEB", text: "#D32F2F" },
  Media: { fill: "#FFF3CD", text: "#856404" },
  Baja: { fill: "#D1ECF1", text: "#0C5460" },
}

const s = StyleSheet.create({
  page: { padding: 36, paddingTop: 50, paddingBottom: 50, fontSize: 9, fontFamily: "Helvetica", color: COLOR.text, backgroundColor: COLOR.beige },

  // Header band (fixed on each page)
  bandTop: { position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: COLOR.dark },
  bandMint: { position: "absolute", top: 8, left: 0, right: 0, height: 2, backgroundColor: COLOR.mint },

  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  logo: { width: 38, height: 38 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: COLOR.dark },
  brandLine: { fontSize: 8, color: COLOR.muted, marginTop: 2 },
  headerRight: { textAlign: "right" },
  reportTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COLOR.dark },
  reportSub: { fontSize: 8, color: COLOR.muted, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: COLOR.beigeBorder, marginTop: 8, marginBottom: 14 },

  // Project card
  projectCard: {
    backgroundColor: COLOR.beigeSoft,
    borderLeftWidth: 4,
    borderLeftColor: COLOR.mint,
    borderWidth: 0.5,
    borderColor: COLOR.beigeBorder,
    padding: 14,
    marginBottom: 12,
  },
  projectTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COLOR.dark, marginBottom: 8 },
  projectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  projectField: { width: "50%", marginBottom: 5, flexDirection: "row", gap: 6 },
  projectFieldLabel: { fontFamily: "Helvetica-Bold", color: COLOR.dark, fontSize: 9 },
  projectFieldValue: { color: COLOR.text, fontSize: 9 },

  intro: { fontSize: 9.5, color: "#3C463F", fontStyle: "italic", lineHeight: 1.4, marginBottom: 14 },

  // Category banner
  catBanner: { flexDirection: "row", marginTop: 6, marginBottom: 6 },
  catBannerLeft: { width: 4, backgroundColor: COLOR.mint },
  catBannerBody: { flex: 1, backgroundColor: COLOR.dark, padding: 6, paddingLeft: 10 },
  catBannerText: { color: COLOR.white, fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },

  // Table
  tableHeader: { flexDirection: "row", backgroundColor: "#E8E6DF", borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: COLOR.beigeBorder },
  th: { padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: COLOR.dark, borderRightWidth: 0.5, borderColor: COLOR.beigeBorder },
  thNoRight: { padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: COLOR.dark },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: COLOR.beigeBorder },
  td: { padding: 4, fontSize: 8, color: COLOR.text, borderRightWidth: 0.5, borderColor: COLOR.beigeBorder },
  tdNoRight: { padding: 4, fontSize: 8, color: COLOR.text },
  tdBold: { fontFamily: "Helvetica-Bold", color: COLOR.dark, fontSize: 8 },
  tdItalic: { fontStyle: "italic", color: COLOR.muted, fontSize: 7.5 },

  // Column widths (180mm / 100%)
  colSistema: { width: "29%" },
  colCant: { width: "10%", textAlign: "center" },
  colAmbiente: { width: "20%", textAlign: "center" },
  colPrioridad: { width: "13%", textAlign: "center" },
  colComentarios: { width: "28%" },

  prioBadge: { padding: 3, paddingHorizontal: 4, borderRadius: 3, fontFamily: "Helvetica-Bold", fontSize: 7.5, textAlign: "center" },

  // Expansion card
  expansionCard: {
    backgroundColor: COLOR.beigeSoft,
    borderLeftWidth: 4,
    borderLeftColor: COLOR.mint,
    borderWidth: 0.5,
    borderColor: COLOR.beigeBorder,
    padding: 10,
    marginBottom: 10,
  },
  expansionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLOR.dark, marginBottom: 4 },
  expansionBody: { fontSize: 8.5, fontStyle: "italic", color: COLOR.text, lineHeight: 1.4 },

  // Signatures
  signLine: { borderTopWidth: 0.5, borderColor: "#B4B4AF", marginTop: 20 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  signBox: { width: "45%" },
  signLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLOR.dark, textAlign: "center" },
  signNote: { fontSize: 8, color: COLOR.muted, marginTop: 8, textAlign: "center" },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLOR.muted,
    borderTopWidth: 0.3,
    borderColor: COLOR.beigeBorder,
    paddingTop: 6,
  },

  // Stats summary card
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: COLOR.white, padding: 8, borderWidth: 0.5, borderColor: COLOR.beigeBorder },
  statLabel: { fontSize: 7.5, color: COLOR.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  statValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: COLOR.dark, marginTop: 2 },

  notesBlock: { marginTop: 10, padding: 10, backgroundColor: COLOR.white, borderWidth: 0.5, borderColor: COLOR.beigeBorder },
  notesTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLOR.dark, marginBottom: 4 },
  notesBody: { fontSize: 8.5, color: COLOR.text, lineHeight: 1.4 },
})

function fmtDate(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso + "T12:00:00")
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(d)
}

export function PpdPdf({
  titulo, cliente, direccion, fecha, tecnico, survey, notas, logoUrl,
}: PpdPdfProps) {
  // Stats
  let total = 0, equipos = 0, alta = 0, media = 0, baja = 0
  for (const sistemas of Object.values(survey)) {
    for (const sis of sistemas) {
      if (!sis.applies) continue
      total++
      equipos += sis.quantity
      if (sis.priority === "Alta") alta++
      else if (sis.priority === "Media") media++
      else baja++
    }
  }

  return (
    <Document title={`PPD ${titulo}`} author="Area N">
      <Page size="A4" style={s.page}>
        {/* Banner top (repeated each page via fixed) */}
        <View style={s.bandTop} fixed />
        <View style={s.bandMint} fixed />

        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            {logoUrl && <Image src={logoUrl} style={s.logo} />}
            <View>
              <Text style={s.brandName}>Area N</Text>
              <Text style={s.brandLine}>DOMÓTICA & CONSTRUCCIÓN SUSTENTABLE</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportTitle}>REPORTE DE PLANIFICACIÓN DE DISEÑO</Text>
            <Text style={s.reportSub}>Planificación y especificaciones técnicas</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Project card */}
        <View style={s.projectCard}>
          <Text style={s.projectTitle}>DATOS GENERALES DEL PROYECTO</Text>
          <View style={s.projectGrid}>
            <View style={s.projectField}>
              <Text style={s.projectFieldLabel}>Cliente:</Text>
              <Text style={s.projectFieldValue}>{cliente || "—"}</Text>
            </View>
            <View style={s.projectField}>
              <Text style={s.projectFieldLabel}>Fecha:</Text>
              <Text style={s.projectFieldValue}>{fmtDate(fecha)}</Text>
            </View>
            <View style={s.projectField}>
              <Text style={s.projectFieldLabel}>Obra/Dir:</Text>
              <Text style={s.projectFieldValue}>{direccion || "—"}</Text>
            </View>
            <View style={s.projectField}>
              <Text style={s.projectFieldLabel}>Técnico:</Text>
              <Text style={s.projectFieldValue}>{tecnico || "—"}</Text>
            </View>
            <View style={s.projectField}>
              <Text style={s.projectFieldLabel}>Sistemas planificados:</Text>
              <Text style={{ ...s.projectFieldValue, color: COLOR.mint, fontFamily: "Helvetica-Bold" }}>
                {total} sistemas · {equipos} equipos
              </Text>
            </View>
          </View>
        </View>

        {/* Stats summary */}
        <View style={s.statsRow}>
          <Stat label="Sistemas aplicados" value={total} />
          <Stat label="Equipos totales" value={equipos} accent />
          <Stat label="Prioridad alta" value={alta} danger />
          <Stat label="Media / Baja" value={`${media} / ${baja}`} />
        </View>

        <Text style={s.intro}>
          El presente informe detalla el Programa de Planificación de Diseño para la integración de
          soluciones de domótica, construcción sustentable y eficiencia energética de Area N. A continuación
          se especifican los sistemas aplicados, ambientes correspondientes, niveles de prioridad y
          comentarios de obra acordados.
        </Text>

        {/* Categories */}
        {total === 0 ? (
          <View style={{ padding: 14, backgroundColor: "#F0F0EB", alignItems: "center" }}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: COLOR.dark }}>
              No se han seleccionado sistemas técnicos aplicados en este relevamiento.
            </Text>
          </View>
        ) : (
          Object.entries(survey).map(([categoria, sistemas]) => {
            const applied = sistemas.filter((x) => x.applies)
            if (applied.length === 0) return null
            const isExpansion = categoria === EXPANSION_CATEGORY
            return (
              <View key={categoria} wrap={false}>
                <View style={s.catBanner}>
                  <View style={s.catBannerLeft} />
                  <View style={s.catBannerBody}>
                    <Text style={s.catBannerText}>{categoria}</Text>
                  </View>
                </View>

                {isExpansion ? (
                  <View style={s.expansionCard}>
                    <Text style={s.expansionTitle}>
                      Especificaciones para obra de refacción, ampliación o puesta en valor:
                    </Text>
                    <Text style={s.expansionBody}>
                      {applied[0]?.comments || "Sin observaciones adicionales."}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={s.tableHeader}>
                      <Text style={{ ...s.th, ...s.colSistema }}>Sistema técnico</Text>
                      <Text style={{ ...s.th, ...s.colCant }}>Cant.</Text>
                      <Text style={{ ...s.th, ...s.colAmbiente }}>Ubicación / ambiente</Text>
                      <Text style={{ ...s.th, ...s.colPrioridad }}>Prioridad</Text>
                      <Text style={{ ...s.thNoRight, ...s.colComentarios }}>Comentarios</Text>
                    </View>
                    {applied.map((sis, idx) => (
                      <View
                        key={sis.name}
                        style={{
                          ...s.row,
                          backgroundColor: idx % 2 === 0 ? COLOR.white : COLOR.beigeSoft,
                        }}
                      >
                        <View style={{ ...s.td, ...s.colSistema }}>
                          <Text style={s.tdBold}>{sis.name}</Text>
                        </View>
                        <Text style={{ ...s.td, ...s.colCant }}>{sis.quantity}</Text>
                        <Text style={{ ...s.td, ...s.colAmbiente }}>{sis.environment || "—"}</Text>
                        <View style={{ ...s.td, ...s.colPrioridad }}>
                          <Text
                            style={{
                              ...s.prioBadge,
                              backgroundColor: PRIO_COLORS[sis.priority].fill,
                              color: PRIO_COLORS[sis.priority].text,
                            }}
                          >
                            {sis.priority.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ ...s.tdNoRight, ...s.colComentarios, ...s.tdItalic }}>
                          {sis.comments || "Sin comentarios adicionales."}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )
          })
        )}

        {/* Internal notes (only show if present) */}
        {notas?.trim() && (
          <View style={s.notesBlock}>
            <Text style={s.notesTitle}>NOTAS INTERNAS</Text>
            <Text style={s.notesBody}>{notas}</Text>
          </View>
        )}

        {/* Signatures */}
        <View wrap={false}>
          <View style={{ borderTopWidth: 1, borderColor: COLOR.mint, marginTop: 18 }} />
          <Text style={s.signNote}>
            Nota: Este reporte constituye un relevamiento preliminar de obra y especificación de diseño técnico para Area N.
          </Text>
          <View style={s.signRow}>
            <View style={s.signBox}>
              <View style={s.signLine} />
              <Text style={s.signLabel}>Firma técnico: {tecnico || "Relevador"}</Text>
            </View>
            <View style={s.signBox}>
              <View style={s.signLine} />
              <Text style={s.signLabel}>Conformidad cliente: {cliente || "Cliente"}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Programa de Planificación de Diseño — Area N</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: number | string
  accent?: boolean
  danger?: boolean
}) {
  const color = danger ? "#E03E3E" : accent ? COLOR.mint : COLOR.dark
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={{ ...s.statValue, color }}>{String(value)}</Text>
    </View>
  )
}
