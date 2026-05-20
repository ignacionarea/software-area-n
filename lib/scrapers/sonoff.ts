import "server-only"
import * as cheerio from "cheerio"
import type { ScrapedProduct } from "./types"

const URL_LISTING = "https://sonoffargentina.com/productos/"
const USER_AGENT =
  "Mozilla/5.0 (compatible; AreaNCotizadorBot/0.1; +https://arean.com.ar)"
const DETAIL_CONCURRENCY = 5

function parsePriceARS(raw: string): number | null {
  // Examples: "$20.100", "$ 41.600,50"
  const cleaned = raw
    .replace(/[^\d,.\-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchDescriptiveName(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-AR" },
    })
    if (!res.ok) return null
    const html = await res.text()
    const $ = cheerio.load(html)
    const raw =
      $('meta[name="description"]').attr("content") ??
      $('meta[property="og:description"]').attr("content") ??
      ""
    const cleaned = raw.trim().replace(/\.$/, "")
    return cleaned.length > 0 ? cleaned : null
  } catch {
    return null
  }
}

async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

export async function scrapeSonoff(): Promise<ScrapedProduct[]> {
  const res = await fetch(URL_LISTING, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-AR" },
  })
  if (!res.ok) throw new Error(`Sonoff listing returned ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  const products: ScrapedProduct[] = []
  $("li.product").each((_, el) => {
    const $el = $(el)
    const $link = $el.find("a.woocommerce-LoopProduct-link").first()
    const url = $link.attr("href")?.trim() ?? ""
    if (!url) return
    const modelCode = $el.find(".woocommerce-loop-product__title").first().text().trim()
    if (!modelCode) return

    const descontinuado = $el.find(".custom-badge.descontinuado").length > 0
    const priceText = $el.find(".woocommerce-Price-amount").first().text().trim()
    const parsed = parsePriceARS(priceText)
    // Descontinuados have no price — store them with precio 0 + activo=false
    if (parsed === null && !descontinuado) return
    const precio_ars = parsed ?? 0
    const activo = !descontinuado && precio_ars > 0

    const $img = $el.find("img").first()
    const imagen_url = ($img.attr("src") ?? "").trim() || null

    // category from li class — e.g. product_cat-diy-smart-switch
    const classes = ($el.attr("class") ?? "").split(/\s+/)
    const catClass = classes.find((c) => c.startsWith("product_cat-"))
    const categoria = catClass ? catClass.replace("product_cat-", "").replace(/-/g, " ") : null

    // For now nombre = modelCode; we enrich with descriptive name from the detail page below.
    products.push({
      sku: modelCode.toUpperCase(),
      nombre: modelCode,
      descripcion: null,
      categoria,
      marca: "sonoff",
      precio_ars,
      url,
      imagen_url,
      activo,
    })
  })

  const deduped = dedupeByUrl(products)

  // Enrich each product with the descriptive name from its detail page (meta description).
  await inBatches(deduped, DETAIL_CONCURRENCY, async (p) => {
    const desc = await fetchDescriptiveName(p.url)
    if (desc && desc.toLowerCase() !== p.nombre.toLowerCase()) {
      p.nombre = desc
    }
  })

  return deduped
}

function dedupeByUrl<T extends { url: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return arr.filter((p) => {
    if (seen.has(p.url)) return false
    seen.add(p.url)
    return true
  })
}
