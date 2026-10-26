export interface Variante {
  id: string
  productoId: string
  productoNombre: string
  nombreMostrar: string
  nombre: string
  sku: string
  codigoBarras: string
  costo: number
  precioMenudeo: number
  precioMayoreo: number
  stock: number
  stockDefectuoso: number
  stockMinimo: number
  garantiaMeses: number | null
  activo: boolean
  fechaCreacion?: string
  fechaActualizacion?: string
}

export interface VariantePayload {
  producto: string
  codigo_barras: string
  sku: string
  nombre: string
  stock_minimo: number
  stock?: number // Únicamente al crear la variante
  costo: number
  precio_menudeo: number
  precio_mayoreo: number
  garantia_meses: number | null
}
