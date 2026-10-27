<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDownTrayIcon, EyeIcon } from '@heroicons/vue/24/outline'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import DetalleCorteModal from '@/components/cajas/DetalleCorteModal.vue'
import CorteTicketModal from '@/components/cajas/CorteTicketModal.vue'

import { getReporte, getReportePage } from '@/api/reportes'
import { getCortePorId } from '@/api/cajas'
import { getFriendlyError } from '@/utils/apiError'
import {
  formatReportCell,
  getReportLabel,
  getVisibleReportFields,
  isDateReportField,
  isMoneyReportField,
} from '@/utils/reportDisplay'
import { showError } from '@/utils/notifications'
import { useAuthStore } from '@/stores/auth'

import type { ReporteClave, ReporteFila } from '@/types/reporte'
import type { CorteCaja } from '@/types/caja'

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const authStore = useAuthStore()

const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

const reportType = ref<ReporteClave>(authStore.isAdmin ? 'ventas' : 'inventario')
const startDate = ref(toInputDate(thirtyDaysAgo))
const endDate = ref(toInputDate(today))
const rows = ref<ReporteFila[]>([])
const loading = ref(false)
const exporting = ref(false)
const detalleOpen = ref(false)
const detalleLoading = ref(false)
const detalleCorte = ref<CorteCaja | null>(null)
const ticketCorteId = ref<string | null>(null)
const generated = ref(false)
const page = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const pageSize = 10

const allReportOptions: Array<{ label: string; value: ReporteClave; adminOnly?: boolean }> = [
  { label: 'Ventas', value: 'ventas', adminOnly: true },
  { label: 'Inventario', value: 'inventario' },
  { label: 'Stock bajo', value: 'stock-bajo' },
  { label: 'Cortes de caja', value: 'cortes', adminOnly: true },
  { label: 'Productos más vendidos', value: 'productos', adminOnly: true },
  { label: 'Devoluciones', value: 'devoluciones', adminOnly: true },
  { label: 'Garantías', value: 'garantias', adminOnly: true },
  { label: 'Movimientos de inventario', value: 'movimientos', adminOnly: true },
]

const reportOptions = computed(() =>
  allReportOptions.filter((option) => !option.adminOnly || authStore.isAdmin),
)

const selectedReportLabel = computed(
  () => reportOptions.value.find((option) => option.value === reportType.value)?.label ?? 'Reporte',
)

const reportUsesDates = computed(
  () => reportType.value !== 'inventario' && reportType.value !== 'stock-bajo',
)

watch(reportType, () => {
  ticketCorteId.value = null
  detalleOpen.value = false
  detalleCorte.value = null
  rows.value = []
  generated.value = false
  page.value = 1
  totalPages.value = 1
  totalCount.value = 0
})

// Los IDs del backend se conservan en cada fila, pero no son columnas públicas.
const columns = computed(() => {
  const fields = getVisibleReportFields(rows.value)
  if (reportType.value !== 'cortes') return fields
  // Tabla breve. El resto del desglose se consulta con «Ver corte».
  return [
    'caja', 'usuario', 'fecha_inicio', 'fecha_fin',
    'total_ventas', 'efectivo_esperado_actual', 'efectivo_final', 'diferencia',
  ].filter((field) => fields.includes(field))
})

async function generateReport(targetPage = 1) {
  if (
    reportUsesDates.value &&
    startDate.value &&
    endDate.value &&
    startDate.value > endDate.value
  ) {
    await showError('La fecha inicial no puede ser posterior a la fecha final.')
    return
  }

  loading.value = true
  generated.value = false

  try {
    const params: Record<string, string> = {}

    if (reportUsesDates.value) {
      if (startDate.value) params.fecha_inicio = startDate.value
      if (endDate.value) params.fecha_fin = endDate.value
    }

    const result = await getReportePage(reportType.value, params, targetPage, pageSize)

    rows.value = result.items
    page.value = result.page
    totalPages.value = result.totalPages
    totalCount.value = result.count
    generated.value = true
  } catch (error) {
    await showError(
      getFriendlyError(
        error,
        `No fue posible generar el reporte de ${selectedReportLabel.value.toLowerCase()}.`,
      ),
    )
  } finally {
    loading.value = false
  }
}

function goToPage(targetPage: number) {
  void generateReport(targetPage)
}

