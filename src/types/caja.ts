export type EstadoCaja = 'ABIERTA' | 'CERRADA'

export interface Caja {
  id: string
  nombre: string
  estado: EstadoCaja
  activa: boolean
  ocupada?: boolean
  esMia?: boolean
  usuarioApertura?: string | null
  fechaCreacion?: string
  fechaActualizacion?: string
}

export interface CorteCaja {
  id: string
  caja: string
  cajaNombre?: string
  usuario: string
  usuarioNombre?: string
  fechaInicio: string
  fechaFin: string | null
  efectivoInicial: number
  efectivoFinal: number | null
  diferencia: number | null
  totalVentas: number
  numeroVentas: number
  totalReembolsos: number
  efectivoEsperadoActual: number
  totalVentasEfectivo: number
  totalVentasTarjeta: number
  totalVentasTransferencia: number
  totalReembolsosEfectivo: number
  totalReembolsosTarjeta: number
  totalReembolsosTransferencia: number
}

export interface AbrirCajaPayload {
  caja_id: string
  efectivo_inicial: number
}

export interface CerrarCajaPayload {
  caja_id: string
  efectivo_final: number
}
