<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  LockOpenIcon,
  EyeIcon,
  NoSymbolIcon,
  PlusIcon,
  PrinterIcon,
} from '@heroicons/vue/24/outline'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseDateRangeFilter from '@/components/ui/BaseDateRangeFilter.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import DetalleCorteModal from '@/components/cajas/DetalleCorteModal.vue'
import CorteTicketModal from '@/components/cajas/CorteTicketModal.vue'
import StatusChip from '@/components/common/StatusChip.vue'

import {
  abrirCaja,
  activarCaja,
  cerrarCaja,
  createCaja,
  desactivarCaja,
  getCajas,
  getCajasActivas,
  updateCaja,
  getCorteActivo,
  getCortePorId,
  getHistorialCortes,
} from '@/api/cajas'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { getFriendlyError } from '@/utils/apiError'
import { useClientPagination } from '@/composables/useClientPagination'
import { useDateRangeFilter } from '@/composables/useDateRangeFilter'
import { showError, showSuccess } from '@/utils/notifications'
import { useAuthStore } from '@/stores/auth'

import type { Caja, CorteCaja } from '@/types/caja'

type ModalMode = 'crear' | 'editar' | 'abrir' | 'cerrar'

const authStore = useAuthStore()

const cajas = ref<Caja[]>([])
const cortesActivos = ref<Record<string, CorteCaja>>({})
const historial = ref<CorteCaja[]>([])
const detalleCorte = ref<CorteCaja | null>(null)
const detalleCorteOpen = ref(false)
const ticketCorteId = ref<string | null>(null)
const detalleCorteLoading = ref(false)
const {
  dateFrom: historyDateFrom,
  dateTo: historyDateTo,
  matchesDate: matchesHistoryDate,
} = useDateRangeFilter('today')
const filteredHistory = computed(() =>
  historial.value.filter((item) => matchesHistoryDate(item.fechaInicio)),
)
const {
  page: historyPage,
  totalPages: historyTotalPages,
  paginatedItems: paginatedHistory,
  goToPage: goToHistoryPage,
} = useClientPagination(filteredHistory, 10)
const selectedCaja = ref<Caja | null>(null)
const loading = ref(false)
const saving = ref(false)
const modalOpen = ref(false)
const cierreRealizadoOpen = ref(false)
const cierreRealizado = ref<{ corteId: string; caja: string; efectivoContado: number; diferencia: number } | null>(null)
const modalMode = ref<ModalMode>('crear')
const resumenCierre = ref<CorteCaja | null>(null)
const cargandoResumenCierre = ref(false)

const form = reactive({
  nombre: '',
  efectivo: '',
})

const efectivoContadoValido = computed(() => {
  const valor = form.efectivo.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(valor)) return null
  const cantidad = Number(valor)
  if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > 99999999.99) return null
  return Math.round(cantidad * 100) / 100
})

const diferenciaPrevia = computed(() => {
  if (!resumenCierre.value || efectivoContadoValido.value === null) return null
  return Math.round((efectivoContadoValido.value - resumenCierre.value.efectivoEsperadoActual) * 100) / 100
})

function resumenCambio(anterior: CorteCaja, actual: CorteCaja): boolean {
  if (anterior.id !== actual.id) return true
  const campos: (keyof CorteCaja)[] = [
    'totalVentas', 'totalReembolsos', 'numeroVentas', 'efectivoEsperadoActual',
    'totalVentasEfectivo', 'totalVentasTarjeta', 'totalVentasTransferencia',
    'totalReembolsosEfectivo', 'totalReembolsosTarjeta', 'totalReembolsosTransferencia',
  ]
  return campos.some((campo) => anterior[campo] !== actual[campo])
}

const modalTitle = computed(() => {
  if (modalMode.value === 'crear') return 'Nueva caja'
  if (modalMode.value === 'editar') return 'Editar caja'
  if (modalMode.value === 'abrir') return 'Abrir caja'
  return 'Cerrar caja'
})

async function loadData() {
  loading.value = true

  try {
    const [allBoxes, operativeBoxes] = await Promise.all([
      authStore.isAdmin ? getCajas() : getCajasActivas(),
      getCajasActivas(),
    ])
    const byId = new Map(operativeBoxes.map((box) => [box.id, box]))
    cajas.value = allBoxes.map((box) => ({ ...box, ...byId.get(box.id) }))

    // El backend permite consultar/operar el corte propio, nunca el de otra persona.
    const cajasAbiertas = cajas.value.filter((item) => item.esMia && item.ocupada)
    const cortesEntries = await Promise.all(
      cajasAbiertas.map(async (caja) => {
        try {
          const corte = await getCorteActivo(caja.id)
          return [caja.id, corte] as const
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null
          }
          throw error
        }
      }),
    )

    cortesActivos.value = Object.fromEntries(
      cortesEntries.filter((entry): entry is readonly [string, CorteCaja] => entry !== null),
    )

    if (selectedCaja.value) {
      historial.value = await getHistorialCortes(selectedCaja.value.id)
    }
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible cargar la información de caja.'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  selectedCaja.value = null
  form.nombre = ''
  modalMode.value = 'crear'
  modalOpen.value = true
}

