import "server-only"
import * as cheerio from "cheerio"
import type { ScrapedProduct } from "./types"

const URL_BASE = "https://demasled.com.ar/productos/"
const USER_AGENT =
  "Mozilla/5.0 (compatible; AreaNCotizadorBot/0.1; +https://arean.com.ar)"

type Variant = {
  product_id: number
  price_number_raw?: number
  price_number?: number
  sku?: string | null
  image_url?: string | null
  available?: boolean
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

async function scrapeOnePage(page: number): Promise<ScrapedProduct[]> {
  const url = page === 1 ? URL_BASE : `${URL_BASE}?page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-AR" },
  })
  if (!res.ok) throw new Error(`Demasled page ${page} returned ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  const products: ScrapedProduct[] = []
  $(".js-item-product").each((_, el) => {
    const $el = $(el)
    const productId = $el.attr("data-product-id")
    if (!productId) return

    // Find the variants JSON — sits on a child container
    const variantsRaw = $el.find("[data-variants]").first().attr("data-variants")
    const variants = variantsRaw ? tryParseVariants(variantsRaw) : null
    const v = variants?.[0]

    const nombre = $el.find(".js-item-name").first().text().trim()
    if (!nombre) return
    const link = $el.find("a.item-link, a[href*='/productos/']").first().attr("href")?.trim()
    if (!link) return

    // Price: prefer JSON variant data; fallback to data-product-price on the price span
    let precio_ars: number | null = null
    if (v?.price_number_raw && v.price_number_raw > 0) {
      // Tienda Nube convention: price_number_raw is in cents — e.g. 48400 == $484.00
      precio_ars = v.price_number_raw / 100
    } else if (v?.price_number && v.price_number > 0) {
      precio_ars = v.price_number
    } else {
      const priceAttr = $el.find(".js-price-display").first().attr("data-product-price")
      if (priceAttr) {
        // data-product-price is also in cents on Tienda Nube
        const n = Number(priceAttr)
        if (Number.isFinite(n) && n > 0) precio_ars = n / 100
      }
    }
    if (precio_ars === null) return // skip

    const sku = v?.sku ?? null
    const imagen_url = normalizeImage(v?.image_url ?? $el.find("img.js-item-image").first().attr("src") ?? null)

    products.push({
      sku,
      nombre,
      descripcion: null,
      categoria: null,
      marca: "demasled",
      precio_ars,
      url: link,
      imagen_url,
      activo: v?.available !== false,
    })
  })
  return products
}

export async function scrapeDemasled(opts?: { maxPages?: number; delayMs?: number }): Promise<ScrapedProduct[]> {
  const maxPages = opts?.maxPages ?? 100
  const delayMs = opts?.delayMs ?? 150
  const all: ScrapedProduct[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const batch = await scrapeOnePage(page)
    if (batch.length === 0) break
    let newOnThisPage = 0
    for (const p of batch) {
      if (seen.has(p.url)) continue
      seen.add(p.url)
      all.push(p)
      newOnThisPage++
    }
    // Tienda Nube returns the last page when you exceed bounds → wraps to dupes → stop
    if (newOnThisPage === 0) break
    if (delayMs > 0 && page < maxPages) await new Promise((r) => setTimeout(r, delayMs))
  }
  return all
}