async function exportExcel() {
  if (!totalCount.value) return

  exporting.value = true

  try {
    const params: Record<string, string> = {}

    if (reportUsesDates.value) {
      if (startDate.value) params.fecha_inicio = startDate.value
      if (endDate.value) params.fecha_fin = endDate.value
    }

    const exportRows = await getReporte(reportType.value, params)
    if (!exportRows.length) return

    // Importación diferida: ExcelJS solo se descarga cuando se exporta.
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Reporte')
    const headers = getVisibleReportFields(exportRows)
    const labels = headers.map(getReportLabel)

    worksheet.addRow(labels)
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    }

    for (const item of exportRows) {
      worksheet.addRow(headers.map((field) => {
        const value = item[field]
        if (isMoneyReportField(field) && value !== null && value !== undefined && value !== '') {
          const amount = Number(value)
          if (Number.isFinite(amount)) return amount
        }
        return formatReportCell(field, value)
      }))
    }

    headers.forEach((field, index) => {
      const longest = Math.max(
        labels[index]?.length ?? 0,
        ...exportRows.map((item) => formatReportCell(field, item[field]).length),
      )
      const column = worksheet.getColumn(index + 1)
      column.width = Math.min(48, Math.max(16, longest + 3))
      if (isMoneyReportField(field)) {
        column.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00)'
      }
    })

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8E4A60' },
    }
    worksheet.getRow(1).height = 25

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([new Uint8Array(buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-${reportType.value}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible exportar el reporte Excel.'))
  } finally {
    exporting.value = false
  }
}

async function verCorte(row: ReporteFila) {
  if (typeof row.id !== 'string') {
    await showError('Este corte no tiene un identificador válido.')
    return
  }

  detalleLoading.value = true
  try {
    // El servidor verifica permisos también al consultar un corte individual.
    detalleCorte.value = await getCortePorId(row.id)
    detalleOpen.value = true
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible consultar ese corte.'))
  } finally {
    detalleLoading.value = false
  }
}
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Reportes' }]" />

    <div class="mt-4 mb-8">
      <h1 class="text-2xl font-semibold text-gray-900">Reportes</h1>
      <p class="mt-1 text-sm text-gray-500">Consulta información del negocio por módulo.</p>
    </div>

    <div class="rounded-2xl border border-[#ECECEC] bg-white p-5">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BaseSelect
          v-model="reportType"
          label="Tipo de reporte"
          :options="reportOptions"
          required
        />

        <BaseInput
          v-model="startDate"
          type="date"
          label="Fecha inicial"
          :disabled="!reportUsesDates"
        />

        <BaseInput v-model="endDate" type="date" label="Fecha final" :disabled="!reportUsesDates" />

        <div class="flex items-end">
          <BaseButton class="w-full" :loading="loading" @click="generateReport(1)">
            Generar reporte
          </BaseButton>
        </div>
      </div>
    </div>

    <BaseLoader v-if="loading" text="Generando reporte..." />

    <div
      v-else-if="rows.length"
      class="mt-6 overflow-hidden rounded-2xl border border-[#ECECEC] bg-white"
    >
      <div class="flex justify-end border-b border-gray-100 p-4">
        <BaseButton variant="secondary" :loading="exporting" @click="exportExcel">
          <ArrowDownTrayIcon class="h-5 w-5" />
          Exportar Excel
        </BaseButton>
      </div>

      <div class="overflow-x-auto">
        <table class="mobile-stack-table w-full min-w-[850px] text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr class="text-xs font-semibold uppercase text-gray-500">
              <th
                v-for="column in columns"
                :key="column"
                :class="isMoneyReportField(column) ? 'text-right' : ''"
                class="px-5 py-4"
              >
                {{ getReportLabel(column) }}
              </th>
              <th v-if="reportType === 'cortes'" class="px-5 py-4">Acciones</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr v-for="(row, index) in rows" :key="index" class="interactive-lift-row">
              <td
                v-for="column in columns"
                :key="column"
                :data-label="getReportLabel(column)"
                :class="[
                  isMoneyReportField(column) ? 'text-right tabular-nums whitespace-nowrap' : '',
                  isDateReportField(column) ? 'whitespace-nowrap' : '',
                ]"
                class="px-5 py-4 text-gray-600"
              >
                {{ formatReportCell(column, row[column]) }}
              </td>
              <td v-if="reportType === 'cortes'" class="px-5 py-4" data-label="Acciones">
                <BaseButton variant="secondary" :disabled="detalleLoading" @click="verCorte(row)">
                  <EyeIcon class="h-4 w-4" /> Ver corte
                </BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <DetalleCorteModal
      :open="detalleOpen"
      :corte="detalleCorte"
      @close="detalleOpen = false"
      @print="ticketCorteId = $event"
    />
    <CorteTicketModal :corte-id="ticketCorteId" @close="ticketCorteId = null" />

    <div v-if="generated && totalPages > 1" class="mt-4">
      <BasePagination :page="page" :total-pages="totalPages" @change="goToPage" />
    </div>

    <div
      v-if="!loading && (!generated || !rows.length)"
      class="mt-6 rounded-2xl border border-[#ECECEC] bg-white p-12 text-center text-gray-500"
    >
      <template v-if="generated">
        No hay resultados para {{ selectedReportLabel.toLowerCase() }}
        <span v-if="reportUsesDates">en el periodo seleccionado</span>.
      </template>
      <template v-else> Selecciona un reporte y presiona “Generar reporte”. </template>
    </div>
  </section>
</template>
