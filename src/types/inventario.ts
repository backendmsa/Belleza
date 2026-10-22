export type TipoMovimientoInventario =
  'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'DEVOLUCION' | 'GARANTIA' | 'CAMBIO_PRODUCTO'

export interface MovimientoInventario {
  id: string
  variante: string
  varianteId?: string
  productoNombre?: string
  sku?: string
  tipo: TipoMovimientoInventario
  stockAnterior?: number
  stockNuevo?: number
  stockDefectuosoAnterior?: number
  stockDefectuosoNuevo?: number
  cantidad: number
  observaciones: string
  usuario: string
  fecha: string
}

export interface MovimientoPayload {
  variante_id: string
  cantidad: number
  observaciones?: string // Opcionales para entrada, salida y ajuste
}

export interface MovimientoResultado {
  success: boolean
  message: string
  data: {
    id: string
  }
}
