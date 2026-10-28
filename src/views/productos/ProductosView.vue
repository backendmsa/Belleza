<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { CheckCircleIcon, NoSymbolIcon, PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import StatusChip from '@/components/common/StatusChip.vue'

import ArticuloForm from './components/ArticuloForm.vue'
import PrecioMasivoModal from './components/PrecioMasivoModal.vue'

import { getCategorias } from '@/api/categorias'
import { editarArticulo, getArticulosPage, registrarArticulo } from '@/api/articulos'
import { activarVariante, desactivarVariante } from '@/api/variantes'
import { getFriendlyError } from '@/utils/apiError'
import { formatCurrency } from '@/utils/formatCurrency'
import { showError, showSuccess } from '@/utils/notifications'

import type { Categoria } from '@/types/categoria'
import type { Articulo, ArticuloFormValues } from '@/api/articulos'

const search = ref('')
// El filtro se envía al backend para que funcione en todas las páginas.
const filtroEstado = ref<'todos' | 'true' | 'false'>('todos')
const opcionesEstado = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'true', texto: 'Activos' },
  { valor: 'false', texto: 'Inactivos' },
] as const
const loading = ref(false)
const saving = ref(false)
const articulos = ref<Articulo[]>([])
const categorias = ref<Categoria[]>([])
const modalOpen = ref(false)
const seleccionado = ref<Articulo | null>(null)
const confirmOpen = ref(false)
const paraCambiarEstado = ref<Articulo | null>(null)
const precioMasivoOpen = ref(false)
const articuloPrecioMasivo = ref<Articulo | null>(null)
const precioNuevoMasivo = ref(0)

const page = ref(1)
const totalPages = ref(1)
const count = ref(0)
let requestId = 0

async function cargarCategorias() {
  try {
    categorias.value = await getCategorias()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible cargar las categorías.'))
  }
}

