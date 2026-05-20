import "server-only"

export type DolarRate = {
  compra: number
  venta: number
  fechaActualizacion: string
}

export async function fetchDolarOficial(): Promise<DolarRate> {
  const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
    next: { revalidate: 600 }, // cache 10 min
  })

  if (!res.ok) {
    throw new Error(`dolarapi.com returned ${res.status}`)
  }

  const data = await res.json()
  return {
    compra: data.compra,
    venta: data.venta,
    fechaActualizacion: data.fechaActualizacion,
  }
}

export async function getDolarVentaSafe(): Promise<{ venta: number; updatedAt: string | null; fallback: boolean }> {
  try {
    const r = await fetchDolarOficial()
    return { venta: r.venta, updatedAt: r.fechaActualizacion, fallback: false }
  } catch {
    return { venta: 1000, updatedAt: null, fallback: true }
  }
}
