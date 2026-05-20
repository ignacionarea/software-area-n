// Catálogo de categorías y sistemas técnicos del PPD.
// Espejo exacto del CATEGORIES_CONFIG del Streamlit del dueño.

export type Prioridad = "Alta" | "Media" | "Baja"

export type SistemaTecnico = {
  name: string
  default_qty: number
  default_env: string
  priority: Prioridad
  /** SKUs preferidos en el catálogo Sonoff/Demasled para convertir a cotización */
  preferredSku?: string[]
  /** Keywords de fallback para matching */
  keywords?: string[]
}

export type SistemaRelevado = {
  name: string
  applies: boolean
  quantity: number
  environment: string
  priority: Prioridad
  comments: string
}

export type SurveyData = {
  [categoria: string]: SistemaRelevado[]
}

export const CATEGORIES_CONFIG: Record<string, SistemaTecnico[]> = {
  "Iluminación Inteligente": [
    {
      name: "Módulos Wifi On/Off",
      default_qty: 1,
      default_env: "Living y Cocina",
      priority: "Media",
      preferredSku: ["MINIR4", "BASICR4"],
      keywords: ["interruptor", "wifi"],
    },
    {
      name: "Fotocélulas",
      default_qty: 1,
      default_env: "Exterior",
      priority: "Baja",
      keywords: ["fotocélula", "fotocelula", "sensor luz"],
    },
    {
      name: "Timers",
      default_qty: 1,
      default_env: "Frente y Jardín",
      priority: "Baja",
      preferredSku: ["MINIR4M"],
      keywords: ["timer", "temporizador"],
    },
    {
      name: "Sensores de movimiento",
      default_qty: 2,
      default_env: "Pasillos y Garage",
      priority: "Media",
      preferredSku: ["SNZB-03P", "SNZB-03"],
      keywords: ["movimiento", "pir"],
    },
    {
      name: "Apagado macro (\"Buenas Noches\")",
      default_qty: 1,
      default_env: "Dormitorio Principal",
      priority: "Alta",
      preferredSku: ["S-MATE", "SONOFF-S-MATE"],
      keywords: ["s-mate", "smate", "scene"],
    },
  ],
  "Climatización y Eficiencia": [
    {
      name: "Termostatos WiFi",
      default_qty: 1,
      default_env: "Estar General",
      priority: "Alta",
      preferredSku: ["TH-ELITE"],
      keywords: ["termostato", "th"],
    },
    {
      name: "Integradores Inverter",
      default_qty: 2,
      default_env: "Dormitorios",
      priority: "Media",
      preferredSku: ["RF-BRIDGER2"],
      keywords: ["rf bridge", "inverter"],
    },
    {
      name: "Pozo Canadiense",
      default_qty: 1,
      default_env: "Planta Baja",
      priority: "Alta",
      // Sin match directo: producto de obra civil, no del catálogo
    },
  ],
  "Gestión Eficiente del Agua": [
    {
      name: "Recolección de agua de lluvia",
      default_qty: 1,
      default_env: "Jardín y Exteriores",
      priority: "Media",
    },
    {
      name: "Recuperación de aguas grises",
      default_qty: 1,
      default_env: "Lavadero y Baños secundarios",
      priority: "Alta",
    },
  ],
  "Carpinterías y Aislación": [
    {
      name: "Láminas de control solar UV/IR",
      default_qty: 4,
      default_env: "Aberturas principales",
      priority: "Alta",
    },
    {
      name: "Cortinas motorizadas",
      default_qty: 2,
      default_env: "Living y Dormitorios",
      priority: "Media",
      preferredSku: ["DUALR3"],
      keywords: ["cortina", "motor"],
    },
    {
      name: "Sensores magnéticos",
      default_qty: 6,
      default_env: "Aberturas perimetrales",
      priority: "Alta",
      preferredSku: ["SNZB-04P", "SNZB-04", "DW2-WIFI"],
      keywords: ["puerta", "ventana", "magnético"],
    },
  ],
  Seguridad: [
    {
      name: "Cerraduras biométricas",
      default_qty: 1,
      default_env: "Acceso Principal",
      priority: "Alta",
      preferredSku: ["SWV-BSP"],
      keywords: ["cerradura"],
    },
    {
      name: "Cámaras perimetrales",
      default_qty: 4,
      default_env: "Exterior / Accesos",
      priority: "Alta",
      preferredSku: ["S-CAM"],
      keywords: ["cámara", "camera"],
    },
    {
      name: "Alarmas automatizadas",
      default_qty: 1,
      default_env: "Planta Baja / Central",
      priority: "Alta",
      keywords: ["alarma"],
    },
  ],
  "Energía Sustentable": [
    {
      name: "Paneles solares",
      default_qty: 4,
      default_env: "Techo / Terraza",
      priority: "Alta",
    },
    {
      name: "Bancos de baterías",
      default_qty: 2,
      default_env: "Sala Técnica / Tableros",
      priority: "Alta",
    },
    {
      name: "Monitoreo de consumo",
      default_qty: 1,
      default_env: "Tablero Principal",
      priority: "Media",
      preferredSku: ["POW-ELITE", "POWCT", "POWR2"],
      keywords: ["pow", "consumo"],
    },
    {
      name: "Redes Mesh",
      default_qty: 3,
      default_env: "Toda la propiedad",
      priority: "Alta",
    },
    {
      name: "Control de Fase Crítica",
      default_qty: 1,
      default_env: "Tablero Principal",
      priority: "Alta",
    },
  ],
  "Expansión de Casa": [
    {
      name: "Obras de Refacción, Ampliación o Puesta en Valor",
      default_qty: 1,
      default_env: "General",
      priority: "Baja",
    },
  ],
}

