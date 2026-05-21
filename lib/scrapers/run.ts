import "server-only"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { ScrapedProduct, ScrapeResult } from "./types"
import { scrapeSonoff } from "./sonoff"
import { scrapeTiendaNube } from "./tiendanube"

export type RunOptions = {
  /** Subset of source slugs to run; default: all activos */
  slugs?: string[]
  /** Override max pages (mostly for Tienda Nube). If null, uses each source's configured max_pages */
  maxPages?: number
  /** When true, uses a service-role client (cron). Otherwise uses the authenticated session. */
  asAdmin?: boolean
}

async function getDbClient(asAdmin: boolean) {
  if (asAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for admin scrape")
    return createAdminClient<Database>(url, key, { auth: { persistSession: false } })
  }
  return await createServerClient()
}

async function upsertProducts(
  supabase: Awaited<ReturnType<typeof getDbClient>>,
  marca: string,
  products: ScrapedProduct[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  if (products.length === 0) return { inserted: 0, updated: 0, errors: [] }
  const errors: string[] = []

  // Skip manual products from being touched by the scraper.
  const urls = products.map((p) => p.url)
  const { data: existing } = await supabase
    .from("productos")
    .select("url, marca, es_manual")
    .eq("marca", marca)
    .in("url", urls)
  const existingSet = new Set((existing ?? []).map((r) => r.url))
  const manualUrls = new Set((existing ?? []).filter((r) => r.es_manual).map((r) => r.url))

  const rows = products
    .filter((p) => !manualUrls.has(p.url)) // never overwrite manual rows
    .map((p) => ({
      sku: p.sku,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria,
      marca: p.marca,
      precio_origen: p.precio_ars,
      moneda_origen: "ARS" as const,
      url: p.url,
      imagen_url: p.imagen_url,
      activo: p.activo,
      es_manual: false,
      variantes: p.variantes as unknown as Database["public"]["Tables"]["productos"]["Insert"]["variantes"],
    }))

  // Postgrest upsert on the unique constraint (marca, url) — the partial unique index
  // covers non-null urls (which all scraped products have).
  const { error } = await supabase.from("productos").upsert(rows, { onConflict: "marca,url" })
  if (error) errors.push(error.message)

  const updated = products.filter((p) => existingSet.has(p.url) && !manualUrls.has(p.url)).length
  const inserted = rows.length - updated
  return { inserted, updated, errors }
}

export async function runScrapers(opts: RunOptions = {}): Promise<ScrapeResult[]> {
  const supabase = await getDbClient(opts.asAdmin ?? false)

  // Fetch active sources from DB
  let query = supabase.from("scrape_sources").select("*").eq("activo", true)
  if (opts.slugs && opts.slugs.length > 0) {
    query = query.in("slug", opts.slugs)
  }
  const { data: sources, error: sourcesErr } = await query
  if (sourcesErr) {
    return [
      {
        marca: "config",
        ok: false,
        scraped: 0,
        inserted: 0,
        updated: 0,
        errors: [sourcesErr.message],
        durationMs: 0,
      },
    ]
  }
  if (!sources || sources.length === 0) {
    return []
  }

  const results: ScrapeResult[] = []
  for (const source of sources) {
    const started = Date.now()
    const maxPages = opts.maxPages ?? source.max_pages
    try {
      let products: ScrapedProduct[]
      if (source.platform === "woocommerce") {
        products = await scrapeSonoff({ marca: source.slug })
      } else if (source.platform === "tiendanube") {
        products = await scrapeTiendaNube({
          baseUrl: source.url_base,
          marca: source.slug,
          maxPages,
        })
      } else {
        throw new Error(`Plataforma "${source.platform}" no soportada`)
      }

      const { inserted, updated, errors } = await upsertProducts(supabase, source.slug, products)
      const ok = errors.length === 0
      const durationMs = Date.now() - started
      results.push({
        marca: source.slug,
        ok,
        scraped: products.length,
        inserted,
        updated,
        errors,
        durationMs,
      })

      // Record last_run on the source
      await supabase
        .from("scrape_sources")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_ok: ok,
          last_run_count: products.length,
          last_run_error: errors[0] ?? null,
        })
        .eq("id", source.id)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      results.push({
        marca: source.slug,
        ok: false,
        scraped: 0,
        inserted: 0,
        updated: 0,
        errors: [errMsg],
        durationMs: Date.now() - started,
      })
      await supabase
        .from("scrape_sources")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_ok: false,
          last_run_count: 0,
          last_run_error: errMsg,
        })
        .eq("id", source.id)
    }
  }
  return results
}
