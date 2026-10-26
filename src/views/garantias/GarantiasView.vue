<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  CheckCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseDateRangeFilter from '@/components/ui/BaseDateRangeFilter.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import StatusChip from '@/components/common/StatusChip.vue'

import GarantiaDetalle from './GarantiaDetalle.vue'

import {
  aprobarGarantia,
  createGarantia,
  finalizarGarantia,
  getGarantiasPage,
  updateGarantia,
  rechazarGarantia,
} from '@/api/garantias'
import { formatDate } from '@/utils/formatDate'
import { useAuthStore } from '@/stores/auth'
import { getFriendlyError } from '@/utils/apiError'
import { useDateRangeFilter } from '@/composables/useDateRangeFilter'
import { showError, showSuccess } from '@/utils/notifications'
import { buildVentaOptions, loadSoldVariantOptions } from '@/utils/ventaOptions'
import { getVentasPage } from '@/api/ventas'
import { getVariantesPage } from '@/api/variantes'

import type { Garantia, ResolucionGarantia } from '@/types/garantia'
import type { SoldVariantOption } from '@/utils/ventaOptions'
import type { VentaResumen } from '@/types/venta'
import type { Variante } from '@/types/variante'

type ActionMode = 'crear' | 'editar' | 'aprobar'

const authStore = useAuthStore()

const items = ref<Garantia[]>([])
const sales = ref<VentaResumen[]>([])
const saleSelection = ref<VentaResumen | null>(null)
const saleSearch = ref('')
const salePage = ref(1)
const saleTotalPages = ref(1)
const replacementVariants = ref<Variante[]>([])
const replacementSearch = ref('')
const replacementPage = ref(1)
const replacementTotalPages = ref(1)
const page = ref(1)
const totalPages = ref(1)
const count = ref(0)
let requestId = 0
let saleRequestId = 0
let saleDetailRequestId = 0
let replacementRequestId = 0
const soldVariants = ref<SoldVariantOption[]>([])
const search = ref('')
const statusFilter = ref('TODOS')
const loading = ref(false)
const loadingSale = ref(false)
const saving = ref(false)
const modalOpen = ref(false)
const detailOpen = ref(false)
const rejectOpen = ref(false)
const finishOpen = ref(false)
const actionMode = ref<ActionMode>('crear')
const selected = ref<Garantia | null>(null)
const formMessage = ref('')
const { dateFrom, dateTo } = useDateRangeFilter('today')

const form = reactive({
  ventaId: '',
  varianteId: '',
  motivo: '',
  resolucion: 'REEMPLAZO' as ResolucionGarantia,
  observaciones: '',
  cantidad: 1,
  varianteNuevaId: '',
})

const ventaOptions = computed(() => buildVentaOptions([
  ...sales.value,
  ...(saleSelection.value && !sales.value.some((item) => item.id === saleSelection.value?.id)
    ? [saleSelection.value]
    : []),
]))

const variantesVencidas = computed(() =>
  soldVariants.value.filter((item) =>
    item.garantiaFechaVencimiento &&
    new Date(item.garantiaFechaVencimiento).getTime() < Date.now(),
  ),
)

const variantOptions = computed(() =>
  soldVariants.value
    .filter((item) =>
      (!item.garantiaConocida || Number(item.garantiaMeses ?? 0) > 0) &&
      !variantesVencidas.value.some((vencida) => vencida.value === item.value),
    )
    .map((item) => ({
      label: item.garantiaConocida
        ? `${item.label} · Garantía: ${item.garantiaMeses} meses${item.garantiaFechaVencimiento ? ` · Vence: ${formatDate(item.garantiaFechaVencimiento)}` : ''}${!item.garantiaPlazoHistorico ? ' · Plazo histórico no registrado' : ''}`
        : `${item.label} · Se validará la garantía al registrar`,
      value: item.value,
    })),
)

const statusOptions = [
  { label: 'Todos los estados', value: 'TODOS' },
  { label: 'Pendientes', value: 'PENDIENTE' },
  { label: 'Aprobadas', value: 'APROBADA' },
  { label: 'Rechazadas', value: 'RECHAZADA' },
  { label: 'Finalizadas', value: 'FINALIZADA' },
]

