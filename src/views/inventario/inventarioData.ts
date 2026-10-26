import { getVariante, getVariantesPage } from '@/api/variantes'

import type { MovimientoInventario } from '@/types/inventario'
import type { Variante } from '@/types/variante'

export interface CatalogVariant {
  id: string
  producto: string
  variante: string
  sku: string
  codigoBarras: string
  stock: number
  stockDefectuoso: number
  stockMinimo: number
}

export interface MovimientoVista extends MovimientoInventario {
  producto: string
  sku: string
}

function mapCatalogVariant(item: Variante): CatalogVariant {
  return {
    id: item.id,
    producto: item.nombreMostrar === `${item.productoNombre} - ${item.nombre}`
      ? item.productoNombre : item.nombreMostrar,
    variante: item.nombreMostrar === `${item.productoNombre} - ${item.nombre}`
      ? item.nombre : '',

    sku: item.sku,
    codigoBarras: item.codigoBarras,
    stock: item.stock,
    stockDefectuoso: item.stockDefectuoso,
    stockMinimo: item.stockMinimo,
  }
}

export async function loadInventoryCatalog(page = 1, pageSize = 10, search = '') {
  const result = await getVariantesPage(page, pageSize, undefined, { search })
  return { ...result, items: result.items.map(mapCatalogVariant) }
}

export async function enrichMovements(movimientos: MovimientoInventario[]): Promise<MovimientoVista[]> {
  const ids = [...new Set(movimientos.map((item) => item.varianteId).filter((id): id is string => Boolean(id)))]
  const variants = await Promise.all(ids.map(async (id) => {
    try { return mapCatalogVariant(await getVariante(id)) } catch { return null }
  }))
  const byId = new Map(variants.filter((item): item is CatalogVariant => item !== null).map((item) => [item.id, item]))
  return movimientos.map((item) => {
    const variant = item.varianteId ? byId.get(item.varianteId) : undefined
    return {
      ...item,
      producto: variant?.producto ?? item.productoNombre ?? 'Artículo no identificado',
      variante: variant?.variante ?? item.variante,
      sku: item.sku ?? variant?.sku ?? '—',
    }
  })
}
