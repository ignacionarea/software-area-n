import "server-only"
import * as cheerio from "cheerio"
import type { ScrapedProduct } from "./types"

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
    const v = variants?.[0]

    const nombre = $el.find(".js-item-name").first().text().trim()
    if (!nombre) return
    const link = $el.find("a.item-link, a[href*='/productos/']").first().attr("href")?.trim()
    if (!link) return

    let precio_ars: number | null = null
    if (v?.price_number_raw && v.price_number_raw > 0) {
      precio_ars = v.price_number_raw / 100
    } else if (v?.price_number && v.price_number > 0) {
      precio_ars = v.price_number
    } else {
      const priceAttr = $el.find(".js-price-display").first().attr("data-product-price")
      if (priceAttr) {
        const n = Number(priceAttr)
        if (Number.isFinite(n) && n > 0) precio_ars = n / 100
      }
    }
    if (precio_ars === null) return

    const sku = v?.sku ?? null
    const imagen_url = normalizeImage(v?.image_url ?? $el.find("img.js-item-image").first().attr("src") ?? null)

    products.push({
      sku,
      nombre,
      descripcion: null,
      categoria: null,
      marca,
      precio_ars,
      url: link,
      imagen_url,
      activo: v?.available !== false,
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