function editBox(caja: Caja) {
  selectedCaja.value = caja
  form.nombre = caja.nombre
  modalMode.value = 'editar'
  modalOpen.value = true
}

function openBox(caja: Caja) {
  if (!caja.activa || caja.ocupada) return
  selectedCaja.value = caja
  form.efectivo = ''
  modalMode.value = 'abrir'
  modalOpen.value = true
}

async function closeBox(caja: Caja) {
  if (!caja.esMia || cargandoResumenCierre.value) return
  cargandoResumenCierre.value = true
  resumenCierre.value = null
  try {
    const corte = await getCorteActivo(caja.id)
    selectedCaja.value = caja
    cortesActivos.value = { ...cortesActivos.value, [caja.id]: corte }
    resumenCierre.value = corte
    form.efectivo = ''
    modalMode.value = 'cerrar'
    modalOpen.value = true
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible consultar el corte actual.'))
  } finally {
    cargandoResumenCierre.value = false
  }
}

async function verDetalleCorte(corte: CorteCaja) {
  if (detalleCorteLoading.value) return
  detalleCorteLoading.value = true
  try {
    // Consulta individual con control de acceso en el backend.
    detalleCorte.value = await getCortePorId(corte.id)
    detalleCorteOpen.value = true
  } catch (error) {
    await showError(getFriendlyError(error, 'No tienes acceso a este corte o no existe.'))
  } finally {
    detalleCorteLoading.value = false
  }
}

async function viewHistory(caja: Caja) {
  selectedCaja.value = caja
  loading.value = true

  try {
    historial.value = await getHistorialCortes(caja.id)
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible cargar el historial.'))
  } finally {
    loading.value = false
  }
}

async function toggleCajaActiva(caja: Caja) {
  saving.value = true

  try {
    if (caja.activa) {
      await desactivarCaja(caja.id)
      await showSuccess('Caja desactivada correctamente.')
    } else {
      await activarCaja(caja.id)
      await showSuccess('Caja activada correctamente.')
    }

    await loadData()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible cambiar el estado de la caja.'))
  } finally {
    saving.value = false
  }
}

