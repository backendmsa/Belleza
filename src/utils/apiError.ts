import axios from 'axios'

type ApiErrorValue = string | string[] | Record<string, unknown> | null | undefined

interface ApiErrorBody {
  message?: string
  mensaje?: string
  detail?: string
  errors?: Record<string, string[] | string>
  data?: ApiErrorValue
  [key: string]: ApiErrorValue
}

const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  codigo_barras: 'Código de barras',
  nombre: 'Nombre',
  producto: 'Producto',
  costo: 'Costo',
  precio_menudeo: 'Precio menudeo',
  precio_mayoreo: 'Precio mayoreo',
  stock_minimo: 'Stock mínimo',
  garantia_meses: 'Garantía',
  usuario: 'Usuario',
  email: 'Correo electrónico',
  password: 'Contraseña',
}

function getFirstMessage(value: ApiErrorValue): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim())
    return first?.trim() ?? null
  }

  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      const message = getFirstMessage(nestedValue as ApiErrorValue)
      if (message) return message
    }
  }

  return null
}

function translateValidationMessage(field: string, message: string): string {
  const normalized = message.toLowerCase()

  if (
    field === 'sku' &&
    (normalized.includes('already exists') ||
      normalized.includes('ya existe') ||
      normalized.includes('unique'))
  ) {
    return 'Ya existe una variante con ese SKU. Usa uno diferente.'
  }

  if (
    field === 'codigo_barras' &&
    (normalized.includes('already exists') ||
      normalized.includes('ya existe') ||
      normalized.includes('unique'))
  ) {
    return 'Ya existe una variante con ese código de barras. Usa uno diferente.'
  }

  const label = FIELD_LABELS[field]

  if (label && !message.toLowerCase().startsWith(label.toLowerCase())) {
    return `${label}: ${message}`
  }

  return message
}

function getValidationMessage(body: ApiErrorBody): string | null {
  if (body.errors) {
    for (const [field, value] of Object.entries(body.errors)) {
      const message = getFirstMessage(value)
      if (message) return translateValidationMessage(field, message)
    }
  }

  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    for (const [field, value] of Object.entries(body.data)) {
      const message = getFirstMessage(value as ApiErrorValue)
      if (message) return translateValidationMessage(field, message)
    }
  }

  const ignoredFields = new Set(['success', 'message', 'mensaje', 'detail', 'errors', 'data'])

  for (const [field, value] of Object.entries(body)) {
    if (ignoredFields.has(field)) continue

    const message = getFirstMessage(value)
    if (message) return translateValidationMessage(field, message)
  }

  return null
}


export function getFriendlyError(
  error: unknown,
  fallback = 'No fue posible completar la operación. Intenta nuevamente.',
): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return fallback
  }

  const body = error.response?.data
  const status = error.response?.status

  if (!error.response) {
    return 'No fue posible conectar con el servidor. Verifica tu conexión e intenta nuevamente.'
  }

  const message = body?.message || body?.mensaje || body?.detail

  const genericMessages = new Set([
    'la solicitud no es válida.',
    'no se pudo registrar el artículo.',
    'no se pudo registrar la variante.',
    'no se pudo modificar la variante.',
    'validation error.',
  ])

  const isValidationError = status === 400 || status === 422

  if (
    body &&
    isValidationError &&
    (!message || genericMessages.has(message.trim().toLowerCase()))
  ) {
    const validationMessage = getValidationMessage(body)

    if (validationMessage) {
      return validationMessage
    }
  }

  if (message) {
    return message
  }

  return fallback
}
