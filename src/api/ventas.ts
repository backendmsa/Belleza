import api from './axios'
import { getAllPages, getBackendPage } from './pagination'

import type {
  EstadoVenta,
  VentaCreateResult,
  VentaDetalle,
  TicketResultado,
  VentaPayload,
  VentaResumen,
} from '@/types/venta'
import type { ApiResponse } from '@/types/api'

interface VentaResumenApi {
  id: string
  folio: string
  fecha: string
  usuario: string
  metodo_pago?: string
  caja?: string
  subtotal?: string | number
  descuento?: string | number
  iva?: string | number
  total: string | number
  estado: EstadoVenta
}

interface VentaDetalleApi {
  id: string
  folio: string
  fecha: string
  usuario: string
  metodo_pago: string
  caja: string
  subtotal: string | number
  descuento?: string | number
  iva: string | number
  total: string | number
  estado: EstadoVenta
  efectivo_recibido?: string | number | null
  cambio?: string | number | null
  productos: Array<{
    detalle_id: string
    variante_id: string
    producto: string
    variante: string
    cantidad: number
    cantidad_disponible: number
    precio_unitario: string | number
    descuento?: string | number
    subtotal: string | number
  }>
}

function mapVentaResumen(item: VentaResumenApi): VentaResumen {
  return {
    id: item.id,
    folio: item.folio,
    fecha: item.fecha,
    usuario: item.usuario,
    metodoPago: item.metodo_pago,
    caja: item.caja,
    subtotal: item.subtotal === undefined ? undefined : Number(item.subtotal),
    descuento: item.descuento === undefined ? undefined : Number(item.descuento),
    iva: item.iva === undefined ? undefined : Number(item.iva),
    total: Number(item.total),
    estado: item.estado,
  }
}

export async function getVentasPage(
  page = 1,
  pageSize = 10,
  filtros?: { search?: string; fecha_desde?: string; fecha_hasta?: string },
) {
  const result = await getBackendPage<VentaResumenApi>(api, '/ventas/', {
    page,
    pageSize,
    params: filtros,
  })

  return {
    ...result,
    items: result.items.map(mapVentaResumen),
  }
}

/** POST /ventas/ devuelve { success, message, data: { id, folio } }.
 * Se normaliza aquí para no depender de la forma de respuesta en la vista.
 * Se admite temporalmente venta_id a nivel raíz por compatibilidad.
 */
interface VentaCreateApi {
  success: boolean
  message?: string
  data?: { id?: string; folio?: string }
  venta_id?: string
  folio?: string
}

export async function createVenta(payload: VentaPayload): Promise<VentaCreateResult> {
  const { data } = await api.post<VentaCreateApi>('/ventas/', payload)
  return {
    success: data.success,
    message: data.message ?? 'Venta registrada correctamente.',
    venta_id: data.data?.id ?? data.venta_id ?? '',
    folio: data.data?.folio ?? data.folio ?? '',
  }
}

