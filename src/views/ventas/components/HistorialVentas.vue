<script setup lang="ts">
import { EyeIcon, PrinterIcon, XCircleIcon } from '@heroicons/vue/24/outline'

import EmptyState from '@/components/common/EmptyState.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseDateRangeFilter from '@/components/ui/BaseDateRangeFilter.vue'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'


import type { VentaResumen } from '@/types/venta'

interface Props {
  ventas: VentaResumen[]
  canCancel: boolean
  page: number
  totalPages: number
  count: number
  dateFrom: string
  dateTo: string
}

defineProps<Props>()

const emit = defineEmits<{
  view: [venta: VentaResumen]
  reprint: [venta: VentaResumen]
  cancel: [venta: VentaResumen]
  page: [value: number]
  dates: [from: string, to: string]
}>()

function statusFor(estado: VentaResumen['estado']) {
  if (estado === 'COMPLETADA') {
    return { status: 'success' as const, label: 'Completada' }
  }

  if (estado === 'CANCELADA') {
    return { status: 'danger' as const, label: 'Cancelada' }
  }

  return { status: 'warning' as const, label: 'Devuelta' }
}
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-[#ECECEC] bg-white">
    <div class="border-b border-gray-100 p-4">
      <BaseDateRangeFilter
        :from="dateFrom"
        :to="dateTo"
        @range-change="(from, to) => emit('dates', from, to)"
      />
    </div>

    <div class="overflow-x-auto">
      <table
        v-if="ventas.length"
        class="mobile-stack-table w-full min-w-[850px] text-left text-sm"
      >
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr class="text-xs font-semibold uppercase text-gray-500">
            <th class="px-5 py-4">Folio</th>
            <th class="px-5 py-4">Fecha</th>
            <th class="px-5 py-4">Usuario</th>
            <th class="px-5 py-4">Total</th>
            <th class="px-5 py-4">Estado</th>
            <th class="px-5 py-4 text-right">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
          <tr v-for="venta in ventas" :key="venta.id" class="interactive-lift-row">
            <td data-label="Folio" class="px-5 py-4 font-medium text-gray-900">
              {{ venta.folio }}
            </td>
            <td data-label="Fecha" class="whitespace-nowrap px-5 py-4 text-gray-600">
              {{ formatDate(venta.fecha) }}
            </td>
            <td data-label="Usuario" class="px-5 py-4 text-gray-600">{{ venta.usuario }}</td>
            <td data-label="Total" class="px-5 py-4 font-semibold text-gray-900">
              {{ formatCurrency(venta.total) }}
            </td>
            <td data-label="Estado" class="px-5 py-4">
              <StatusChip
                :status="statusFor(venta.estado).status"
                :label="statusFor(venta.estado).label"
              />
            </td>
            <td data-label="Acciones" class="px-5 py-4">
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  class="rounded-lg p-2 text-gray-400 hover:bg-[#FBEFF3] hover:text-[#C56B86]"
                  aria-label="Ver venta"
                  @click="emit('view', venta)"
                >
                  <EyeIcon class="h-5 w-5" />
                </button>

                <button
                  type="button"
                  class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Reimprimir ticket"
                  @click="emit('reprint', venta)"
                >
                  <PrinterIcon class="h-5 w-5" />
                </button>

                <button
                  v-if="canCancel && venta.estado === 'COMPLETADA'"
                  type="button"
                  class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Cancelar venta"
                  @click="emit('cancel', venta)"
                >
                  <XCircleIcon class="h-5 w-5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <EmptyState
        v-else
        title="No hay ventas en este periodo"
        description="Cambia el periodo para consultar ventas anteriores."
      />
    </div>

    <div v-if="count > 10" class="border-t border-gray-100 p-4">
      <BasePagination :page="page" :total-pages="totalPages" @change="emit('page', $event)" />
    </div>
  </div>
</template>
