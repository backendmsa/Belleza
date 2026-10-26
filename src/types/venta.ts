export interface VarianteVenta {
  id: string
  producto: string
  variante: string
  sku: string
  codigoBarras: string
  stock: number
  stockMinimo: number
  precioMenudeo: number
  precioMayoreo: number
}

export interface CarritoItem {
  variante: VarianteVenta
  cantidad: number
}

export type EstadoVenta = 'COMPLETADA' | 'CANCELADA' | 'DEVUELTA'

export interface VentaResumen {
  id: string
  folio: string
  fecha: string
  usuario: string
  metodoPago?: string
  caja?: string
  subtotal?: number
  descuento?: number
  iva?: number
  total: number
  estado: EstadoVenta
}

export interface DetalleVentaProducto {
  detalleId: string
  varianteId: string
  producto: string
  variante: string
  cantidad: number
  cantidadDisponible: number
  garantiaMeses?: number | null
  garantiaFechaVencimiento?: string | null
  garantiaPlazoHistorico?: boolean
  precioUnitario: number
  descuento: number
  subtotal: number
}

export interface VentaDetalle {
  id: string
  folio: string
  fecha: string
  usuario: string
  metodoPago: string
  caja: string
  subtotal: number
  descuento: number
  iva: number
  total: number
  estado: EstadoVenta
  // Solo en ventas en efectivo registradas con la nueva versión.
  efectivoRecibido?: number | null
  cambio?: number | null
  productos: DetalleVentaProducto[]
}

export interface VentaPayload {
  caja_id: string
  metodo_pago_id: string
  descuento: number
  // Optional: el backend acepta clientes antiguos sin este dato.
  efectivo_recibido?: number
  productos: Array<{
    variante_id: string
    cantidad: number
  }>
}

export interface VentaCreateResult {
  success: boolean
  folio: string
  venta_id: string
  message: string
}

export interface TicketEmpresa {
  nombre: string
  direccion?: string
  telefono?: string
  rfc?: string
  mensajeTicket?: string
}

export interface TicketResultado {
  venta: VentaDetalle
  empresa: TicketEmpresa | null
}