export const EXPANSION_CATEGORY = "Expansión de Casa"

/** Build the initial survey skeleton with all systems set to applies=false */
export function buildEmptySurvey(): SurveyData {
  const out: SurveyData = {}
  for (const [cat, systems] of Object.entries(CATEGORIES_CONFIG)) {
    out[cat] = systems.map((s) => ({
      name: s.name,
      applies: false,
      quantity: s.default_qty,
      environment: s.default_env,
      priority: s.priority,
      comments: "",
    }))
  }
  return out
}

/** Normalize incoming JSON (which may be the old format or have missing systems) into the canonical SurveyData. */
export function normalizeSurvey(input: unknown): SurveyData {
  const empty = buildEmptySurvey()
  if (!input || typeof input !== "object" || Array.isArray(input)) return empty

  const obj = input as Record<string, unknown>
  // If the input is the new format keyed by category names
  if (Object.keys(CATEGORIES_CONFIG).some((k) => k in obj)) {
    for (const [cat, sistemas] of Object.entries(CATEGORIES_CONFIG)) {
      const arr = (obj[cat] as unknown[]) ?? []
      const merged = sistemas.map((s) => {
        const m = (arr as { name?: string }[]).find((x) => x.name === s.name) as
          | Partial<SistemaRelevado>
          | undefined
        return {
          name: s.name,
          applies: m?.applies ?? false,
          quantity: m?.quantity ?? s.default_qty,
          environment: m?.environment ?? s.default_env,
          priority: (m?.priority as Prioridad) ?? s.priority,
          comments: m?.comments ?? "",
        }
      })
      empty[cat] = merged
    }
  }
  return empty
}

export function countApplied(survey: SurveyData): { total: number; alta: number; media: number; baja: number; equipos: number } {
  let total = 0, alta = 0, media = 0, baja = 0, equipos = 0
  for (const sistemas of Object.values(survey)) {
    for (const s of sistemas) {
      if (!s.applies) continue
      total++
      equipos += s.quantity
      if (s.priority === "Alta") alta++
      else if (s.priority === "Media") media++
      else baja++
    }
  }
  return { total, alta, media, baja, equipos }
}
