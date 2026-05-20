import type { Database } from "@/types/database"

type Producto = Database["public"]["Tables"]["productos"]["Row"]

/**
 * Cada preset representa una "intención" del cliente (ej: "controlar 1 luz por WiFi").
 * El matching busca en el catálogo por SKUs preferidos primero, después por palabras clave.
 * Si nada matchea, devuelve null y se omite del PPD.
 */
export type Preset = {
  id: string
  label: string
  hint: string
  /** SKUs preferidos por orden de prioridad — el primero que matchee gana. */
  preferredSku?: string[]
  /** Palabras clave de fallback (todas tienen que matchear en nombre o descripción). */
  keywords?: string[]
}

export const PRESETS: Record<string, Preset> = {
  // ─── Iluminación ────────────────────────────────────────────
  switch_wifi_basico: {
    id: "switch_wifi_basico",
    label: "Llave WiFi básica (oculto)",
    hint: "Se monta detrás de la llave tradicional, controla 1 punto por WiFi/Alexa/Google",
    preferredSku: ["MINIR4", "BASICR4"],
    keywords: ["interruptor", "wifi"],
  },
  switch_touch_1g: {
    id: "switch_touch_1g",
    label: "Llave táctil de pared · 1 canal",
    hint: "Reemplaza la llave física, vidrio con touch",
    preferredSku: ["T5-1C", "T5-1C-120", "T5 1C"],
    keywords: ["interruptor", "touch", "1 canal"],
  },
  switch_touch_2g: {
    id: "switch_touch_2g",
    label: "Llave táctil de pared · 2 canales",
    hint: "Para dos circuitos (ej: dos luces en una habitación)",
    preferredSku: ["T5-2C", "T5-2C-120", "T5 2C"],
    keywords: ["interruptor", "touch", "2 canal"],
  },
  switch_touch_3g: {
    id: "switch_touch_3g",
    label: "Llave táctil de pared · 3 canales",
    hint: "Tres circuitos en una sola llave",
    preferredSku: ["T5-3C-120", "T5-3C"],
    keywords: ["interruptor", "touch", "3 canal"],
  },
  dimmer: {
    id: "dimmer",
    label: "Dimmer (regulador de intensidad)",
    hint: "Para luces dimerizables, controlable por app",
    preferredSku: ["D1", "RL560"],
    keywords: ["dimmer"],
  },
  // ─── Cortinas ─────────────────────────────────────────────────
  cortina_smart: {
    id: "cortina_smart",
    label: "Controlador de cortina/persiana",
    hint: "Sube y baja cortinas eléctricas por WiFi",
    preferredSku: ["DUALR3", "MINIR4M"],
    keywords: ["cortina", "motor"],
  },
  // ─── Climatización ────────────────────────────────────────────
  control_ac: {
    id: "control_ac",
    label: "Control de aire acondicionado",
    hint: "Controla el AC por WiFi como si fuera el control remoto",
    preferredSku: ["RF-BRIDGER2", "BridgePro"],
    keywords: ["bridge", "rf"],
  },
  termostato: {
    id: "termostato",
    label: "Sensor de temperatura y humedad",
    hint: "Monitorea ambiente, dispara automatizaciones por temperatura",
    preferredSku: ["SNZB-02D", "SNZB-02"],
    keywords: ["sensor", "temperatura"],
  },
  // ─── Seguridad ────────────────────────────────────────────────
  camara_interior: {
    id: "camara_interior",
    label: "Cámara WiFi interior",
    hint: "Visualización en vivo + grabación + detección de movimiento",
    preferredSku: ["S-CAM"],
    keywords: ["cámara", "camera"],
  },
  sensor_movimiento: {
    id: "sensor_movimiento",
    label: "Sensor de movimiento",
    hint: "Activa luces o alarma cuando detecta presencia",
    preferredSku: ["SNZB-03P", "SNZB-03"],
    keywords: ["movimiento", "pir"],
  },
  sensor_puerta: {
    id: "sensor_puerta",
    label: "Sensor de apertura puerta/ventana",
    hint: "Detecta cuando se abre/cierra una puerta o ventana",
    preferredSku: ["DW2-WIFI", "SNZB-04P", "SNZB-04"],
    keywords: ["puerta", "ventana"],
  },
  // ─── Accesos ──────────────────────────────────────────────────
  cerradura: {
    id: "cerradura",
    label: "Cerradura inteligente",
    hint: "Abre con el celular, biometría o código",
    preferredSku: ["SWV-BSP"],
    keywords: ["cerradura"],
  },
  nfc: {
    id: "nfc",
    label: "Tag NFC para automatizaciones",
    hint: "Tarjetas para disparar acciones con el celular acercándolo",
    preferredSku: ["NFC TAG", "NFC-TAG"],
    keywords: ["nfc"],
  },
  // ─── Hub ──────────────────────────────────────────────────────
  hub_zigbee: {
    id: "hub_zigbee",
    label: "Hub Zigbee (centraliza sensores)",
    hint: "Necesario si vas a usar varios sensores Zigbee",
    preferredSku: ["ZB-BRIDGE-PRO", "ZB Bridge"],
    keywords: ["zigbee", "bridge"],
  },
  // ─── Panel central ────────────────────────────────────────────
  panel_central: {
    id: "panel_central",
    label: "Pantalla NSPanel (control central)",
    hint: "Pantalla táctil que reemplaza varias llaves y muestra estados",
    preferredSku: ["NSPANEL120-PRO", "NSPANEL"],
    keywords: ["nspanel", "panel"],
  },
}

export function matchPreset(preset: Preset, productos: Producto[]): Producto | null {
  // 1. Try SKU match (exact, case-insensitive)
  if (preset.preferredSku) {
    for (const sku of preset.preferredSku) {
      const skuLower = sku.toLowerCase().replace(/\s+/g, "")
      const m = productos.find(
        (p) => (p.sku ?? "").toLowerCase().replace(/\s+/g, "") === skuLower
      )
      if (m) return m
    }
    // SKU prefix match
    for (const sku of preset.preferredSku) {
      const skuLower = sku.toLowerCase()
      const m = productos.find((p) => (p.sku ?? "").toLowerCase().startsWith(skuLower))
      if (m) return m
    }
  }
  // 2. Keyword match (all keywords must appear in nombre or sku)
  if (preset.keywords && preset.keywords.length > 0) {
    const matches = productos.filter((p) => {
      const hay = `${p.nombre} ${p.sku ?? ""} ${p.categoria ?? ""}`.toLowerCase()
      return preset.keywords!.every((k) => hay.includes(k.toLowerCase()))
    })
    if (matches.length > 0) {
      // Pick the cheapest match as a sensible default
      return matches.sort((a, b) => Number(a.precio_origen) - Number(b.precio_origen))[0]
    }
  }
  return null
}