const resolutionOptions = [
  { label: 'Reemplazo', value: 'REEMPLAZO' },
  { label: 'Cambio de producto', value: 'CAMBIO_PRODUCTO' },
  { label: 'Reparación', value: 'REPARACION' },
]

const replacementVariantOptions = computed(() =>
  replacementVariants.value
    .filter(
      (item) =>
        item.activo &&
        item.stock >= Number(selected.value?.cantidad ?? 1),
    )
    .map((item) => ({ label: `${item.nombre} · Stock ${item.stock}`, value: item.id })),
)

const selectedSoldVariant = computed(() =>
  soldVariants.value.find((item) => item.value === form.varianteId),
)

function statusFor(estado: Garantia['estado']) {
  if (estado === 'APROBADA') {
    return { status: 'success' as const, label: 'Aprobada' }
  }

  if (estado === 'RECHAZADA') {
    return { status: 'danger' as const, label: 'Rechazada' }
  }

  if (estado === 'FINALIZADA') {
    return { status: 'info' as const, label: 'Finalizada' }
  }

  return { status: 'warning' as const, label: 'Pendiente' }
}

async function loadData() {
  const currentRequest = ++requestId
  loading.value = !items.value.length
  try {
    const result = await getGarantiasPage(page.value, 10, {
      search: search.value.trim() || undefined,
      estado: statusFilter.value === 'TODOS' ? undefined : statusFilter.value,
      fecha_desde: dateFrom.value || undefined,
      fecha_hasta: dateTo.value || undefined,
    })
    if (currentRequest !== requestId) return
    items.value = result.items
    count.value = result.count
    totalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === requestId)
      await showError(getFriendlyError(error, 'No fue posible cargar las garantías.'))
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

async function loadSales() {
  const currentRequest = ++saleRequestId
  try {
    const result = await getVentasPage(salePage.value, 20, { search: saleSearch.value.trim() || undefined })
    if (currentRequest !== saleRequestId) return
    sales.value = result.items
    saleTotalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === saleRequestId)
      formMessage.value = getFriendlyError(error, 'No fue posible cargar las ventas.')
  }
}

async function loadReplacements() {
  const currentRequest = ++replacementRequestId
  try {
    const result = await getVariantesPage(replacementPage.value, 20, 'true', {
      search: replacementSearch.value.trim() || undefined,
    })
    if (currentRequest !== replacementRequestId) return
    replacementVariants.value = result.items
    replacementTotalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === replacementRequestId)
      formMessage.value = getFriendlyError(error, 'No fue posible cargar las variantes.')
  }
}

function goToPage(value: number) { page.value = value; void loadData() }
function goToSalePage(value: number) { salePage.value = value; void loadSales() }
function goToReplacementPage(value: number) { replacementPage.value = value; void loadReplacements() }

watch(search, (_value, _old, onCleanup) => {
  page.value = 1
  ++requestId
  const timer = setTimeout(() => void loadData(), 300)
  onCleanup(() => clearTimeout(timer))
})
watch([statusFilter, dateFrom, dateTo], () => { page.value = 1; void loadData() })
watch(saleSearch, (_value, _old, onCleanup) => {
  salePage.value = 1
  ++saleRequestId
  const timer = setTimeout(() => void loadSales(), 300)
  onCleanup(() => clearTimeout(timer))
})
watch(replacementSearch, (_value, _old, onCleanup) => {
  replacementPage.value = 1
  ++replacementRequestId
  const timer = setTimeout(() => void loadReplacements(), 300)
  onCleanup(() => clearTimeout(timer))
})
watch([() => form.resolucion, modalOpen], () => {
  if (modalOpen.value && actionMode.value === 'aprobar' && form.resolucion === 'CAMBIO_PRODUCTO')
    void loadReplacements()
})

async function selectSale(value: string | number) {
  form.ventaId = String(value)
  saleSelection.value = sales.value.find((item) => item.id === form.ventaId) ?? saleSelection.value
  const currentRequest = ++saleDetailRequestId
  form.varianteId = ''
  soldVariants.value = []
  formMessage.value = ''

  if (!form.ventaId) return

  loadingSale.value = true

  try {
    const { opciones } = await loadSoldVariantOptions(form.ventaId)
    if (currentRequest !== saleDetailRequestId) return

    soldVariants.value = opciones

    if (!variantOptions.value.length) {
      formMessage.value = 'Esta venta no tiene productos con garantía disponible.'
    }
  } catch (error) {
    if (currentRequest === saleDetailRequestId)
      formMessage.value = getFriendlyError(error, 'No fue posible cargar los productos de la venta.')
  } finally {
    if (currentRequest === saleDetailRequestId) loadingSale.value = false
  }
}

