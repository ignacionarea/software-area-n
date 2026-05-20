import "server-only"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { ScrapedProduct, ScrapeResult } from "./types"
import { scrapeSonoff } from "./sonoff"
import { scrapeDemasled } from "./demasled"

type Source = "sonoff" | "demasled"

export type RunOptions = {
  sources?: Source[]
  demasledMaxPages?: number
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
  products: ScrapedProduct[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  if (products.length === 0) return { inserted: 0, updated: 0, errors: [] }
  const errors: string[] = []

  // First, check which (marca,url) already exist to count updates vs inserts.
  const urls = products.map((p) => p.url)
  const { data: existing } = await supabase
    .from("productos")
    .select("url, marca")
    .eq("marca", products[0].marca)
    .in("url", urls)
  const existingSet = new Set((existing ?? []).map((r) => r.url))

  const rows = products.map((p) => ({
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
  }))

  const { error } = await supabase.from("productos").upsert(rows, { onConflict: "marca,url" })
  if (error) errors.push(error.message)

  const updated = products.filter((p) => existingSet.has(p.url)).length
  const inserted = products.length - updated
  return { inserted, updated, errors }
}

export async function runScrapers(opts: RunOptions = {}): Promise<ScrapeResult[]> {
  const sources = opts.sources ?? ["sonoff", "demasled"]
  const supabase = await getDbClient(opts.asAdmin ?? false)

  const results: ScrapeResult[] = []
  for (const source of sources) {
    const started = Date.now()
    try {
      const products =
        source === "sonoff"
          ? await scrapeSonoff()
          : await scrapeDemasled({ maxPages: opts.demasledMaxPages ?? 100 })

      const { inserted, updated, errors } = await upsertProducts(supabase, products)
      results.push({
        marca: source,
        ok: errors.length === 0,
        scraped: products.length,
        inserted,
        updated,
        errors,
        durationMs: Date.now() - started,
      })
    } catch (e) {
      results.push({
        marca: source,
        ok: false,
        scraped: 0,
        inserted: 0,
        updated: 0,
        errors: [String(e instanceof Error ? e.message : e)],
        durationMs: Date.now() - started,
      })
    }
  }
  return results
}
