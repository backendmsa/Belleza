import { getVariante, getVariantes } from '@/api/variantes'
import { getVenta, getVentas } from '@/api/ventas'
import { formatDate } from '@/utils/formatDate'

import type { Variante } from '@/types/variante'
import type { VentaDetalle, VentaResumen } from '@/types/venta'

export interface VentaOption {
  label: string
  value: string
}

export interface SoldVariantOption {
  label: string
  value: string
  detalleVentaId: string
  cantidadVendida: number
  cantidadDisponible: number
  garantiaMeses: number | null
  garantiaConocida: boolean
  garantiaFechaVencimiento?: string | null
  garantiaPlazoHistorico?: boolean
}

export interface VentaCatalog {
  ventas: VentaResumen[]
  variantes: Variante[]
}

export async function loadVentaCatalog(): Promise<VentaCatalog> {
  const [ventas, variantes] = await Promise.all([getVentas(), getVariantes()])
  return { ventas, variantes }
}

export function buildVentaOptions(ventas: VentaResumen[]): VentaOption[] {
  return ventas
    .filter((venta) => venta.estado !== 'CANCELADA')
    .map((venta) => ({
      label: `${venta.folio} · ${formatDate(venta.fecha)} · ${venta.usuario}`,
      value: venta.id,
    }))
}

export async function loadSoldVariantOptions(
  ventaId: string,
): Promise<{ detalle: VentaDetalle; opciones: SoldVariantOption[] }> {
  const detalle = await getVenta(ventaId)

  const opciones = await Promise.all(detalle.productos
    .filter((linea) => linea.cantidadDisponible > 0)
    .map(async (linea) => {
      // El detalle conserva el plazo original; para APIs anteriores mantenemos fallback.
      const variante = linea.garantiaMeses === undefined
        ? await getVariante(linea.varianteId).catch(() => null)
        : null
      return {
        value: linea.varianteId,
        detalleVentaId: linea.detalleId,
        label: `${linea.producto} - ${linea.variante} · ${linea.cantidadDisponible} disponibles`,
        cantidadVendida: linea.cantidad,
        cantidadDisponible: linea.cantidadDisponible,
        garantiaMeses: linea.garantiaMeses === undefined ? (variante?.garantiaMeses ?? null) : linea.garantiaMeses,
        garantiaConocida: linea.garantiaMeses !== undefined || Boolean(variante),
        garantiaFechaVencimiento: linea.garantiaFechaVencimiento ?? null,
        garantiaPlazoHistorico: linea.garantiaPlazoHistorico ?? false,
      }
    }))

  return { detalle, opciones }
}
