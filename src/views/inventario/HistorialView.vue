<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseDateRangeFilter from '@/components/ui/BaseDateRangeFilter.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import StatusChip from '@/components/common/StatusChip.vue'

import { getMovimientosInventarioPage } from '@/api/inventario'
import { enrichMovements } from './inventarioData'
import { formatDate } from '@/utils/formatDate'
import { getFriendlyError } from '@/utils/apiError'
import { useDateRangeFilter } from '@/composables/useDateRangeFilter'
import { showError } from '@/utils/notifications'

import type { TipoMovimientoInventario } from '@/types/inventario'
import type { MovimientoVista } from './inventarioData'

const search = ref('')
const typeFilter = ref<'TODOS' | TipoMovimientoInventario>('TODOS')
const loading = ref(false)
const movimientos = ref<MovimientoVista[]>([])
const { dateFrom, dateTo } = useDateRangeFilter('today')

const typeOptions = [
  { label: 'Todos los movimientos', value: 'TODOS' },
  { label: 'Entradas', value: 'ENTRADA' },
  { label: 'Salidas', value: 'SALIDA' },
  { label: 'Ajustes', value: 'AJUSTE' },
  { label: 'Devoluciones', value: 'DEVOLUCION' },
  { label: 'Garantías', value: 'GARANTIA' },
  { label: 'Cambios de producto', value: 'CAMBIO_PRODUCTO' },
]

const page = ref(1)
const totalPages = ref(1)
const count = ref(0)
let requestId = 0

function goToPage(value: number) {
  if (page.value === value) return
  page.value = value
  void loadData()
}

function statusFor(type: TipoMovimientoInventario) {
  if (type === 'ENTRADA') {
    return { status: 'success' as const, label: 'Entrada' }
  }

  if (type === 'SALIDA') {
    return { status: 'danger' as const, label: 'Salida' }
  }

  const labels: Record<TipoMovimientoInventario, string> = {
    ENTRADA: 'Entrada',
    SALIDA: 'Salida',
    AJUSTE: 'Ajuste',
    DEVOLUCION: 'Devolución',
    GARANTIA: 'Garantía',
    CAMBIO_PRODUCTO: 'Cambio de producto',
  }
  return { status: 'info' as const, label: labels[type] }
}

function quantityLabel(item: MovimientoVista) {
  if (item.tipo === 'ENTRADA' || item.tipo === 'DEVOLUCION') return `+${item.cantidad}`
  if (item.tipo === 'SALIDA') return `-${item.cantidad}`
  if (item.tipo === 'AJUSTE' && item.stockAnterior != null && item.stockNuevo != null) {
    const diferencia = item.stockNuevo - item.stockAnterior
    return `${item.stockAnterior} → ${item.stockNuevo} (${diferencia > 0 ? '+' : ''}${diferencia})`
  }
  return String(item.cantidad)
}

