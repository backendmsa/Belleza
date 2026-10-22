import api from './axios'
import { getAllPages, getBackendPage } from './pagination'

import { unwrapData } from '@/utils/apiResponse'
import { getProducto } from './productos'

import type { Variante, VariantePayload } from '@/types/variante'

interface VarianteApi {
  id: string
  producto: string
  producto_nombre?: string
  productoNombre?: string
  codigo_barras: string | null
  sku: string | null
  nombre: string
  stock: number
  stock_defectuoso?: number
  stock_minimo: number
  costo: string | number
  precio_menudeo: string | number
  precio_mayoreo: string | number
  garantia_meses: number | null
  activo: boolean
  fecha_creacion?: string
  fecha_actualizacion?: string
}

function mapVariante(item: VarianteApi): Variante {
  return {
    id: item.id,
    productoId: item.producto,
    productoNombre: item.producto_nombre ?? item.productoNombre ?? '',
    codigoBarras: item.codigo_barras ?? '',
    sku: item.sku ?? '',
    nombre: item.nombre,
    stock: Number(item.stock),
    stockDefectuoso: Number(item.stock_defectuoso ?? 0),
    stockMinimo: Number(item.stock_minimo),
    costo: Number(item.costo),
    precioMenudeo: Number(item.precio_menudeo),
    precioMayoreo: Number(item.precio_mayoreo),
    garantiaMeses: item.garantia_meses,
    activo: item.activo,
    fechaCreacion: item.fecha_creacion,
    fechaActualizacion: item.fecha_actualizacion,
  }
}

export async function getVariantesPage(
  page = 1,
  pageSize = 10,
  activo?: 'todos' | 'true' | 'false',
  filtros?: { search?: string; producto?: string },
) {
  const result = await getBackendPage<VarianteApi>(api, '/variantes/', {
    page,
    pageSize,
    params: { activo, search: filtros?.search?.trim() || undefined, producto: filtros?.producto },
  })

  const items = await Promise.all(result.items.map(async (item) => {
    const mapped = mapVariante(item)
    if (!mapped.productoNombre && mapped.productoId) {
      mapped.productoNombre = (await getProducto(mapped.productoId)).nombre
    }
    return mapped
  }))
  return {
    ...result,
    items,
  }
}

export async function getVariantesByProduct(producto: string, activo?: 'todos' | 'true' | 'false') {
  const items = await getAllPages<VarianteApi>(api, '/variantes/', {
    producto,
    activo,
    page_size: 200,
  })
  return items.map(mapVariante)
}

export async function getVariante(id: string): Promise<Variante> {
  const { data } = await api.get(`/variantes/${encodeURIComponent(id)}/`)
  const item = mapVariante(unwrapData<VarianteApi>(data))
  if (!item.productoNombre && item.productoId) item.productoNombre = (await getProducto(item.productoId)).nombre
  return item
}

export async function getVariantes(activo?: 'todos' | 'true' | 'false'): Promise<Variante[]> {
  const items = await getAllPages<VarianteApi>(api, '/variantes/', {
    page_size: 200,
    activo,
  })
  return items.map(mapVariante)
}

export async function getVarianteByCode(codigo: string): Promise<Variante> {
  const { data } = await api.get(`/variantes/codigo/${encodeURIComponent(codigo)}/`)
  const item = mapVariante(unwrapData<VarianteApi>(data))
  if (!item.productoNombre && item.productoId) item.productoNombre = (await getProducto(item.productoId)).nombre
  return item
}

export async function createVariante(payload: VariantePayload): Promise<Variante> {
  const { data } = await api.post('/variantes/', payload)
  return mapVariante(unwrapData<VarianteApi>(data))
}

export async function updateVariante(id: string, payload: VariantePayload): Promise<Variante> {
  // producto y stock son inmutables desde edición de variantes.
  const { producto: _producto, stock: _stock, ...editable } = payload
  void _producto
  void _stock
  const { data } = await api.patch(`/variantes/${id}/`, editable)
  return mapVariante(unwrapData<VarianteApi>(data))
}

export async function activarVariante(id: string): Promise<void> {
  await api.post(`/variantes/${id}/activar/`)
}

export async function desactivarVariante(id: string): Promise<void> {
  await api.post(`/variantes/${id}/desactivar/`)
}
