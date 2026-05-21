export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          created_at: string
          cuit_dni: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          created_at?: string
          cuit_dni?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          created_at?: string
          cuit_dni?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          banco: string | null
          categoria_afip: string | null
          cbu_alias: string | null
          comision_porcentaje: number
          condicion_iva: string
          condiciones_pago: string | null
          cuit: string | null
          direccion: string | null
          email: string | null
          fecha_inicio_actividad: string | null
          id: boolean
          razon_social: string
          telefono: string | null
          texto_legal_pdf: string | null
          updated_at: string
          validez_default_dias: number
        }
        Insert: {
          banco?: string | null
          categoria_afip?: string | null
          cbu_alias?: string | null
          comision_porcentaje?: number
          condicion_iva?: string
          condiciones_pago?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          fecha_inicio_actividad?: string | null
          id?: boolean
          razon_social?: string
          telefono?: string | null
          texto_legal_pdf?: string | null
          updated_at?: string
          validez_default_dias?: number
        }
        Update: {
          banco?: string | null
          categoria_afip?: string | null
          cbu_alias?: string | null
          comision_porcentaje?: number
          condicion_iva?: string
          condiciones_pago?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          fecha_inicio_actividad?: string | null
          id?: boolean
          razon_social?: string
          telefono?: string | null
          texto_legal_pdf?: string | null
          updated_at?: string
          validez_default_dias?: number
        }
        Relationships: []
      }
      cotizaciones: {
        Row: {
          cliente_id: string | null
          cotizacion_dolar: number
          created_at: string
          enviada_a: string | null
          enviada_at: string | null
          estado: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_emision: string
          id: string
          notas: string | null
          numero: number
          updated_at: string
          validez_dias: number
        }
        Insert: {
          cliente_id?: string | null
          cotizacion_dolar: number
          created_at?: string
          enviada_a?: string | null
          enviada_at?: string | null
          estado?: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_emision?: string
          id?: string
          notas?: string | null
          numero?: number
          updated_at?: string
          validez_dias?: number
        }
        Update: {
          cliente_id?: string | null
          cotizacion_dolar?: number
          created_at?: string
          enviada_a?: string | null
          enviada_at?: string | null
          estado?: Database["public"]["Enums"]["estado_cotizacion"]
          fecha_emision?: string
          id?: string
          notas?: string | null
          numero?: number
          updated_at?: string
          validez_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      items_cotizacion: {
        Row: {
          cantidad: number
          concepto: string
          cotizacion_id: string
          created_at: string
          id: string
          orden: number
          precio_unitario_ars: number
          precio_unitario_usd: number
          producto_id: string | null
          tipo: Database["public"]["Enums"]["tipo_item"]
          url_producto: string | null
        }
        Insert: {
          cantidad?: number
          concepto: string
          cotizacion_id: string
          created_at?: string
          id?: string
          orden?: number
          precio_unitario_ars: number
          precio_unitario_usd: number
          producto_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_item"]
          url_producto?: string | null
        }
        Update: {
          cantidad?: number
          concepto?: string
          cotizacion_id?: string
          created_at?: string
          id?: string
          orden?: number
          precio_unitario_ars?: number
          precio_unitario_usd?: number
          producto_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_item"]
          url_producto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_cotizacion_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_cotizacion_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "v_cotizaciones_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_cotizacion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppd_proyectos: {
        Row: {
          cliente_id: string | null
          cotizacion_id: string | null
          created_at: string
          descripcion: string | null
          direccion_proyecto: string | null
          estado: Database["public"]["Enums"]["ppd_estado"]
          fecha_relevamiento: string | null
          id: string
          items: Json
          notas: string | null
          tecnico_relevador: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          cotizacion_id?: string | null
          created_at?: string
          descripcion?: string | null
          direccion_proyecto?: string | null
          estado?: Database["public"]["Enums"]["ppd_estado"]
          fecha_relevamiento?: string | null
          id?: string
          items?: Json
          notas?: string | null
          tecnico_relevador?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          cotizacion_id?: string | null
          created_at?: string
          descripcion?: string | null
          direccion_proyecto?: string | null
          estado?: Database["public"]["Enums"]["ppd_estado"]
          fecha_relevamiento?: string | null
          id?: string
          items?: Json
          notas?: string | null
          tecnico_relevador?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppd_proyectos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppd_proyectos_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria: string | null
          created_at: string
          descripcion: string | null
          es_manual: boolean
          id: string
          imagen_url: string | null
          marca: string
          moneda_origen: Database["public"]["Enums"]["moneda"]
          nombre: string
          precio_origen: number
          sku: string | null
          updated_at: string
          url: string | null
          variantes: Json
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          es_manual?: boolean
          id?: string
          imagen_url?: string | null
          marca: string
          moneda_origen?: Database["public"]["Enums"]["moneda"]
          nombre: string
          precio_origen: number
          sku?: string | null
          updated_at?: string
          url?: string | null
          variantes?: Json
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          created_at?: string
          descripcion?: string | null
          es_manual?: boolean
          id?: string
          imagen_url?: string | null
          marca?: string
          moneda_origen?: Database["public"]["Enums"]["moneda"]
          nombre?: string
          precio_origen?: number
          sku?: string | null
          updated_at?: string
          url?: string | null
          variantes?: Json
        }
        Relationships: []
      }
      scrape_sources: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          last_run_at: string | null
          last_run_count: number | null
          last_run_error: string | null
          last_run_ok: boolean | null
          max_pages: number
          nombre: string
          platform: string
          slug: string
          updated_at: string
          url_base: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          last_run_at?: string | null
          last_run_count?: number | null
          last_run_error?: string | null
          last_run_ok?: boolean | null
          max_pages?: number
          nombre: string
          platform?: string
          slug: string
          updated_at?: string
          url_base: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          last_run_at?: string | null
          last_run_count?: number | null
          last_run_error?: string | null
          last_run_ok?: boolean | null
          max_pages?: number
          nombre?: string
          platform?: string
          slug?: string
          updated_at?: string
          url_base?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_clientes_resumen: {
        Row: {
          id: string | null
          nombre: string | null
          telefono: string | null
          email: string | null
          direccion: string | null
          cuit_dni: string | null
          created_at: string | null
          total_cotizaciones: number | null
          cotizaciones_aceptadas: number | null
        }
        Relationships: []
      }
      v_cotizaciones_resumen: {
        Row: {
          cantidad_items: number | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          cotizacion_dolar: number | null
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_cotizacion"] | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: string | null
          numero: number | null
          numero_formateado: string | null
          total_ars: number | null
          total_usd: number | null
          updated_at: string | null
          validez_dias: number | null
        }
        Relationships: []
      }
      v_dashboard_mensual: {
        Row: {
          aceptadas: number | null
          comisiones_ars: number | null
          conversion_rate_pct: number | null
          enviadas: number | null
          ganancia_ars: number | null
          mano_obra_ars: number | null
          mes: string | null
          plata_movida_ars: number | null
          rechazadas: number | null
          vencidas: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      marcar_cotizaciones_vencidas: { Args: never; Returns: number }
    }
    Enums: {
      estado_cotizacion:
        | "borrador"
        | "enviada"
        | "aceptada"
        | "rechazada"
        | "vencida"
      moneda: "ARS" | "USD"
      ppd_estado: "borrador" | "descartado" | "convertido"
      tipo_item: "producto" | "mano_obra"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
