import "server-only"
import * as cheerio from "cheerio"
import type { ScrapedProduct, ProductoVariante } from "./types"

const USER_AGENT =
  "Mozilla/5.0 (compatible; AreaNCotizadorBot/0.1; +https://arean.com.ar)"

type Variant = {
  product_id: number
  price_number_raw?: number | null
  price_number?: number | null
  sku?: string | null
  image_url?: string | null
  available?: boolean
  option0?: string | null
  option1?: string | null
  option2?: string | null
}

function tryParseVariants(raw: string): Variant[] | null {
  try {
    return JSON.parse(raw) as Variant[]
  } catch {
    return null
  }
}

function normalizeImage(u: string | null | undefined): string | null {
  if (!u) return null
  if (u.startsWith("//")) return `https:${u}`
  return u
}

async function scrapeOnePage(baseUrl: string, page: number, marca: string): Promise<ScrapedProduct[]> {
  const root = baseUrl.replace(/\/$/, "")
  const url = page === 1 ? `${root}/productos/` : `${root}/productos/?page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-AR" },
  })
  if (!res.ok) throw new Error(`Tienda Nube page ${page} returned ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  const products: ScrapedProduct[] = []
  $(".js-item-product").each((_, el) => {
    const $el = $(el)
    const productId = $el.attr("data-product-id")
    if (!productId) return

    const variantsRaw = $el.find("[data-variants]").first().attr("data-variants")
    const variants = variantsRaw ? tryParseVariants(variantsRaw) : null

    const nombre = $el.find(".js-item-name").first().text().trim()
    if (!nombre) return
    const link = $el.find("a.item-link, a[href*='/productos/']").first().attr("href")?.trim()
    if (!link) return

    // Build the list of variantes. We keep only variants with valid price + available.
    // Skip variants whose all options are null (those are the "single variant" placeholder
    // representing a product without options — we still want their price but no options entry).
    const hasMultipleVariants =
      Array.isArray(variants) &&
      variants.some((v) => v.option0 != null || v.option1 != null || v.option2 != null)

    const variantesValidas: ProductoVariante[] = []
    if (Array.isArray(variants)) {
      for (const v of variants) {
        const raw = v.price_number_raw
        const num = v.price_number
        let price: number | null = null
        if (typeof raw === "number" && raw > 0) price = raw / 100
        else if (typeof num === "number" && num > 0) price = num
        if (price === null) continue

        const opciones: Record<string, string> = {}
        if (v.option0) opciones["Opción 1"] = v.option0
        if (v.option1) opciones["Opción 2"] = v.option1
        if (v.option2) opciones["Opción 3"] = v.option2

        variantesValidas.push({
          sku: v.sku ?? null,
          opciones,
          precio_ars: price,
          imagen_url: normalizeImage(v.image_url ?? null),
          disponible: v.available !== false,
        })
      }
    }

    // Compute display precio_ars: prefer the lowest available variant price
    let precio_ars: number | null = null
    if (variantesValidas.length > 0) {
      precio_ars = Math.min(...variantesValidas.map((vv) => vv.precio_ars))
    } else {
      // Fallback to the data-product-price attribute
      const priceAttr = $el.find(".js-price-display").first().attr("data-product-price")
      if (priceAttr) {
        const n = Number(priceAttr)
        if (Number.isFinite(n) && n > 0) precio_ars = n / 100
      }
    }
    if (precio_ars === null) return

    const firstVariant = variantesValidas[0]
    const sku = firstVariant?.sku ?? null
    const imagen_url = normalizeImage(
      firstVariant?.imagen_url ?? $el.find("img.js-item-image").first().attr("src") ?? null
    )

    products.push({
      sku,
      nombre,
      descripcion: null,
      categoria: null,
      marca,
      precio_ars,
      url: link,
      imagen_url,
      activo: variantesValidas.some((v) => v.disponible),
      // Only store the variantes array if the product actually has multiple variants with options.
      // Single-variant products don't need the array.
      variantes: hasMultipleVariants ? variantesValidas : [],
    })
  })
  return products
}

export async function scrapeTiendaNube(opts: {
  baseUrl: string
  marca: string
  maxPages?: number
  delayMs?: number
}): Promise<ScrapedProduct[]> {
  const maxPages = opts.maxPages ?? 100
  const delayMs = opts.delayMs ?? 150
  const all: ScrapedProduct[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const batch = await scrapeOnePage(opts.baseUrl, page, opts.marca)
    if (batch.length === 0) break
    let newOnThisPage = 0
    for (const p of batch) {
      if (seen.has(p.url)) continue
      seen.add(p.url)
      all.push(p)
      newOnThisPage++
    }
    if (newOnThisPage === 0) break
    if (delayMs > 0 && page < maxPages) await new Promise((r) => setTimeout(r, delayMs))
  }
  return all
}
