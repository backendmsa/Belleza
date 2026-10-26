import api from './axios'
import { getAllPages, getBackendPage } from './pagination'

import { unwrapData } from '@/utils/apiResponse'

import type {
  Garantia,
  GarantiaPayload,
  ResolucionGarantia,
} from '@/types/garantia'

interface GarantiaApi {
  id: string
  venta: string
  usuario: string
  producto: string
  variante: string
  variante_nueva?: string | null
  cantidad: number
  garantia_meses: number | null
  fecha_vencimiento?: string | null
  garantia_plazo_historico?: boolean
  motivo: string
  estado: Garantia['estado']
  resolucion?: ResolucionGarantia | null
  observaciones?: string | null
  fecha: string
  fecha_actualizacion?: string
}

function mapGarantia(item: GarantiaApi): Garantia {
  return {
    id: item.id,
    ventaFolio: item.venta,
    usuario: item.usuario,
    producto: item.producto,
    variante: item.variante,
    varianteNueva: item.variante_nueva ?? null,
    cantidad: Number(item.cantidad),
    garantiaMeses: item.garantia_meses == null ? null : Number(item.garantia_meses),
    fechaVencimiento: item.fecha_vencimiento ?? null,
    garantiaPlazoHistorico: item.garantia_plazo_historico ?? false,
    motivo: item.motivo,
    estado: item.estado,
    resolucion: item.resolucion ?? null,
    observaciones: item.observaciones ?? '',
    fecha: item.fecha,
    fechaActualizacion: item.fecha_actualizacion,
  }
}

export async function getGarantias(): Promise<Garantia[]> {
  const items = await getAllPages<GarantiaApi>(api, '/garantias/', { page_size: 200 })
  return items.map(mapGarantia)
}

export async function getGarantiasPage(
  page = 1,
  pageSize = 10,
  filtros?: { search?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string },
) {
  const result = await getBackendPage<GarantiaApi>(api, '/garantias/', {
    page,
    pageSize,
    params: filtros,
  })
  return { ...result, items: result.items.map(mapGarantia) }
}

export async function getGarantia(id: string): Promise<Garantia> {
  const { data } = await api.get(`/garantias/${id}/`)
  return mapGarantia(unwrapData<GarantiaApi>(data))
}

export async function createGarantia(payload: GarantiaPayload): Promise<Garantia> {
  const { data } = await api.post('/garantias/', payload)
  return mapGarantia(unwrapData<GarantiaApi>(data))
}

export async function updateGarantia(id: string, motivo: string): Promise<Garantia> {
  const { data } = await api.put(`/garantias/${id}/`, { motivo })
  return mapGarantia(unwrapData<GarantiaApi>(data))
}

export async function aprobarGarantia(
  id: string,
  payload: {
    resolucion: ResolucionGarantia
    variante_nueva_id?: string | null
    observaciones?: string
  },
): Promise<Garantia> {
  const { data } = await api.post(`/garantias/${id}/aprobar/`, payload)
  return mapGarantia(unwrapData<GarantiaApi>(data))
}

export async function rechazarGarantia(id: string, observaciones = ''): Promise<Garantia> {
  const { data } = await api.post(`/garantias/${id}/rechazar/`, { observaciones })
  return mapGarantia(unwrapData<GarantiaApi>(data))
}

export async function finalizarGarantia(id: string, observaciones = ''): Promise<Garantia> {
  const { data } = await api.post(`/garantias/${id}/finalizar/`, { observaciones })
  return mapGarantia(unwrapData<GarantiaApi>(data))
}
