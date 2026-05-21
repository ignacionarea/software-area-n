export type ProductoVariante = {
  sku: string | null
  /** { "Opción 1": "Blanco", "Opción 2": "10W" } — keys are generic until refined */
  opciones: Record<string, string>
  precio_ars: number
  imagen_url: string | null
  disponible: boolean
}

export type ScrapedProduct = {
  sku: string | null
  nombre: string
  descripcion: string | null
  categoria: string | null
  marca: string
  precio_ars: number
  url: string
  imagen_url: string | null
  activo: boolean
  variantes: ProductoVariante[]
}

export type ScrapeResult = {
  marca: string
  ok: boolean
  scraped: number
  inserted: number
  updated: number
  errors: string[]
  durationMs: number
}