export async function getVentas(): Promise<VentaResumen[]> {
  const items = await getAllPages<VentaResumenApi>(api, '/ventas/', { page_size: 200 })

  return items
    .map(mapVentaResumen)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

export async function getVenta(id: string): Promise<VentaDetalle> {
  const { data } = await api.get<ApiResponse<VentaDetalleApi>>(`/ventas/${id}/`)
  const item = data.data

  return {
    id: item.id,
    folio: item.folio,
    fecha: item.fecha,
    usuario: item.usuario,
    metodoPago: item.metodo_pago,
    caja: item.caja,
    efectivoRecibido: item.efectivo_recibido == null ? null : Number(item.efectivo_recibido),
    cambio: item.cambio == null ? null : Number(item.cambio),
    subtotal: Number(item.subtotal),
    descuento: Number(item.descuento ?? 0),
    iva: Number(item.iva),
    total: Number(item.total),
    estado: item.estado,
    productos: item.productos.map((product) => ({
      detalleId: product.detalle_id,
      varianteId: product.variante_id,
      producto: product.producto,
      variante: product.variante,
      cantidad: Number(product.cantidad),
      cantidadDisponible: Number(product.cantidad_disponible ?? product.cantidad),
      precioUnitario: Number(product.precio_unitario),
      descuento: Number(product.descuento ?? 0),
      subtotal: Number(product.subtotal),
    })),
  }
}

export async function cancelVenta(id: string): Promise<string> {
  const { data } = await api.post<{ success: boolean; message: string }>(`/ventas/${id}/cancelar/`)
  return data.message
}

interface TicketApi {
  empresa?: {
    nombre?: string
    telefono?: string | null
    direccion?: string | null
    rfc?: string | null
    mensaje_ticket?: string | null
  }
  venta?: {
    folio?: string
    fecha?: string
    metodo_pago?: string
    efectivo_recibido?: string | number | null
    cambio?: string | number | null
    estado?: EstadoVenta
  }
  usuario?: {
    nombre?: string
  }
  productos?: Array<{
    producto?: string
    variante?: string
    cantidad?: number
    precio?: string | number
    precio_unitario?: string | number
    subtotal?: string | number
  }>
  totales?: {
    subtotal?: string | number
    descuento?: string | number
    iva?: string | number
    total?: string | number
  }
}

function mapTicket(id: string, response: { data?: TicketApi } | TicketApi): TicketResultado {
  const item: TicketApi =
    'data' in response && response.data ? response.data : (response as TicketApi)
  const venta = item.venta ?? {}
  const totals = item.totales ?? {}

  return {
    venta: {
      id,
      folio: venta.folio ?? 'Venta',
      fecha: venta.fecha ?? new Date().toISOString(),
      usuario: item.usuario?.nombre ?? 'Usuario',
      metodoPago: venta.metodo_pago ?? 'No especificado',
      caja: '',
      efectivoRecibido: venta.efectivo_recibido == null ? null : Number(venta.efectivo_recibido),
      cambio: venta.cambio == null ? null : Number(venta.cambio),
      subtotal: Number(totals.subtotal ?? 0),
      descuento: Number(totals.descuento ?? 0),
      iva: Number(totals.iva ?? 0),
      total: Number(totals.total ?? 0),
      estado: venta.estado ?? 'COMPLETADA',
      productos: (item.productos ?? []).map((product) => ({
        detalleId: '',
        varianteId: '',
        producto: product.producto ?? 'Producto',
        variante: product.variante ?? 'Variante',
        cantidad: Number(product.cantidad ?? 0),
        cantidadDisponible: Number(product.cantidad ?? 0),
        precioUnitario: Number(product.precio_unitario ?? product.precio ?? 0),
        descuento: 0,
        subtotal: Number(product.subtotal ?? 0),
      })),
    },
    empresa: item.empresa
      ? {
          nombre: item.empresa.nombre?.trim() ?? '',
          telefono: item.empresa.telefono ?? '',
          direccion: item.empresa.direccion ?? '',
          rfc: item.empresa.rfc ?? '',
          mensajeTicket: item.empresa.mensaje_ticket ?? 'Gracias por su compra.',
        }
      : null,
  }
}

function ticketUrl(id: string): string {
  // Evita enviar /ventas/undefined/ticket/ cuando el backend responde sin id.
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id ?? '')) {
    throw new Error('No se recibió un identificador válido para el ticket.')
  }
  return `/ventas/${id}/ticket/`
}

export async function getTicketVenta(id: string): Promise<TicketResultado> {
  const { data } = await api.get<{ data?: TicketApi } | TicketApi>(ticketUrl(id))
  return mapTicket(id, data)
}

export async function reprintTicketVenta(id: string): Promise<TicketResultado> {
  const { data } = await api.get<{ data?: TicketApi } | TicketApi>(ticketUrl(id))
  return mapTicket(id, data)
}
