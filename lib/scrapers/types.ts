export type ScrapedProduct = {
  sku: string | null
  nombre: string
  descripcion: string | null
  categoria: string | null
  marca: "sonoff" | "demasled"
  precio_ars: number
  url: string
  imagen_url: string | null
  activo: boolean
}

export type ScrapeResult = {
  marca: "sonoff" | "demasled"
  ok: boolean
  scraped: number
  inserted: number
  updated: number
  errors: string[]
  durationMs: number
}
