/**
 * Presentación de los reportes del negocio.
 * Los identificadores siguen disponibles internamente, pero no se enseñan ni exportan.
 * Todos los valores financieros se muestran tal como los calcula el backend.
 */

const LABELS: Record<string, string> = {
  activo: 'Activo',
  caja: 'Caja',
  cantidad: 'Cantidad',
  cantidad_vendida: 'Unidades vendidas',
  codigo_barras: 'Código de barras',
  costo: 'Costo',
  descuento: 'Descuento',
  diferencia: 'Diferencia de efectivo',
  efectivo_esperado_actual: 'Efectivo esperado en caja',
  efectivo_final: 'Efectivo contado',
  efectivo_inicial: 'Efectivo inicial',
  estado: 'Estado',
  fecha: 'Fecha',
  fecha_actualizacion: 'Última actualización',
  fecha_fin: 'Fecha de cierre',
  fecha_inicio: 'Fecha de apertura',
  folio: 'Folio',
  iva: 'IVA',
  metodo_pago: 'Método de pago',
  motivo: 'Motivo',
  necesita_reposicion: 'Necesita reposición',
  numero_ventas: 'Número de ventas',
  observaciones: 'Observaciones',
  precio_mayoreo: 'Precio mayoreo',
  precio_menudeo: 'Precio menudeo',
  precio_unitario: 'Precio unitario',
  producto: 'Producto',
  productos: 'Productos devueltos',
  resolucion: 'Resolución',
  sku: 'SKU',
  stock_actual: 'Stock actual',
  stock_anterior: 'Stock anterior',
  stock_defectuoso: 'Stock defectuoso',
  stock_defectuoso_anterior: 'Defectuosos anteriores',
  stock_defectuoso_nuevo: 'Defectuosos nuevos',
  stock_minimo: 'Stock mínimo',
  stock_nuevo: 'Stock nuevo',
  subtotal: 'Subtotal',
  tipo: 'Tipo',
  total: 'Total',
  total_devuelto: 'Total devuelto',
  total_generado: 'Total vendido',
  total_reembolsos: 'Reembolsos en efectivo',
  total_ventas: 'Ventas totales',
  usuario: 'Usuario',
  variante: 'Variante',
  variante_nueva: 'Variante de reemplazo',
  venta_folio: 'Folio de venta',
}

const MONEY_FIELDS = new Set([
  'costo',
  'descuento',
  'diferencia',
  'efectivo_esperado_actual',
  'efectivo_final',
  'efectivo_inicial',
  'iva',
  'monto',
  'precio_mayoreo',
  'precio_menudeo',
  'precio_unitario',
  'reembolsos',
  'subtotal',
  'total',
  'total_devuelto',
  'total_generado',
  'total_reembolsos',
  'total_ventas',
])

const ENUM_FIELDS = new Set(['estado', 'tipo', 'resolucion', 'metodo_pago'])
const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function isInternalReportField(field: string): boolean {
  return /^(?:id|uuid|id_.+|.+_(?:id|uuid))$/i.test(field)
}

export function isMoneyReportField(field: string): boolean {
  return MONEY_FIELDS.has(field)
}

export function isDateReportField(field: string): boolean {
  return (
    field === 'fecha' || field.startsWith('fecha_') || /^(?:created_at|updated_at)$/.test(field)
  )
}

export function getVisibleReportFields(rows: ReadonlyArray<Record<string, unknown>>): string[] {
  return [
    ...new Set(
      rows.flatMap((row) => Object.keys(row).filter((field) => !isInternalReportField(field))),
    ),
  ]
}

export function getReportLabel(field: string): string {
  return (
    LABELS[field] ??
    field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('es-MX'))
  )
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string') return '—'

  // La fecha sin hora no debe cambiar de día por la zona horaria del navegador.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value.replace(/(\.\d{3})\d+(?=[Z+-]|$)/, '$1'))

  if (Number.isNaN(date.getTime())) return value

  return dateOnly ? dateFormatter.format(date) : dateTimeFormatter.format(date)
}

function formatMoney(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '') return '—'
  const amount = Number(value)

  return Number.isFinite(amount) ? moneyFormatter.format(amount) : String(value)
}

function formatEnum(value: string): string {
  const word = value.replaceAll('_', ' ').toLocaleLowerCase('es-MX')
  return word.charAt(0).toLocaleUpperCase('es-MX') + word.slice(1)
}

function formatProductLine(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return String(value ?? '—')
  }

  const item = value as Record<string, unknown>
  const title = [item.producto, item.variante].filter(Boolean).join(' · ')
  const quantity = item.cantidad != null ? `${item.cantidad} ud.` : ''
  const subtotal = item.subtotal != null ? formatMoney(item.subtotal) : ''

  return [title, quantity, subtotal].filter(Boolean).join(' · ') || '—'
}

export function formatReportCell(field: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (isDateReportField(field)) return formatDate(value)
  if (isMoneyReportField(field)) return formatMoney(value)

  if (Array.isArray(value)) {
    if (!value.length) return '—'
    if (field === 'productos') return value.map(formatProductLine).join('; ')

    return value.map((item) => formatReportCell(field, item)).join('; ')
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => !isInternalReportField(key),
    )
    return (
      entries
        .map(
          ([key, nestedValue]) => `${getReportLabel(key)}: ${formatReportCell(key, nestedValue)}`,
        )
        .join(' · ') || '—'
    )
  }

  if (typeof value === 'string' && ENUM_FIELDS.has(field)) return formatEnum(value)
  return String(value)
}
