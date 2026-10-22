<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import StatusChip from '@/components/common/StatusChip.vue'

import { loadInventoryCatalog } from './inventarioData'
import { getFriendlyError } from '@/utils/apiError'
import { showError } from '@/utils/notifications'

import type { CatalogVariant } from './inventarioData'

const search = ref('')
const loading = ref(false)
const inventario = ref<CatalogVariant[]>([])

const page = ref(1)
const totalPages = ref(1)
const count = ref(0)
let requestId = 0

function goToPage(value: number) {
  if (value === page.value) return
  page.value = value
  void loadData()
}

watch(search, (_value, _old, onCleanup) => {
  page.value = 1
  ++requestId
  const timer = setTimeout(() => void loadData(), 300)
  onCleanup(() => clearTimeout(timer))
})

function getStockStatus(item: CatalogVariant) {
  if (item.stock <= 0) {
    return { status: 'danger' as const, label: 'Agotado' }
  }

  if (item.stock <= item.stockMinimo) {
    return { status: 'warning' as const, label: 'Existencia baja' }
  }

  return { status: 'success' as const, label: 'Disponible' }
}

async function loadData() {
  const currentRequest = ++requestId
  loading.value = !inventario.value.length

  try {
    const result = await loadInventoryCatalog(page.value, 10, search.value)
    if (currentRequest !== requestId) return
    inventario.value = result.items
    count.value = result.count
    totalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === requestId) await showError(getFriendlyError(error, 'No fue posible cargar el inventario.'))
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Inventario' }]" />

    <div class="mt-4 mb-8">
      <h1 class="text-2xl font-semibold text-gray-900">Inventario</h1>
      <p class="mt-1 text-sm text-gray-500">Consulta el stock y administra los movimientos.</p>
    </div>

    <div class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <RouterLink to="/inventario/entradas">
        <BaseButton variant="secondary" class="w-full">
          <ArrowDownTrayIcon class="h-5 w-5" />
          Entradas
        </BaseButton>
      </RouterLink>

      <RouterLink to="/inventario/salidas">
        <BaseButton variant="secondary" class="w-full">
          <ArrowUpTrayIcon class="h-5 w-5" />
          Salidas
        </BaseButton>
      </RouterLink>

      <RouterLink to="/inventario/ajustes">
        <BaseButton variant="secondary" class="w-full">
          <AdjustmentsHorizontalIcon class="h-5 w-5" />
          Ajustes
        </BaseButton>
      </RouterLink>

      <RouterLink to="/inventario/historial">
        <BaseButton variant="secondary" class="w-full">
          <ClockIcon class="h-5 w-5" />
          Historial
        </BaseButton>
      </RouterLink>
    </div>

    <div class="mb-5 max-w-xl">
      <SearchBar autofocus v-model="search" placeholder="Buscar artículo, variante, clave o código de barras..." />
    </div>

    <BaseLoader v-if="loading" text="Cargando inventario..." />

    <div v-else class="overflow-hidden rounded-2xl border border-[#ECECEC] bg-white">
      <div class="overflow-x-auto">
        <table class="mobile-stack-table w-full min-w-[900px] text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr class="text-xs font-semibold uppercase text-gray-500">
              <th class="px-5 py-4">Artículo</th>
              <th class="px-5 py-4">Variante</th>
              <th class="px-5 py-4">Clave del artículo</th>
              <th class="px-5 py-4">Código de barras</th>
              <th class="px-5 py-4">Existencia</th>
              <th class="px-5 py-4">Unidades defectuosas</th>
              <th class="px-5 py-4">Existencia mínima</th>
              <th class="px-5 py-4">Estado</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in inventario" :key="item.id" class="interactive-lift-row">
              <td data-label="Artículo" class="px-5 py-4 font-medium text-gray-900">
                {{ item.producto }}
              </td>
              <td data-label="Variante" class="px-5 py-4 text-gray-600">{{ item.variante }}</td>
              <td data-label="Clave del artículo" class="px-5 py-4 text-gray-600">{{ item.sku }}</td>
              <td data-label="Código de barras" class="px-5 py-4 font-mono text-xs text-gray-600">
                {{ item.codigoBarras }}
              </td>
              <td data-label="Existencia" class="px-5 py-4 font-medium text-gray-900">
                {{ item.stock }}
              </td>
              <td data-label="Unidades defectuosas" class="px-5 py-4 font-medium text-red-600">
                {{ item.stockDefectuoso }}
              </td>
              <td data-label="Existencia mínima" class="px-5 py-4 text-gray-600">{{ item.stockMinimo }}</td>
              <td data-label="Estado" class="px-5 py-4">
                <StatusChip
                  :status="getStockStatus(item).status"
                  :label="getStockStatus(item).label"
                />
              </td>
            </tr>

            <tr v-if="!inventario.length">
              <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                No se encontraron productos.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="count > 10" class="mt-4">
      <BasePagination :page="page" :total-pages="totalPages" @change="goToPage" />
    </div>
  </section>
</template>
