<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseDateRangeFilter from '@/components/ui/BaseDateRangeFilter.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { getBitacoraPage } from '@/api/bitacora'
import { getUsuarios } from '@/api/usuarios'
import { formatDate } from '@/utils/formatDate'
import { getFriendlyError } from '@/utils/apiError'
import { showError } from '@/utils/notifications'
import type { BitacoraRegistro } from '@/types/bitacora'

// El backend filtra por UUID, módulo, acción y periodo. La búsqueda libre filtra la página visible.
const registros = ref<BitacoraRegistro[]>([])
const search = ref('')
const usuario = ref('')
const modulo = ref('')
const accion = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(false)
const page = ref(1)
const totalPages = ref(1)
const pageSize = 50
const nextUrl = ref<string | null>(null)
const previousUrl = ref<string | null>(null)
// Descarta resultados antiguos si se cambia rápido el periodo.
let latestRequestId = 0
const userOptions = ref<Array<{ label: string; value: string }>>([
  { label: 'Todos los usuarios', value: '' },
])

const displayItems = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return registros.value
  return registros.value.filter((item) =>
    [item.usuario, item.modulo, item.accion, item.descripcion].some((value) =>
      value.toLowerCase().includes(term),
    ),
  )
})
function params(): Record<string, string> {
  const result: Record<string, string> = {}
  if (usuario.value) result.usuario = usuario.value
  if (modulo.value.trim()) result.modulo = modulo.value.trim()
  if (accion.value.trim()) result.accion = accion.value.trim()
  if (dateFrom.value) result.fecha_desde = dateFrom.value
  if (dateTo.value) result.fecha_hasta = dateTo.value
  return result
}
async function loadData(targetPage = 1, pageUrl?: string) {
  const requestId = ++latestRequestId
  if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
    loading.value = false
    await showError('La fecha inicial no puede ser posterior a la fecha final.')
    return
  }

  loading.value = true
  try {
    const result = await getBitacoraPage(targetPage, pageSize, params(), pageUrl)
    if (requestId !== latestRequestId) return

    registros.value = result.items
    page.value = result.page
    totalPages.value = result.totalPages
    nextUrl.value = result.next
    previousUrl.value = result.previous
  } catch (error) {
    if (requestId !== latestRequestId) return
    await showError(getFriendlyError(error, 'No fue posible cargar la bitácora.'))
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

function changeDates(from: string, to: string) {
  if (dateFrom.value === from && dateTo.value === to) return
  dateFrom.value = from
  dateTo.value = to
  // Siempre consultar la primera página del rango nuevo.
  void loadData(1)
}
async function clearFilters() {
  usuario.value = ''
  modulo.value = ''
  accion.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  search.value = ''
  await loadData(1)
}
function goToPage(target: number) {
  if (loading.value || target < 1 || target > totalPages.value || target === page.value) return
  const next =
    target === page.value + 1
      ? nextUrl.value
      : target === page.value - 1
        ? previousUrl.value
        : undefined
  void loadData(target, next ?? undefined)
}
async function initialize() {
  void loadData(1)
  try {
    const users = await getUsuarios()
    userOptions.value = [
      { label: 'Todos los usuarios', value: '' },
      ...users.map((item) => ({ label: `${item.nombre} ${item.apellido}`.trim(), value: item.id })),
    ]
  } catch {
    // El historial continúa disponible aunque falle la carga del selector.
  }
}
onMounted(initialize)
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Bitácora' }]" />

    <div class="mt-4 mb-8">
      <h1 class="text-2xl font-semibold text-gray-900">Bitácora</h1>
      <p class="mt-1 text-sm text-gray-500">
        Consulta las acciones importantes realizadas en el sistema.
      </p>
    </div>

    <BaseDateRangeFilter
      :from="dateFrom"
      :to="dateTo"
      class="mb-4"
      @range-change="changeDates"
    />
    <div
      class="mb-5 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <BaseSelect v-model="usuario" :options="userOptions" label="Usuario" />
      <BaseInput v-model="modulo" label="Módulo" placeholder="Ej. Ventas" />
      <BaseInput v-model="accion" label="Acción" placeholder="Ej. CANCELAR_VENTA" />
      <div class="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-3">
        <BaseButton :disabled="loading" :loading="loading" @click="loadData(1)">Buscar</BaseButton>
        <BaseButton variant="secondary" :disabled="loading" @click="clearFilters"
          >Limpiar</BaseButton
        >
      </div>
    </div>
    <div class="mb-5 max-w-xl">
      <SearchBar v-model="search" placeholder="Filtrar resultados de esta página..." />
    </div>

    <BaseLoader v-if="loading" text="Cargando bitácora..." />

    <div v-else class="overflow-hidden rounded-2xl border border-[#ECECEC] bg-white">
      <div class="overflow-x-auto">
        <table class="mobile-stack-table w-full min-w-[900px] text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr class="text-xs font-semibold uppercase text-gray-500">
              <th class="px-5 py-4">Fecha</th>
              <th class="px-5 py-4">Usuario</th>
              <th class="px-5 py-4">Módulo</th>
              <th class="px-5 py-4">Acción</th>
              <th class="px-5 py-4">Descripción</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in displayItems" :key="item.id" class="interactive-lift-row">
              <td data-label="Fecha" class="whitespace-nowrap px-5 py-4 text-gray-600">
                {{ formatDate(item.fecha) }}
              </td>
              <td data-label="Usuario" class="px-5 py-4 font-medium text-gray-900">
                {{ item.usuario }}
              </td>
              <td data-label="Módulo" class="px-5 py-4">
                <StatusChip status="info" :label="item.modulo" />
              </td>
              <td data-label="Acción" class="px-5 py-4 text-gray-600">{{ item.accion }}</td>
              <td data-label="Descripción" class="px-5 py-4 text-gray-600">
                {{ item.descripcion }}
              </td>
            </tr>

            <tr v-if="!displayItems.length">
              <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                No se encontraron registros.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="totalPages > 1" class="mt-4">
      <BasePagination :page="page" :total-pages="totalPages" @change="goToPage" />
    </div>
  </section>
</template>
