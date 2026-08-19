export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

export function formatCotizacionNumero(numero: number): string {
  return `CT-${String(numero).padStart(5, "0")}`
}

export type CotizacionMetadata = {
  notas?: string
  mostrarUsd?: boolean
  condiciones?: string
  condicionesPago?: string
}

export function parseCotizacionNotas(rawNotas: string | null): CotizacionMetadata {
  if (!rawNotas) return { notas: "", mostrarUsd: true, condiciones: "", condicionesPago: "" }
  try {
    if (rawNotas.trim().startsWith("{") && rawNotas.trim().endsWith("}")) {
      const parsed = JSON.parse(rawNotas)
      return {
        notas: typeof parsed.notas === "string" ? parsed.notas : "",
        mostrarUsd: typeof parsed.mostrarUsd === "boolean" ? parsed.mostrarUsd : true,
        condiciones: typeof parsed.condiciones === "string" ? parsed.condiciones : "",
        condicionesPago: typeof parsed.condicionesPago === "string" ? parsed.condicionesPago : "",
      }
    }
  } catch {}
  return { notas: rawNotas, mostrarUsd: true, condiciones: "", condicionesPago: "" }
}

export function serializeCotizacionNotas(meta: CotizacionMetadata): string {
  return JSON.stringify(meta)
}