async function loadData() {
  const currentRequest = ++requestId
  loading.value = !movimientos.value.length
  try {
    const result = await getMovimientosInventarioPage(page.value, 10, {
      tipo: typeFilter.value === 'TODOS' ? undefined : typeFilter.value,
      search: search.value.trim() || undefined,
      fecha_desde: dateFrom.value || undefined,
      fecha_hasta: dateTo.value || undefined,
    })
    const enriched = await enrichMovements(result.items)
    if (currentRequest !== requestId) return
    movimientos.value = enriched
    count.value = result.count
    totalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === requestId)
      await showError(getFriendlyError(error, 'No fue posible cargar el historial.'))
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(search, (_value, _old, onCleanup) => {
  page.value = 1
  ++requestId
  const timer = setTimeout(() => void loadData(), 300)
  onCleanup(() => clearTimeout(timer))
})
watch([typeFilter, dateFrom, dateTo], () => {
  page.value = 1
  void loadData()
})

onMounted(loadData)
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Inventario', to: '/inventario' }, { label: 'Historial' }]" />

    <div class="mt-4 mb-8">
      <h1 class="text-2xl font-semibold text-gray-900">Historial de inventario</h1>
      <p class="mt-1 text-sm text-gray-500">Consulta todos los movimientos registrados.</p>
    </div>

    <div class="mb-6">
      <RouterLink
        to="/inventario"
        class="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#C56B86]"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        Volver al inventario
      </RouterLink>
    </div>

    <BaseDateRangeFilter v-model:from="dateFrom" v-model:to="dateTo" class="mb-4" />

    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
      <div class="w-full max-w-xl">
        <SearchBar autofocus v-model="search" placeholder="Buscar artículo, variante, clave del artículo o motivo..." />
      </div>

      <div class="w-full md:w-64">
        <BaseSelect
          v-model="typeFilter"
          :options="typeOptions"
          placeholder="Todos los movimientos"
        />
      </div>
    </div>

    <BaseLoader v-if="loading" text="Cargando historial..." />

    <div v-else>
      <div class="grid gap-3 lg:hidden">
        <article
          v-for="item in movimientos"
          :key="item.id"
          class="interactive-lift-card rounded-2xl border border-[#ECECEC] bg-white p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-gray-900">
                {{ item.producto }}
              </p>
              <p class="mt-1 text-sm text-gray-500">{{ item.variante }} · {{ item.sku }}</p>
            </div>

            <StatusChip :status="statusFor(item.tipo).status" :label="statusFor(item.tipo).label" />
          </div>

          <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs uppercase text-gray-400">Fecha</p>
              <p class="mt-1 text-gray-700">
                {{ formatDate(item.fecha) }}
              </p>
            </div>

            <div>
              <p class="text-xs uppercase text-gray-400">Movimiento / existencia</p>
              <p class="mt-1 font-semibold text-gray-900">
                {{ quantityLabel(item) }}
              </p>
            </div>

            <div class="col-span-2">
              <p class="text-xs uppercase text-gray-400">Motivo</p>
              <p class="mt-1 break-words text-gray-700">
                {{ item.observaciones || 'Sin observaciones' }}
              </p>
            </div>

            <div class="col-span-2">
              <p class="text-xs uppercase text-gray-400">Usuario</p>
              <p class="mt-1 text-gray-700">
                {{ item.usuario }}
              </p>
            </div>
          </div>
        </article>

        <div
          v-if="!movimientos.length"
          class="rounded-2xl border border-[#ECECEC] bg-white px-6 py-12 text-center text-gray-500"
        >
          No se encontraron movimientos.
        </div>
      </div>

      <div class="hidden overflow-hidden rounded-2xl border border-[#ECECEC] bg-white lg:block">
        <div class="overflow-x-auto">
          <table class="mobile-stack-table w-full min-w-[950px] text-left text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr class="text-xs font-semibold uppercase text-gray-500">
                <th class="px-5 py-4">Fecha</th>
                <th class="px-5 py-4">Artículo</th>
                <th class="px-5 py-4">Variante</th>
                <th class="px-5 py-4">Clave del artículo</th>
                <th class="px-5 py-4">Tipo</th>
                <th class="px-5 py-4">Movimiento / existencia</th>
                <th class="px-5 py-4">Motivo</th>
                <th class="px-5 py-4">Usuario</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-gray-100">
              <tr v-for="item in movimientos" :key="item.id" class="interactive-lift-row">
                <td data-label="Fecha" class="whitespace-nowrap px-5 py-4 text-gray-600">
                  {{ formatDate(item.fecha) }}
                </td>
                <td data-label="Artículo" class="px-5 py-4 font-medium text-gray-900">
                  {{ item.producto }}
                </td>
                <td data-label="Variante" class="px-5 py-4 text-gray-600">{{ item.variante }}</td>
                <td data-label="Clave del artículo" class="px-5 py-4 text-gray-600">{{ item.sku }}</td>
                <td data-label="Tipo" class="px-5 py-4">
                  <StatusChip
                    :status="statusFor(item.tipo).status"
                    :label="statusFor(item.tipo).label"
                  />
                </td>
                <td data-label="Movimiento / existencia" class="px-5 py-4 font-semibold text-gray-900">
                  {{ quantityLabel(item) }}
                </td>
                <td data-label="Motivo" class="px-5 py-4 text-gray-600">
                  {{ item.observaciones || 'Sin observaciones' }}
                </td>
                <td data-label="Usuario" class="px-5 py-4 text-gray-600">{{ item.usuario }}</td>
              </tr>

              <tr v-if="!movimientos.length">
                <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                  No se encontraron movimientos.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="count > 10" class="mt-4">
      <BasePagination :page="page" :total-pages="totalPages" @change="goToPage" />
    </div>
  </section>
</template>
