import api from './axios'
import { getBackendPage } from './pagination'
import { unwrapData } from '@/utils/apiResponse'

export interface AdvertenciaPrecio {
  campo: string
  mensaje: string
}

/** La entidad de Gestión es una variante, no el Producto padre. */
export interface Articulo {
  varianteId: string
  productoId: string
  nombre: string
  nombreMostrar: string
  categoriaId: string
  categoriaNombre: string
  sku: string
  codigoBarras: string
  costo: number
  precioVenta: number
  precioMayoreo: number
  stock: number
  stockMinimo: number
  activo: boolean
  advertenciasPrecios: AdvertenciaPrecio[]
}

export interface ArticuloFormValues {
  nombre: string
  categoriaId: string
  sku: string
  codigoBarras: string
  costo: number
  precioVenta: number
  precioMayoreo: number
  stockInicial: number
  stockMinimo: number
}

interface ArticuloApi {
  variante_id: string
  producto_id: string
  nombre: string
  nombre_mostrar?: string
  categoria: string
  categoria_nombre: string
  sku: string | null
  codigo_barras: string | null
  costo: string | number
  precio_menudeo: string | number
  precio_mayoreo: string | number
  stock: number
  stock_minimo: number
  activo: boolean
  advertencias_precios?: AdvertenciaPrecio[]
}

interface EdicionApi {
  advertencias_precios?: AdvertenciaPrecio[]
}

function mapArticulo(item: ArticuloApi): Articulo {
  return {
    varianteId: item.variante_id,
    productoId: item.producto_id,
    nombre: item.nombre,
    nombreMostrar: item.nombre_mostrar ?? item.nombre,
    categoriaId: item.categoria,
    categoriaNombre: item.categoria_nombre,
    sku: item.sku ?? '',
    codigoBarras: item.codigo_barras ?? '',
    costo: Number(item.costo),
    precioVenta: Number(item.precio_menudeo),
    precioMayoreo: Number(item.precio_mayoreo),
    stock: Number(item.stock),
    stockMinimo: Number(item.stock_minimo),
    activo: item.activo,
    advertenciasPrecios: item.advertencias_precios ?? [],
  }
}

export async function getArticulosPage(
  page = 1,
  pageSize = 10,
  filtros?: { activo?: 'todos' | 'true' | 'false'; search?: string },
) {
  const result = await getBackendPage<ArticuloApi>(api, '/productos/articulos/', {
    page,
    pageSize,
    params: {
      activo: filtros?.activo,
      search: filtros?.search?.trim().slice(0, 100) || undefined,
    },
  })
  return { ...result, items: result.items.map(mapArticulo) }
}

export async function registrarArticulo(valores: ArticuloFormValues): Promise<Articulo> {
  const { data } = await api.post('/productos/registro-completo/', {
    nombre: valores.nombre.trim(),
    categoria: valores.categoriaId || null,
    sku: valores.sku.trim() || null,
    codigo_barras: valores.codigoBarras.trim() || null,
    costo: valores.costo,
    precio_menudeo: valores.precioVenta,
    precio_mayoreo: valores.precioMayoreo,
    stock: valores.stockInicial,
    stock_minimo: valores.stockMinimo,
  })
  return mapArticulo(unwrapData<ArticuloApi>(data))
}

/** PATCH parcial: no reenviar campos sin cambios, especialmente precios históricos en cero. */
export async function editarArticulo(
  articulo: Articulo,
  valores: ArticuloFormValues,
): Promise<{ cambiado: boolean; advertencias: AdvertenciaPrecio[] }> {
  const cambios: Record<string, string | number | null> = {}
  if (valores.nombre.trim() !== articulo.nombre) cambios.nombre = valores.nombre.trim()
  const categoriaAnterior = articulo.categoriaNombre.trim().toUpperCase() === 'SIN CLASIFICAR'
    ? ''
    : articulo.categoriaId
  if (valores.categoriaId !== categoriaAnterior) {
    cambios.categoria = valores.categoriaId || null
  }
  if (valores.sku.trim() !== articulo.sku) cambios.sku = valores.sku.trim() || null
  if (valores.codigoBarras.trim() !== articulo.codigoBarras) {
    cambios.codigo_barras = valores.codigoBarras.trim() || null
  }
  if (valores.costo !== articulo.costo) cambios.costo = valores.costo
  if (valores.precioVenta !== articulo.precioVenta) {
    cambios.precio_menudeo = valores.precioVenta
  }
  if (valores.precioMayoreo !== articulo.precioMayoreo) {
    cambios.precio_mayoreo = valores.precioMayoreo
  }
  if (valores.stockMinimo !== articulo.stockMinimo) {
    cambios.stock_minimo = valores.stockMinimo
  }

  // stock y producto_id nunca se actualizan desde Gestión.
  if (!Object.keys(cambios).length) return { cambiado: false, advertencias: [] }

  const { data } = await api.patch(
    `/variantes/${encodeURIComponent(articulo.varianteId)}/`,
    cambios,
  )
  const resultado = unwrapData<EdicionApi>(data)
  return { cambiado: true, advertencias: resultado.advertencias_precios ?? [] }
}