function openCreate() {
  actionMode.value = 'crear'
  selected.value = null
  form.ventaId = ''
  saleSelection.value = null
  ++saleDetailRequestId
  form.varianteId = ''
  form.motivo = ''
  form.observaciones = ''
  form.cantidad = 1
  form.varianteNuevaId = ''
  soldVariants.value = []
  formMessage.value = ''
  salePage.value = 1
  modalOpen.value = true
  if (saleSearch.value) saleSearch.value = ''
  else void loadSales()
}

function isMine(item: Garantia) {
  const current = authStore.user
  if (!current) return false
  const currentName = `${current.nombre} ${current.apellido ?? ''}`.trim().toLowerCase()
  return item.usuario.trim().toLowerCase() === currentName
}
function openEdit(item: Garantia) {
  if (item.estado !== 'PENDIENTE' || !isMine(item)) return
  actionMode.value = 'editar'
  selected.value = item
  form.motivo = item.motivo
  formMessage.value = ''
  modalOpen.value = true
}

function openApprove(item: Garantia) {
  actionMode.value = 'aprobar'
  selected.value = item
  form.resolucion = 'REEMPLAZO'
  form.observaciones = ''
  form.varianteNuevaId = ''
  replacementSearch.value = ''
  replacementPage.value = 1
  modalOpen.value = true
}

function openDetail(item: Garantia) {
  selected.value = item
  detailOpen.value = true
}

async function submitModal() {
  if (
    actionMode.value === 'crear' &&
    (!form.ventaId ||
      !form.varianteId ||
      !form.motivo.trim() ||
      !Number.isInteger(Number(form.cantidad)) ||
      Number(form.cantidad) < 1 ||
      Number(form.cantidad) > Number(selectedSoldVariant.value?.cantidadDisponible ?? 0))
  ) {
    formMessage.value = 'Completa la venta, el producto, la cantidad y el motivo.'
    return
  }

  if (actionMode.value === 'editar' && !form.motivo.trim()) {
    formMessage.value = 'Describe el motivo de la garantía.'
    return
  }

  if (
    actionMode.value === 'aprobar' &&
    form.resolucion === 'CAMBIO_PRODUCTO' &&
    !form.varianteNuevaId
  ) {
    formMessage.value = 'Selecciona el producto que se entregará como cambio.'
    return
  }

  saving.value = true
  formMessage.value = ''

  try {
    if (actionMode.value === 'crear') {
      const soldVariant = selectedSoldVariant.value

      if (!soldVariant) {
        formMessage.value = 'Selecciona un producto disponible de la venta.'
        return
      }

      await createGarantia({
        venta_id: form.ventaId,
        detalle_venta_id: soldVariant.detalleVentaId,
        variante_id: form.varianteId,
        cantidad: Number(form.cantidad),
        motivo: form.motivo.trim(),
      })

      await showSuccess('Solicitud de garantía registrada correctamente.')
    } else if (actionMode.value === 'editar' && selected.value) {
      await updateGarantia(selected.value.id, form.motivo.trim())
      await showSuccess('Garantía actualizada correctamente.')
    } else if (selected.value) {
      await aprobarGarantia(selected.value.id, {
        resolucion: form.resolucion,
        variante_nueva_id: form.resolucion === 'CAMBIO_PRODUCTO' ? form.varianteNuevaId : undefined,
        observaciones: form.observaciones.trim(),
      })

      await showSuccess('Garantía aprobada correctamente.')
    }

    modalOpen.value = false
    await loadData()
  } catch (error) {
    formMessage.value = getFriendlyError(error, 'No fue posible guardar la garantía.')
  } finally {
    saving.value = false
  }
}

function requestReject(item: Garantia) {
  selected.value = item
  rejectOpen.value = true
}

function requestFinish(item: Garantia) {
  selected.value = item
  finishOpen.value = true
}

