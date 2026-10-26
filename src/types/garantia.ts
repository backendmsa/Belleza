export type EstadoGarantia = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'FINALIZADA'

export type ResolucionGarantia = 'REEMPLAZO' | 'CAMBIO_PRODUCTO' | 'REPARACION'

export interface Garantia {
  id: string
  ventaFolio: string
  usuario: string
  producto: string
  variante: string
  varianteNueva: string | null
  cantidad: number
  garantiaMeses: number | null
  fechaVencimiento: string | null
  garantiaPlazoHistorico: boolean
  motivo: string
  estado: EstadoGarantia
  resolucion: ResolucionGarantia | null
  observaciones: string
  fecha: string
  fechaActualizacion?: string
}

export interface GarantiaPayload {
  venta_id: string
  detalle_venta_id: string
  variante_id: string
  cantidad: number
  motivo: string
}
