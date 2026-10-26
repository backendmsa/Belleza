import api from './axios'
import { getAllPages, getBackendPage } from './pagination'

import type { AbrirCajaPayload, Caja, CerrarCajaPayload, CorteCaja } from '@/types/caja'
import type { ApiResponse } from '@/types/api'

interface CajaApi {
  id: string
  nombre: string
  estado: 'ABIERTA' | 'CERRADA'
  activa: boolean
  ocupada?: boolean
  es_mia?: boolean
  usuario_apertura?: string | null
  fecha_creacion?: string
  fecha_actualizacion?: string
}

interface CorteApi {
  id: string
  caja: string
  caja_nombre?: string
  usuario: string
  usuario_nombre?: string
  fecha_inicio: string
  fecha_fin?: string | null
  efectivo_inicial: string | number
  efectivo_final?: string | number | null
  diferencia?: string | number | null
  total_ventas?: string | number
  numero_ventas?: number
  total_reembolsos?: string | number
  efectivo_esperado_actual?: string | number
  total_ventas_efectivo?: string | number
  total_ventas_tarjeta?: string | number
  total_ventas_transferencia?: string | number
  total_reembolsos_efectivo?: string | number
  total_reembolsos_tarjeta?: string | number
  total_reembolsos_transferencia?: string | number
}

function mapCaja(item: CajaApi): Caja {
  return {
    id: item.id,
    nombre: item.nombre,
    estado: item.estado,
    activa: item.activa,
    ocupada: item.ocupada,
    esMia: item.es_mia,
    usuarioApertura: item.usuario_apertura ?? null,
    fechaCreacion: item.fecha_creacion,
    fechaActualizacion: item.fecha_actualizacion,
  }
}

function mapCorte(item: CorteApi): CorteCaja {
  return {
    id: item.id,
    caja: item.caja,
    cajaNombre: item.caja_nombre,
    usuario: item.usuario,
    usuarioNombre: item.usuario_nombre,
    fechaInicio: item.fecha_inicio,
    fechaFin: item.fecha_fin ?? null,
    efectivoInicial: Number(item.efectivo_inicial),
    efectivoFinal:
      item.efectivo_final === null || item.efectivo_final === undefined
        ? null
        : Number(item.efectivo_final),
    diferencia:
      item.diferencia === null || item.diferencia === undefined ? null : Number(item.diferencia),
    totalVentas: Number(item.total_ventas ?? 0),
    numeroVentas: Number(item.numero_ventas ?? 0),
    totalReembolsos: Number(item.total_reembolsos ?? 0),
    efectivoEsperadoActual: Number(item.efectivo_esperado_actual ?? item.efectivo_inicial ?? 0),
    totalVentasEfectivo: Number(item.total_ventas_efectivo ?? 0),
    totalVentasTarjeta: Number(item.total_ventas_tarjeta ?? 0),
    totalVentasTransferencia: Number(item.total_ventas_transferencia ?? 0),
    totalReembolsosEfectivo: Number(item.total_reembolsos_efectivo ?? 0),
    totalReembolsosTarjeta: Number(item.total_reembolsos_tarjeta ?? 0),
    totalReembolsosTransferencia: Number(item.total_reembolsos_transferencia ?? 0),
  }
}

export async function getCajas(): Promise<Caja[]> {
  const { data } = await api.get<ApiResponse<CajaApi[]>>('/cajas/')
  return data.data.map(mapCaja)
}

export async function getCajasActivas(): Promise<Caja[]> {
  const { data } = await api.get<ApiResponse<CajaApi[]>>('/cajas/activas/')

  return data.data.map(mapCaja)
}

export async function createCaja(nombre: string): Promise<string> {
  const { data } = await api.post<ApiResponse<{ id: string }>>('/cajas/', {
    nombre,
  })

  return data.data.id
}

export async function abrirCaja(payload: AbrirCajaPayload) {
  const { data } = await api.post<
    ApiResponse<{
      corte_id: string
      fecha_inicio: string
    }>
  >('/caja/abrir/', payload)

  return data
}

export async function cerrarCaja(payload: CerrarCajaPayload) {
  const { data } = await api.post<
    ApiResponse<{
      corte_id: string
      efectivo_esperado: string | number
      efectivo_contado: string | number
      diferencia: string | number
    }>
  >('/caja/cerrar/', payload)

  return {
    ...data,
    data: {
      corteId: data.data.corte_id,
      efectivoEsperado: Number(data.data.efectivo_esperado),
      efectivoContado: Number(data.data.efectivo_contado),
      diferencia: Number(data.data.diferencia),
    },
  }
}

export async function getCorteActivo(cajaId: string): Promise<CorteCaja> {
  const { data } = await api.get<ApiResponse<CorteApi>>('/caja/corte/activo/', {
    params: { caja_id: cajaId },
  })
  return mapCorte(data.data)
}

// La consulta individual aplica los mismos permisos que el historial.
export async function getCortePorId(corteId: string): Promise<CorteCaja> {
  // Este endpoint devuelve CorteApi directamente, sin envoltura { data: ... }.
  const { data } = await api.get<CorteApi>(
    `/caja/${encodeURIComponent(corteId)}/`,
  )
  return mapCorte(data)
}

export async function getHistorialCortes(cajaId: string): Promise<CorteCaja[]> {
  const items = await getAllPages<CorteApi>(api, `/caja/cajas/${cajaId}/cortes/`, {
    page_size: 200,
  })
  return items.map(mapCorte)
}

export async function activarCaja(id: string): Promise<void> {
  await api.post(`/cajas/${id}/activar/`)
}

export async function desactivarCaja(id: string): Promise<void> {
  await api.post(`/cajas/${id}/desactivar/`)
}

export async function updateCaja(id: string, nombre: string): Promise<void> {
  await api.patch(`/cajas/${id}/`, { nombre })
}

export async function getCortesPage(page = 1, pageSize = 50) {
  const result = await getBackendPage<CorteApi>(api, '/caja/', { page, pageSize })
  return { ...result, items: result.items.map(mapCorte) }
}

export interface MovimientoCaja {
  id: string
  corte_caja: string
  metodo_pago: string
  tipo: 'REEMBOLSO'
  monto: string
  devolucion: string
  observaciones: string
  usuario: string
  fecha: string
}
export async function getMovimientosCaja(corteId: string): Promise<MovimientoCaja[]> {
  return getAllPages<MovimientoCaja>(api, `/caja/${encodeURIComponent(corteId)}/movimientos/`, {
    page_size: 200,
  })
}