async function loadData() {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const result = await getArticulosPage(page.value, 10, {
      activo: filtroEstado.value,
      search: search.value,
    })
    if (currentRequest !== requestId) return
    articulos.value = result.items
    count.value = result.count
    totalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === requestId) {
      await showError(getFriendlyError(error, 'No fue posible cargar los artículos.'))
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function goToPage(value: number) {
  if (value === page.value) return
  page.value = value
  void loadData()
}

watch(filtroEstado, () => {
  page.value = 1
  void loadData()
})

watch(search, (_value, _old, onCleanup) => {
  page.value = 1
  ++requestId
  const timer = setTimeout(() => void loadData(), 300)
  onCleanup(() => clearTimeout(timer))
})

function nuevoArticulo() {
  seleccionado.value = null
  modalOpen.value = true
}

function editarSeleccionado(articulo: Articulo) {
  seleccionado.value = articulo
  modalOpen.value = true
}

function cerrarModal() {
  if (saving.value) return
  modalOpen.value = false
  seleccionado.value = null
}

async function guardarArticulo(valores: ArticuloFormValues) {
  if (saving.value) return
  saving.value = true
  try {
    let avisos = 0
    let mensaje = ''
    if (seleccionado.value) {
      const resultado = await editarArticulo(seleccionado.value, valores)
      if (!resultado.cambiado) {
        modalOpen.value = false
        seleccionado.value = null
        await showSuccess('No había cambios pendientes de guardar.')
        return
      }
      avisos = resultado.advertencias.length
      mensaje = 'Artículo actualizado correctamente.'
    } else {
      const resultado = await registrarArticulo(valores)
      avisos = resultado.advertenciasPrecios.length
      mensaje = 'Artículo registrado correctamente.'
    }

    // Cerrar sin resetear pantalla, actualizar solo esta página paginada.
    modalOpen.value = false
    seleccionado.value = null
    await loadData()
    await showSuccess(
      avisos ? `${mensaje} Se guardó con ${avisos} aviso(s) informativos de precios.` : mensaje,
    )
    // Se actualiza el catálogo de categorías por si el backend creó SIN CLASIFICAR.
    void cargarCategorias()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible guardar el artículo.'))
  } finally {
    saving.value = false
  }
}

function iniciarPrecioMasivo(precio: number) {
  if (!seleccionado.value || saving.value) return
  articuloPrecioMasivo.value = seleccionado.value
  precioNuevoMasivo.value = precio
  modalOpen.value = false
  precioMasivoOpen.value = true
}

function cerrarPrecioMasivo() {
  precioMasivoOpen.value = false
  articuloPrecioMasivo.value = null
  seleccionado.value = null
}

async function precioMasivoGuardado(cantidad: number) {
  cerrarPrecioMasivo()
  await loadData()
  await showSuccess(`Precio actualizado para ${cantidad} variante(s).`)
}

function solicitarCambioEstado(articulo: Articulo) {
  paraCambiarEstado.value = articulo
  confirmOpen.value = true
}

async function confirmarCambioEstado() {
  if (!paraCambiarEstado.value || saving.value) return
  saving.value = true
  try {
    const articulo = paraCambiarEstado.value
    if (articulo.activo) {
      await desactivarVariante(articulo.varianteId)
    } else {
      await activarVariante(articulo.varianteId)
    }
    confirmOpen.value = false
    paraCambiarEstado.value = null
    await loadData()
    await showSuccess('Estado del artículo actualizado correctamente.')
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible modificar el estado del artículo.'))
  } finally {
    saving.value = false
  }
}

function stockStatus(articulo: Articulo) {
  if (articulo.stock <= 0) return { status: 'danger' as const, label: 'Agotado' }
  if (articulo.stock <= articulo.stockMinimo) return { status: 'warning' as const, label: 'Existencia baja' }
  return { status: 'success' as const, label: 'Disponible' }
}

onMounted(() => {
  void loadData()
  void cargarCategorias()
})

// Foco inicial únicamente en el buscador de esta pantalla (no modifica otros módulos).
const busquedaProductosAuto = ref<HTMLElement | null>(null)
onMounted(() => {
  void nextTick(() => {
    busquedaProductosAuto.value?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true })
  })
})
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Productos' }]" />

    <div class="mt-4 mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Gestión de productos</h1>
        <p class="mt-1 text-sm text-gray-500">
          Administra tus artículos, precios y existencias desde una sola lista.
        </p>
      </div>
      <BaseButton @click="nuevoArticulo">
        <PlusIcon class="h-4 w-4" />
        Agregar artículo
      </BaseButton>
    </div>

    <div class="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div ref="busquedaProductosAuto" class="w-full max-w-xl">
        <SearchBar v-model="search" placeholder="Buscar artículo, categoría, clave o código de barras..." />
      </div>
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por estado">
        <span class="mr-1 text-sm font-medium text-gray-600">Estado:</span>
        <button
          v-for="opcion in opcionesEstado"
          :key="opcion.valor"
          type="button"
          :aria-pressed="filtroEstado === opcion.valor"
          :class="[
            'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            filtroEstado === opcion.valor
              ? 'border-[#C56B86] bg-[#FBEFF3] text-[#A84968]'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
          ]"
          @click="filtroEstado = opcion.valor"
        >
          {{ opcion.texto }}
        </button>
      </div>
    </div>

    <BaseLoader v-if="loading" text="Cargando artículos..." />

    <div v-else class="overflow-hidden rounded-2xl border border-[#ECECEC] bg-white">
      <div class="overflow-x-auto">
        <table class="mobile-stack-table w-full min-w-[1120px] text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr class="text-xs font-semibold uppercase text-gray-500">
              <th class="px-4 py-4">Artículo</th>
              <th class="px-4 py-4">Categoría</th>
              <th class="px-4 py-4">Clave del artículo</th>
              <th class="px-4 py-4">Código de barras</th>
              <th class="px-4 py-4">Precio compra</th>
              <th class="px-4 py-4">Precio venta</th>
              <th class="px-4 py-4">Mayoreo</th>
              <th class="px-4 py-4">Existencia</th>
              <th class="px-4 py-4">Estado</th>
              <th class="px-4 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="articulo in articulos" :key="articulo.varianteId" class="interactive-lift-row">
              <td data-label="Artículo" class="px-4 py-4 font-medium text-gray-900">
                {{ articulo.nombreMostrar }}
              </td>
              <td data-label="Categoría" class="px-4 py-4 text-gray-600">
                {{ articulo.categoriaNombre }}
              </td>
              <td data-label="Clave del artículo" class="px-4 py-4 text-gray-600">{{ articulo.sku || '—' }}</td>
              <td data-label="Código de barras" class="px-4 py-4 font-mono text-xs text-gray-600">
                {{ articulo.codigoBarras || '—' }}
              </td>
              <td data-label="Precio compra" class="px-4 py-4 text-gray-600">{{ formatCurrency(articulo.costo) }}</td>
              <td data-label="Precio venta" class="px-4 py-4 font-medium">{{ formatCurrency(articulo.precioVenta) }}</td>
              <td data-label="Mayoreo" class="px-4 py-4 text-gray-600">
                {{ articulo.precioMayoreo > 0 ? formatCurrency(articulo.precioMayoreo) : 'Sin configurar' }}
              </td>
              <td data-label="Existencia" class="px-4 py-4">
                <div class="flex flex-col items-start gap-1">
                  <span class="font-medium">{{ articulo.stock }}</span>
                  <StatusChip :status="stockStatus(articulo).status" :label="stockStatus(articulo).label" />
                </div>
              </td>
              <td data-label="Estado" class="px-4 py-4">
                <StatusChip :status="articulo.activo ? 'success' : 'neutral'" :label="articulo.activo ? 'Activo' : 'Inactivo'" />
              </td>
              <td data-label="Acciones" class="px-4 py-4">
                <div class="flex justify-end gap-1">
                  <button
                    type="button"
                    class="rounded-lg p-2 text-gray-500 hover:bg-[#FBEFF3] hover:text-[#C56B86]"
                    aria-label="Editar artículo"
                    @click="editarSeleccionado(articulo)"
                  >
                    <PencilSquareIcon class="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-2 text-gray-500 hover:bg-[#FBEFF3] hover:text-[#C56B86]"
                    :aria-label="articulo.activo ? 'Desactivar artículo' : 'Activar artículo'"
                    @click="solicitarCambioEstado(articulo)"
                  >
                    <NoSymbolIcon v-if="articulo.activo" class="h-5 w-5" />
                    <CheckCircleIcon v-else class="h-5 w-5" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!articulos.length">
              <td colspan="10" class="px-5 py-12 text-center text-gray-500">
                No se encontraron artículos. Prueba otra búsqueda o agrega uno nuevo.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="count > 10" class="mt-5">
      <BasePagination :page="page" :total-pages="totalPages" @change="goToPage" />
    </div>

    <BaseModal
      :open="modalOpen"
      :title="seleccionado ? 'Editar artículo' : 'Registrar artículo'"
      max-width="lg"
      @close="cerrarModal"
    >
      <ArticuloForm
        :key="seleccionado?.varianteId ?? 'new-article'"
        :articulo="seleccionado"
        :categorias="categorias"
        :saving="saving"
        @submit="guardarArticulo"
        @bulk-price="iniciarPrecioMasivo"
        @cancel="cerrarModal"
      />
    </BaseModal>

    <PrecioMasivoModal
      :open="precioMasivoOpen"
      :articulo="articuloPrecioMasivo"
      :precio="precioNuevoMasivo"
      @close="cerrarPrecioMasivo"
      @saved="precioMasivoGuardado"
    />

    <ConfirmDialog
      :open="confirmOpen"
      :title="paraCambiarEstado?.activo ? 'Desactivar artículo' : 'Activar artículo'"
      :description="`¿Deseas ${paraCambiarEstado?.activo ? 'desactivar' : 'activar'} «${paraCambiarEstado?.nombreMostrar ?? ''}»?`"
      :confirm-text="paraCambiarEstado?.activo ? 'Desactivar' : 'Activar'"
      :loading="saving"
      @confirm="confirmarCambioEstado"
      @cancel="confirmOpen = false"
    />
  </section>
</template>