async function confirmReject() {
  if (!selected.value) return

  saving.value = true

  try {
    await rechazarGarantia(selected.value.id)
    rejectOpen.value = false
    await showSuccess('Garantía rechazada correctamente.')
    await loadData()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible rechazar la garantía.'))
  } finally {
    saving.value = false
    selected.value = null
  }
}

async function confirmFinish() {
  if (!selected.value) return

  saving.value = true

  try {
    await finalizarGarantia(selected.value.id)
    finishOpen.value = false
    await showSuccess('Garantía finalizada correctamente.')
    await loadData()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible finalizar la garantía.'))
  } finally {
    saving.value = false
    selected.value = null
  }
}

onMounted(loadData)
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Garantías' }]" />

    <div class="mt-4 mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Garantías</h1>
        <p class="mt-1 text-sm text-gray-500">Registra y administra solicitudes de garantía.</p>
      </div>

      <BaseButton @click="openCreate">
        <PlusIcon class="h-4 w-4" />
        Nueva garantía
      </BaseButton>
    </div>

    <BaseDateRangeFilter v-model:from="dateFrom" v-model:to="dateTo" class="mb-4" />

    <div class="mb-5 flex flex-col gap-3 lg:flex-row">
      <div class="w-full max-w-xl">
        <SearchBar v-model="search" placeholder="Buscar venta, producto, usuario o motivo..." />
      </div>

      <div class="w-full lg:w-64">
        <BaseSelect v-model="statusFilter" :options="statusOptions" placeholder="Filtrar estado" />
      </div>
    </div>

    <BaseLoader v-if="loading" text="Cargando garantías..." />

    <div v-else class="overflow-hidden rounded-2xl border border-[#ECECEC] bg-white">
      <div class="overflow-x-auto">
        <table class="mobile-stack-table w-full min-w-[1000px] text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr class="text-xs font-semibold uppercase text-gray-500">
              <th class="px-5 py-4">Fecha</th>
              <th class="px-5 py-4">Venta</th>
              <th class="px-5 py-4">Producto</th>
              <th class="px-5 py-4">Motivo</th>
              <th class="px-5 py-4">Estado</th>
              <th class="px-5 py-4 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in items" :key="item.id" class="interactive-lift-row">
              <td data-label="Fecha" class="whitespace-nowrap px-5 py-4 text-gray-600">
                {{ formatDate(item.fecha) }}
              </td>
              <td data-label="Venta" class="px-5 py-4 font-medium text-gray-900">
                {{ item.ventaFolio }}
              </td>
              <td data-label="Producto" class="px-5 py-4 text-gray-600">
                {{ item.producto }} - {{ item.variante }}
              </td>
              <td data-label="Motivo" class="max-w-xs truncate px-5 py-4 text-gray-600">
                {{ item.motivo }}
              </td>
              <td data-label="Estado" class="px-5 py-4">
                <StatusChip
                  :status="statusFor(item.estado).status"
                  :label="statusFor(item.estado).label"
                />
              </td>
              <td data-label="Acciones" class="px-5 py-4">
                <div class="flex justify-end gap-1">
                  <button
                    type="button"
                    class="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                    aria-label="Ver garantía"
                    @click="openDetail(item)"
                  >
                    <EyeIcon class="h-5 w-5" />
                  </button>

                  <button
                    v-if="item.estado === 'PENDIENTE' && isMine(item)"
                    type="button"
                    class="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                    aria-label="Editar garantía"
                    @click="openEdit(item)"
                  >
                    <PencilSquareIcon class="h-5 w-5" />
                  </button>
                  <button
                    v-if="authStore.isAdmin && item.estado === 'PENDIENTE'"
                    type="button"
                    class="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600"
                    aria-label="Aprobar garantía"
                    @click="openApprove(item)"
                  >
                    <CheckCircleIcon class="h-5 w-5" />
                  </button>

                  <button
                    v-if="authStore.isAdmin && item.estado === 'PENDIENTE'"
                    type="button"
                    class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Rechazar garantía"
                    @click="requestReject(item)"
                  >
                    <XCircleIcon class="h-5 w-5" />
                  </button>

                  <BaseButton
                    v-if="authStore.isAdmin && item.estado === 'APROBADA'"
                    variant="secondary"
                    @click="requestFinish(item)"
                  >
                    Finalizar
                  </BaseButton>
                </div>
              </td>
            </tr>

            <tr v-if="!items.length">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                No se encontraron garantías.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="count > 10" class="mt-4">
      <BasePagination :page="page" :total-pages="totalPages" @change="goToPage" />
    </div>

    <BaseModal
      :open="modalOpen"
      :title="
        actionMode === 'crear'
          ? 'Nueva garantía'
          : actionMode === 'editar'
            ? 'Editar garantía'
            : 'Aprobar garantía'
      "
      max-width="lg"
      @close="modalOpen = false"
    >
      <form class="space-y-5" @submit.prevent="submitModal">
        <template v-if="actionMode === 'crear'">
          <SearchBar v-model="saleSearch" placeholder="Buscar folio o usuario..." />
          <BaseSelect
            :model-value="form.ventaId"
            label="Venta"
            :options="ventaOptions"
            placeholder="Selecciona la venta"
            required
            @update:model-value="selectSale"
          />
          <BasePagination v-if="saleTotalPages > 1" :page="salePage" :total-pages="saleTotalPages" @change="goToSalePage" />

          <BaseLoader v-if="loadingSale" text="Cargando productos de la venta..." />

          <BaseSelect
            v-else
            v-model="form.varianteId"
            label="Producto con garantía"
            :options="variantOptions"
            :disabled="!form.ventaId || !variantOptions.length"
            placeholder="Selecciona el producto"
            required
          />
          <p v-if="variantesVencidas.length" class="text-xs text-amber-700" role="status">
            {{ variantesVencidas.length }} artículo(s) con garantía vencida no pueden seleccionarse.
          </p>

          <BaseInput
            v-model="form.cantidad"
            type="number"
            min="1"
            :max="selectedSoldVariant?.cantidadDisponible"
            label="Cantidad"
            required
          />

          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">Motivo</label>
            <textarea
              v-model="form.motivo"
              rows="4"
              required
              placeholder="Describe el problema presentado"
              class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15"
            />
          </div>
        </template>

        <template v-else-if="actionMode === 'editar'">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">Motivo</label>
            <textarea
              v-model="form.motivo"
              required
              rows="4"
              class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#C56B86]"
              placeholder="Describe el motivo de la garantía"
            />
          </div>
        </template>
        <template v-else>
          <BaseSelect
            v-model="form.resolucion"
            label="Resolución"
            :options="resolutionOptions"
            required
          />

          <SearchBar v-if="form.resolucion === 'CAMBIO_PRODUCTO'" v-model="replacementSearch" placeholder="Buscar producto de reemplazo..." />
          <BaseSelect
            v-if="form.resolucion === 'CAMBIO_PRODUCTO'"
            v-model="form.varianteNuevaId"
            label="Producto de reemplazo"
            :options="replacementVariantOptions"
            placeholder="Selecciona la nueva variante"
            required
          />
          <BasePagination v-if="form.resolucion === 'CAMBIO_PRODUCTO' && replacementTotalPages > 1" :page="replacementPage" :total-pages="replacementTotalPages" @change="goToReplacementPage" />

          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              v-model="form.observaciones"
              rows="4"
              placeholder="Describe cómo se resolverá la garantía"
              class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15"
            />
          </div>
        </template>

        <p v-if="formMessage" class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {{ formMessage }}
        </p>

        <div class="flex justify-end gap-3 border-t border-gray-100 pt-5">
          <BaseButton variant="secondary" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="saving">Guardar</BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal
      :open="detailOpen"
      title="Detalle de garantía"
      max-width="lg"
      @close="detailOpen = false"
    >
      <GarantiaDetalle v-if="selected" :garantia="selected" />
    </BaseModal>

    <ConfirmDialog
      :open="rejectOpen"
      title="Rechazar garantía"
      description="¿Deseas rechazar esta garantía?"
      confirm-text="Rechazar"
      :loading="saving"
      @confirm="confirmReject"
      @cancel="rejectOpen = false"
    />

    <ConfirmDialog
      :open="finishOpen"
      title="Finalizar garantía"
      description="¿Deseas finalizar este proceso de garantía?"
      confirm-text="Finalizar"
      :loading="saving"
      @confirm="confirmFinish"
      @cancel="finishOpen = false"
    />
  </section>
</template>
