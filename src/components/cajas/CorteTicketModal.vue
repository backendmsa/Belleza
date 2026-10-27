<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PrinterIcon } from '@heroicons/vue/24/outline'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import { getCortePorId } from '@/api/cajas'
import { getEmpresa } from '@/api/empresa'
import { getFriendlyError } from '@/utils/apiError'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { CorteCaja } from '@/types/caja'
import type { Empresa } from '@/types/empresa'

// Un único componente reutilizable: cierre exitoso, historial y Reportes.
// La impresión únicamente consulta datos; nunca realiza un POST de cierre.
const props = defineProps<{ corteId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const corte = ref<CorteCaja | null>(null)
const empresa = ref<Empresa | null>(null)
const loading = ref(false)
const errorMessage = ref('')
let requestSequence = 0

function removePrintSheet() {
  document.getElementById('corte-ticket-print-sheet')?.remove()
  document.body.classList.remove('printing-corte-ticket')
}

async function loadTicket(id: string) {
  const sequence = ++requestSequence
  corte.value = null
  empresa.value = null
  errorMessage.value = ''
  loading.value = true

  try {
    // El mismo GET protegido que usa «Ver corte»: el backend decide permisos.
    const [corteActual, empresaActual] = await Promise.all([getCortePorId(id), getEmpresa()])
    if (sequence !== requestSequence) return

    // No permitir imprimir arqueos aún sin confirmar.
    if (!corteActual.fechaFin || corteActual.efectivoFinal === null || corteActual.diferencia === null) {
      errorMessage.value = 'El corte debe estar cerrado para generar su ticket.'
      return
    }
    if (!empresaActual.nombre?.trim()) {
      errorMessage.value = 'Configura el nombre del negocio antes de imprimir.'
      return
    }

    corte.value = corteActual
    empresa.value = empresaActual
  } catch (error) {
    if (sequence === requestSequence) {
      errorMessage.value = getFriendlyError(error, 'No fue posible consultar el corte para imprimir.')
    }
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

watch(
  () => props.corteId,
  (id) => {
    removePrintSheet()
    if (id) {
      void loadTicket(id)
    } else {
      ++requestSequence // Ignora respuestas HTTP de un modal que ya se cerró.
      corte.value = null
      empresa.value = null
      errorMessage.value = ''
      loading.value = false
    }
  },
  { immediate: true },
)

function preparePrintSheet() {
  if (!corte.value || !empresa.value || !props.corteId) return
  if (document.getElementById('corte-ticket-print-sheet')) return
  const preview = document.getElementById('corte-ticket-preview')
  if (!preview) return

  const sheet = preview.cloneNode(true) as HTMLElement
  sheet.id = 'corte-ticket-print-sheet'
  sheet.setAttribute('aria-hidden', 'true')
  document.body.appendChild(sheet)
  document.body.classList.add('printing-corte-ticket')
}

function printTicket() {
  if (!corte.value || !empresa.value || loading.value) return
  preparePrintSheet()
  if (!document.getElementById('corte-ticket-print-sheet')) return
  window.print()
}

function estadoDiferencia(valor: number | null): string {
  if (valor === null) return 'Pendiente'
  if (valor < 0) return 'Faltante'
  if (valor > 0) return 'Sobrante'
  return 'Caja cuadrada'
}

onMounted(() => {
  window.addEventListener('beforeprint', preparePrintSheet)
  window.addEventListener('afterprint', removePrintSheet)
})

onBeforeUnmount(() => {
  ++requestSequence
  window.removeEventListener('beforeprint', preparePrintSheet)
  window.removeEventListener('afterprint', removePrintSheet)
  removePrintSheet()
})
</script>

<template>
  <BaseModal :open="Boolean(corteId)" title="Ticket de corte de caja" max-width="md" @close="emit('close')">
    <BaseLoader v-if="loading" text="Consultando corte de caja..." />
    <div v-else-if="errorMessage" class="space-y-3">
      <p role="alert" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMessage }}</p>
      <BaseButton v-if="corteId" variant="secondary" @click="loadTicket(corteId)">Reintentar</BaseButton>
    </div>
    <div v-else-if="corte && empresa">
      <div id="corte-ticket-preview" class="mx-auto max-w-sm bg-white text-sm text-gray-800">
        <div class="text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#C56B86] font-bold text-white">B</div>
          <h3 class="ticket-business-name mt-3 text-lg font-semibold">{{ empresa.nombre }}</h3>
          <p v-if="empresa.direccion" class="text-xs text-gray-500">{{ empresa.direccion }}</p>
          <p v-if="empresa.telefono" class="text-xs text-gray-500">{{ empresa.telefono }}</p>
          <p class="mt-3 font-bold uppercase">Corte de caja</p>
        </div>

        <div class="my-5 space-y-2 border-y border-dashed border-gray-300 py-4 text-xs">
          <div class="flex justify-between gap-4"><span>Corte ID</span><span class="font-medium">{{ corte.id }}</span></div>
          <div class="flex justify-between gap-4"><span>Caja</span><span class="font-medium">{{ corte.cajaNombre || corte.caja }}</span></div>
          <div class="flex justify-between gap-4"><span>Responsable</span><span class="font-medium">{{ corte.usuarioNombre || 'Sin nombre disponible' }}</span></div>
          <div class="flex justify-between gap-4"><span>Apertura</span><span class="font-medium">{{ formatDate(corte.fechaInicio) }}</span></div>
          <div class="flex justify-between gap-4"><span>Cierre</span><span class="font-medium">{{ corte.fechaFin ? formatDate(corte.fechaFin) : 'Pendiente' }}</span></div>
          <div class="flex justify-between gap-4"><span>Estado</span><span class="font-medium">{{ corte.fechaFin ? 'Cerrado' : 'Abierto' }}</span></div>
        </div>

        <dl class="space-y-2">
          <div class="flex justify-between gap-4"><dt>Número de ventas</dt><dd>{{ corte.numeroVentas }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Ventas efectivo</dt><dd>{{ formatCurrency(corte.totalVentasEfectivo) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Ventas tarjeta</dt><dd>{{ formatCurrency(corte.totalVentasTarjeta) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Ventas transferencia</dt><dd>{{ formatCurrency(corte.totalVentasTransferencia) }}</dd></div>
          <div class="flex justify-between gap-4 border-t border-dashed border-gray-300 pt-2 font-semibold"><dt>Total vendido (todos los pagos)</dt><dd>{{ formatCurrency(corte.totalVentas) }}</dd></div>
        </dl>

        <dl class="mt-5 space-y-2 border-t border-dashed border-gray-300 pt-4">
          <div class="font-semibold">Reembolsos</div>
          <div class="flex justify-between gap-4"><dt>Efectivo</dt><dd>{{ formatCurrency(corte.totalReembolsosEfectivo) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Tarjeta</dt><dd>{{ formatCurrency(corte.totalReembolsosTarjeta) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Transferencia</dt><dd>{{ formatCurrency(corte.totalReembolsosTransferencia) }}</dd></div>
          <div class="flex justify-between gap-4 font-semibold"><dt>Total reembolsado</dt><dd>{{ formatCurrency(corte.totalReembolsos) }}</dd></div>
        </dl>

        <dl class="mt-5 space-y-2 border-t border-dashed border-gray-300 pt-4">
          <div class="font-semibold">Arqueo (solo efectivo físico)</div>
          <div class="flex justify-between gap-4"><dt>Fondo inicial</dt><dd>{{ formatCurrency(corte.efectivoInicial) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>+ Ventas efectivo</dt><dd>{{ formatCurrency(corte.totalVentasEfectivo) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>- Reembolsos efectivo</dt><dd>{{ formatCurrency(corte.totalReembolsosEfectivo) }}</dd></div>
          <div class="flex justify-between gap-4 font-semibold"><dt>Efectivo esperado</dt><dd>{{ formatCurrency(corte.efectivoEsperadoActual) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Efectivo contado</dt><dd>{{ corte.efectivoFinal === null ? 'Pendiente' : formatCurrency(corte.efectivoFinal) }}</dd></div>
          <div class="flex justify-between gap-4 font-semibold"><dt>Diferencia</dt><dd>{{ corte.diferencia !== null && corte.diferencia > 0 ? '+' : '' }}{{ corte.diferencia === null ? 'Pendiente' : formatCurrency(corte.diferencia) }}</dd></div>
          <div class="flex justify-between gap-4"><dt>Resultado</dt><dd>{{ estadoDiferencia(corte.diferencia) }}</dd></div>
        </dl>

        <div v-if="empresa.mensajeTicket?.trim()" class="mt-5 border-t border-dashed border-gray-300 pt-4 text-center text-xs text-gray-500">
          {{ empresa.mensajeTicket }}
        </div>
      </div>

      <p class="mt-5 text-xs text-gray-500">
        Para impresora térmica de 58 mm: papel de 58 mm, márgenes «Ninguno» y escala 100 %.
      </p>
      <div class="mt-3 flex justify-stretch sm:justify-end">
        <BaseButton class="w-full sm:w-auto" @click="printTicket">
          <PrinterIcon class="h-5 w-5" /> Imprimir ticket
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<!-- Mantiene la misma geometría y ajustes de impresión que TicketPreview.vue.
     Se usan IDs propios para no interferir con los tickets de ventas. -->
<style>
#corte-ticket-print-sheet { display: none; }

@page { size: auto; margin: 0; }

@media print {
  html,
  body.printing-corte-ticket {
    width: 58mm !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #fff !important;
  }

  body.printing-corte-ticket > *:not(#corte-ticket-print-sheet) { display: none !important; }

  body.printing-corte-ticket #corte-ticket-print-sheet {
    display: block !important;
    box-sizing: border-box;
    width: 48mm !important;
    max-width: 48mm !important;
    margin: 0 auto !important;
    padding: 12mm 0 4mm !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    color: #000 !important;
    background: #fff !important;
    font-family: Arial, sans-serif;
    font-size: 10pt !important;
    line-height: 1.25;
    overflow-wrap: anywhere;
    zoom: 80% !important;
    transform: translateX(-2mm);
  }

  #corte-ticket-print-sheet::before {
    content: '';
    display: block;
    border-top: 1px dashed #000;
    margin-bottom: 3mm;
  }

  #corte-ticket-print-sheet * {
    color: #000 !important;
    background: transparent !important;
    border-color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  #corte-ticket-print-sheet > .text-center > div:first-child { display: none !important; }

  #corte-ticket-print-sheet .flex { gap: 1mm !important; flex-wrap: wrap; }
  #corte-ticket-print-sheet .flex > * { min-width: 0; overflow-wrap: anywhere; }
  #corte-ticket-print-sheet .flex > :last-child { max-width: 100%; margin-left: auto; text-align: right; }

  #corte-ticket-print-sheet .text-base,
  #corte-ticket-print-sheet .text-lg { font-size: 11pt !important; }

  #corte-ticket-print-sheet .ticket-business-name {
    margin: 0 0 1mm !important;
    font-size: 11pt !important;
    font-weight: 700 !important;
    line-height: 1.3 !important;
    text-align: center !important;
  }
  #corte-ticket-print-sheet .text-xs { font-size: 9.5pt !important; }
  #corte-ticket-print-sheet > .my-5 { margin: 3mm 0 !important; padding: 2mm 0 !important; }
  #corte-ticket-print-sheet > dl { margin-top: 3mm !important; padding-top: 2mm !important; break-inside: avoid; }
  #corte-ticket-print-sheet > .text-center,
  #corte-ticket-print-sheet > div:last-child { break-inside: avoid; }
}
</style>