async function submitModal() {
  saving.value = true

  try {
    if (modalMode.value === 'crear') {
      if (!form.nombre.trim()) return
      await createCaja(form.nombre.trim())
      await showSuccess('Caja creada correctamente.')
    }

    if (modalMode.value === 'editar' && selectedCaja.value) {
      if (!form.nombre.trim()) return
      await updateCaja(selectedCaja.value.id, form.nombre.trim())
      await showSuccess('Nombre de caja actualizado.')
    }

    if (
      (modalMode.value === 'abrir' || modalMode.value === 'cerrar') &&
      efectivoContadoValido.value === null
    ) {
      await showError('Ingresa un importe válido, no negativo y con máximo dos decimales.')
      return
    }

    if (modalMode.value === 'abrir' && selectedCaja.value) {
      const response = await abrirCaja({
        caja_id: selectedCaja.value.id,
        efectivo_inicial: efectivoContadoValido.value!,
      })
      await showSuccess(response.message ?? 'Caja abierta correctamente.')
    }

    if (modalMode.value === 'cerrar' && selectedCaja.value) {
      const actual = await getCorteActivo(selectedCaja.value.id)
      if (!resumenCierre.value || resumenCambio(resumenCierre.value, actual)) {
        resumenCierre.value = actual
        cortesActivos.value = { ...cortesActivos.value, [selectedCaja.value.id]: actual }
        await showError('Hubo cambios en el turno desde que abriste el resumen. Revisa los importes y confirma nuevamente.')
        return
      }
      const response = await cerrarCaja({
        caja_id: selectedCaja.value.id,
        efectivo_final: efectivoContadoValido.value!,
      })

      // El id real del cierre sirve para consultar (GET) e imprimir el ticket, sin otro POST.
      cierreRealizado.value = {
        corteId: response.data.corteId,
        caja: selectedCaja.value.nombre,
        efectivoContado: response.data.efectivoContado,
        diferencia: response.data.diferencia,
      }
      modalOpen.value = false
      cierreRealizadoOpen.value = true
      await loadData()
      return
    }

    modalOpen.value = false
    await loadData()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible completar la operación.'))
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Caja' }]" />

    <div class="mt-4 mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Caja</h1>
        <p class="mt-1 text-sm text-gray-500">Abre, cierra y consulta los turnos de caja.</p>
      </div>

      <BaseButton v-if="authStore.isAdmin" @click="openCreate">
        <PlusIcon class="h-4 w-4" />
        Nueva caja
      </BaseButton>
    </div>

    <BaseLoader v-if="loading" text="Cargando cajas..." />

    <div v-else>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="caja in cajas"
          :key="caja.id"
          class="interactive-lift-card rounded-2xl border border-[#ECECEC] bg-white p-5"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FBEFF3]">
              <BanknotesIcon class="h-6 w-6 text-[#C56B86]" />
            </div>

            <StatusChip
              :status="caja.estado === 'ABIERTA' ? 'success' : 'neutral'"
              :label="caja.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'"
            />
          </div>

          <h2 class="mt-4 font-semibold text-gray-900">{{ caja.nombre }}</h2>
          <p class="mt-1 text-sm text-gray-500">
            {{
              !caja.activa
                ? 'Inactiva'
                : caja.ocupada
                  ? caja.esMia
                    ? 'Tu caja abierta'
                    : 'En uso por otro usuario'
                  : 'Disponible'
            }}
          </p>

          <div class="mt-5 flex flex-wrap gap-2">
            <BaseButton
              v-if="!caja.ocupada && caja.estado === 'CERRADA'"
              :disabled="!caja.activa"
              @click="openBox(caja)"
            >
              <LockOpenIcon class="h-4 w-4" />
              Abrir
            </BaseButton>

            <BaseButton
              v-else-if="caja.esMia && cortesActivos[caja.id]"
              variant="danger"
              :disabled="cargandoResumenCierre || saving"
              @click="closeBox(caja)"
            >
              <LockClosedIcon class="h-4 w-4" />
              Cerrar
            </BaseButton>

            <span
              v-else
              class="inline-flex items-center rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700"
            >
              En uso por otro usuario
            </span>

            <BaseButton
              v-if="authStore.isAdmin && !caja.ocupada"
              variant="secondary"
              @click="editBox(caja)"
            >
              Editar nombre
            </BaseButton>
            <BaseButton variant="secondary" @click="viewHistory(caja)">
              <ClockIcon class="h-4 w-4" />
              Historial
            </BaseButton>

            <BaseButton
              v-if="authStore.isAdmin && !caja.ocupada && caja.estado === 'CERRADA'"
              variant="secondary"
              :disabled="saving"
              @click="toggleCajaActiva(caja)"
            >
              <NoSymbolIcon v-if="caja.activa" class="h-4 w-4" />
              <CheckCircleIcon v-else class="h-4 w-4" />
              {{ caja.activa ? 'Desactivar' : 'Activar' }}
            </BaseButton>
          </div>

          <div v-if="cortesActivos[caja.id]" class="mt-5 border-t border-gray-100 pt-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Resumen del turno
            </p>
            <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <p class="text-[11px] uppercase text-gray-400">Apertura</p>
                <p class="mt-1 text-xs font-medium text-gray-900">
                  {{ formatDate(cortesActivos[caja.id]!.fechaInicio) }}
                </p>
              </div>

              <div>
                <p class="text-[11px] uppercase text-gray-400">Efectivo inicial</p>
                <p class="mt-1 text-xs font-medium text-gray-900">
                  {{ formatCurrency(cortesActivos[caja.id]!.efectivoInicial) }}
                </p>
              </div>

              <div>
                <p class="text-[11px] uppercase text-gray-400">Ventas</p>
                <p class="mt-1 text-xs font-semibold text-gray-900">
                  {{ formatCurrency(cortesActivos[caja.id]!.totalVentas) }}
                </p>
                <p class="mt-0.5 text-[11px] text-gray-500">
                  {{ cortesActivos[caja.id]!.numeroVentas }}
                  {{ cortesActivos[caja.id]!.numeroVentas === 1 ? 'transacción' : 'transacciones' }}
                </p>
              </div>

              <div>
                <p class="text-[11px] uppercase text-gray-400">Reembolsos</p>
                <p class="mt-1 text-xs font-semibold text-red-500">
                  {{ formatCurrency(cortesActivos[caja.id]!.totalReembolsos) }}
                </p>
              </div>

              <div class="col-span-2">
                <p class="text-[11px] uppercase text-gray-400">Efectivo esperado</p>
                <p class="mt-1 text-sm font-semibold text-gray-900">
                  {{ formatCurrency(cortesActivos[caja.id]!.efectivoEsperadoActual) }}
                </p>
              </div>
            </div>
          </div>
        </article>

        <div
          v-if="!cajas.length"
          class="rounded-2xl border border-[#ECECEC] bg-white p-10 text-center text-gray-500"
        >
          No hay cajas registradas.
        </div>
      </div>

      <div
        v-if="selectedCaja"
        class="mt-6 overflow-hidden rounded-2xl border border-[#ECECEC] bg-white"
      >
        <div class="border-b border-gray-100 px-5 py-4">
          <h2 class="font-semibold text-gray-900">Historial de {{ selectedCaja.nombre }}</h2>
        </div>

        <div class="border-b border-gray-100 p-4">
          <BaseDateRangeFilter v-model:from="historyDateFrom" v-model:to="historyDateTo" />
        </div>

        <div class="overflow-x-auto">
          <table class="mobile-stack-table w-full min-w-[800px] text-left text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr class="text-xs font-semibold uppercase text-gray-500">
                <th class="px-5 py-4">Apertura</th>
                <th class="px-5 py-4">Cierre</th>
                <th class="px-5 py-4">Inicial</th>
                <th class="px-5 py-4">Final</th>
                <th class="px-5 py-4">Diferencia</th>
                <th class="px-5 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="item in paginatedHistory" :key="item.id" class="interactive-lift-row">
                <td data-label="Apertura" class="px-5 py-4 text-gray-600">
                  {{ formatDate(item.fechaInicio) }}
                </td>
                <td data-label="Cierre" class="px-5 py-4 text-gray-600">
                  {{ item.fechaFin ? formatDate(item.fechaFin) : 'Abierto' }}
                </td>
                <td data-label="Inicial" class="px-5 py-4 text-gray-600">
                  {{ formatCurrency(item.efectivoInicial) }}
                </td>
                <td data-label="Final" class="px-5 py-4 text-gray-600">
                  {{ item.efectivoFinal === null ? '—' : formatCurrency(item.efectivoFinal) }}
                </td>
                <td data-label="Diferencia" class="px-5 py-4 font-medium text-gray-900">
                  {{ item.diferencia === null ? '—' : formatCurrency(item.diferencia) }}
                </td>
                <td data-label="Acciones" class="px-5 py-4">
                  <BaseButton variant="secondary" :disabled="detalleCorteLoading" @click="verDetalleCorte(item)">
                    <EyeIcon class="h-4 w-4" /> Ver corte
                  </BaseButton>
                </td>
              </tr>

              <tr v-if="!filteredHistory.length">
                <td colspan="6" class="px-6 py-10 text-center text-gray-500">
                  No hay cortes registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="filteredHistory.length > 10" class="mt-4">
        <BasePagination
          :page="historyPage"
          :total-pages="historyTotalPages"
          @change="goToHistoryPage"
        />
      </div>
    </div>

    <BaseModal :open="modalOpen" :title="modalTitle" :max-width="modalMode === 'cerrar' ? 'lg' : 'md'" @close="modalOpen = false">
      <form class="space-y-5" @submit.prevent="submitModal">
        <BaseInput
          v-if="modalMode === 'crear' || modalMode === 'editar'"
          v-model="form.nombre"
          label="Nombre de la caja"
          placeholder="Ej. Caja principal"
          required
        />

        <div v-if="modalMode === 'cerrar' && resumenCierre" class="space-y-3">
          <!-- Separar claramente ventas digitales del dinero que hay en el cajón. -->
          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500">Ventas de esta caja</p>
            <div class="mt-3 grid grid-cols-2 gap-y-2 text-sm text-gray-700">
              <span>Efectivo</span><span class="text-right">{{ formatCurrency(resumenCierre.totalVentasEfectivo) }}</span>
              <span>Tarjeta</span><span class="text-right">{{ formatCurrency(resumenCierre.totalVentasTarjeta) }}</span>
              <span>Transferencia</span><span class="text-right">{{ formatCurrency(resumenCierre.totalVentasTransferencia) }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
              <span class="font-semibold text-gray-900">Total vendido <span class="block text-xs font-normal text-gray-500">Todos los pagos</span></span>
              <span class="text-xl font-bold text-gray-900">{{ formatCurrency(resumenCierre.totalVentas) }}</span>
            </div>
            <div v-if="resumenCierre.totalReembolsos > 0" class="mt-2 flex justify-between gap-3 text-xs text-gray-500">
              <span>Reembolsos (todos los pagos)</span>
              <span>−{{ formatCurrency(resumenCierre.totalReembolsos) }}</span>
            </div>
          </div>

          <div class="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <p class="text-xs font-bold uppercase tracking-wide text-rose-800">Dinero en caja · Solo efectivo</p>
            <div class="mt-3 grid grid-cols-2 gap-y-2 text-sm text-gray-700">
              <span>Fondo inicial</span><span class="text-right">{{ formatCurrency(resumenCierre.efectivoInicial) }}</span>
              <span>+ Ventas en efectivo</span><span class="text-right">{{ formatCurrency(resumenCierre.totalVentasEfectivo) }}</span>
              <span>− Reembolsos en efectivo</span><span class="text-right">{{ formatCurrency(resumenCierre.totalReembolsosEfectivo) }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 border-t border-rose-200 pt-3">
              <span class="font-semibold text-gray-900">Efectivo que debe haber</span>
              <span class="text-xl font-bold text-gray-900">{{ formatCurrency(resumenCierre.efectivoEsperadoActual) }}</span>
            </div>
          </div>
        </div>

        <BaseInput
          v-if="modalMode === 'abrir' || modalMode === 'cerrar'"
          v-model="form.efectivo"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0.00"
          :label="modalMode === 'abrir' ? 'Efectivo inicial' : 'Efectivo contado'"
          required
        />

        <div v-if="modalMode === 'cerrar' && resumenCierre" class="rounded-xl bg-gray-50 px-4 py-3" aria-live="polite">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-semibold text-gray-700">Diferencia de efectivo</span>
            <span v-if="diferenciaPrevia !== null" :class="['text-lg font-semibold', diferenciaPrevia < 0 ? 'text-red-600' : diferenciaPrevia > 0 ? 'text-amber-700' : 'text-green-700']">
              {{ diferenciaPrevia > 0 ? '+' : '' }}{{ formatCurrency(diferenciaPrevia) }}
            </span>
            <span v-else class="text-sm text-gray-500">Ingresa el efectivo contado</span>
          </div>
          <p class="mt-1 text-xs text-gray-500">
            {{ diferenciaPrevia === null ? 'El valor aparece al capturar el efectivo.' : diferenciaPrevia < 0 ? 'Faltante de efectivo.' : diferenciaPrevia > 0 ? 'Sobrante de efectivo.' : 'Caja cuadrada.' }}
          </p>
        </div>

        <div
          class="mobile-action-row flex justify-end gap-3 border-t border-gray-100 pt-5 sm:flex-row"
        >
          <BaseButton variant="secondary" @click="modalOpen = false"> Cancelar </BaseButton>
          <BaseButton type="submit" :loading="saving" :disabled="modalMode === 'cerrar' && (!resumenCierre || efectivoContadoValido === null)">
            {{ modalMode === 'cerrar' ? 'Confirmar cierre' : 'Confirmar' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Se muestra únicamente después de confirmar y guardar el cierre en el backend. -->
    <BaseModal
      :open="cierreRealizadoOpen"
      title="Caja cerrada correctamente"
      max-width="md"
      @close="cierreRealizadoOpen = false"
    >
      <div v-if="cierreRealizado" class="space-y-4">
        <div class="flex items-center gap-2">
          <CheckCircleIcon class="h-6 w-6 text-green-600" />
          <p class="font-semibold text-gray-900">{{ cierreRealizado.caja }}</p>
        </div>
        <div class="space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <span>Efectivo contado</span>
            <strong>{{ formatCurrency(cierreRealizado.efectivoContado) }}</strong>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
            <span>Diferencia de efectivo</span>
            <strong :class="cierreRealizado.diferencia < 0 ? 'text-red-600' : cierreRealizado.diferencia > 0 ? 'text-amber-700' : 'text-green-700'">
              {{ cierreRealizado.diferencia > 0 ? '+' : '' }}{{ formatCurrency(cierreRealizado.diferencia) }}
            </strong>
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
          <BaseButton
            type="button"
            variant="secondary"
            :disabled="!cierreRealizado.corteId"
            @click="ticketCorteId = cierreRealizado.corteId"
          >
            <PrinterIcon class="h-4 w-4" /> Generar ticket
          </BaseButton>
          <BaseButton type="button" @click="cierreRealizadoOpen = false">Listo</BaseButton>
        </div>
      </div>
    </BaseModal>

    <DetalleCorteModal
      :open="detalleCorteOpen"
      :corte="detalleCorte"
      @close="detalleCorteOpen = false"
      @print="ticketCorteId = $event"
    />
    <CorteTicketModal :corte-id="ticketCorteId" @close="ticketCorteId = null" />
  </section>
</template>
