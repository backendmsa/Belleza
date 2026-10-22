<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { PrinterIcon } from '@heroicons/vue/24/outline'

import BaseButton from '@/components/ui/BaseButton.vue'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { showError } from '@/utils/notifications'

import type { TicketEmpresa, VentaDetalle } from '@/types/venta'

interface Props {
  venta: VentaDetalle
  empresa?: TicketEmpresa | null
}

const props = defineProps<Props>()

function removePrintSheet() {
  document.getElementById('ticket-print-sheet')?.remove()
  document.body.classList.remove('printing-ticket')
}

function preparePrintSheet() {
  if (document.getElementById('ticket-print-sheet')) return

  const preview = document.getElementById('ticket-preview')
  if (!preview) return

  const sheet = preview.cloneNode(true) as HTMLElement
  sheet.id = 'ticket-print-sheet'
  sheet.setAttribute('aria-hidden', 'true')
  document.body.appendChild(sheet)
  document.body.classList.add('printing-ticket')
}

function printTicket() {
  if (!props.empresa?.nombre?.trim()) {
    void showError('No se encontró el nombre del negocio. Revisa la configuración antes de imprimir.')
    return
  }

  preparePrintSheet()
  window.print()
}

onMounted(() => {
  window.addEventListener('beforeprint', preparePrintSheet)
  window.addEventListener('afterprint', removePrintSheet)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', preparePrintSheet)
  window.removeEventListener('afterprint', removePrintSheet)
  removePrintSheet()
})
</script>

<template>
  <div>
    <div id="ticket-preview" class="mx-auto max-w-sm bg-white text-sm text-gray-800">
      <div class="text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#C56B86] font-bold text-white"
        >
          B
        </div>
        <h3 class="mt-3 text-lg font-semibold ticket-business-name">
          {{ empresa?.nombre?.trim() || 'Nombre del negocio no disponible' }}
        </h3>
        <p v-if="empresa?.direccion" class="text-xs text-gray-500">
          {{ empresa.direccion }}
        </p>
        <p v-if="empresa?.telefono" class="text-xs text-gray-500">
          {{ empresa.telefono }}
        </p>
      </div>

      <div class="my-5 border-y border-dashed border-gray-300 py-4 text-xs">
        <div class="flex justify-between gap-4">
          <span>Folio</span>
          <span class="font-medium">{{ venta.folio }}</span>
        </div>
        <div class="mt-2 flex justify-between gap-4">
          <span>Fecha</span>
          <span class="font-medium">{{ formatDate(venta.fecha) }}</span>
        </div>
        <div class="mt-2 flex justify-between gap-4">
          <span>Cajero</span>
          <span class="font-medium">{{ venta.usuario }}</span>
        </div>
        <div class="mt-2 flex justify-between gap-4">
          <span>Pago</span>
          <span class="font-medium">{{ venta.metodoPago }}</span>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="(item, index) in venta.productos"
          :key="`${item.producto}-${item.variante}-${index}`"
        >
          <div class="flex justify-between gap-4">
            <span class="font-medium"> {{ item.producto }} - {{ item.variante }} </span>
            <span>{{ item.cantidad }}</span>
          </div>
          <p class="mt-1 text-right text-xs text-gray-500">
            {{ formatCurrency(item.subtotal) }}
          </p>
        </div>
      </div>

      <dl class="mt-5 space-y-2 border-t border-dashed border-gray-300 pt-4">
        <div class="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{{ formatCurrency(venta.subtotal) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt>Descuento</dt>
          <dd>-{{ formatCurrency(venta.descuento) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt>IVA</dt>
          <dd>{{ formatCurrency(venta.iva) }}</dd>
        </div>
        <div class="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd>{{ formatCurrency(venta.total) }}</dd>
        </div>
        <div v-if="venta.efectivoRecibido != null" class="flex justify-between">
          <dt>Efectivo recibido</dt>
          <dd>{{ formatCurrency(venta.efectivoRecibido) }}</dd>
        </div>
        <div v-if="venta.cambio != null" class="flex justify-between">
          <dt>Cambio</dt>
          <dd>{{ formatCurrency(venta.cambio) }}</dd>
        </div>
      </dl>

      <div
        class="mt-5 border-t border-dashed border-gray-300 pt-4 text-center text-xs text-gray-500"
      >
        {{ empresa?.mensajeTicket ?? 'Gracias por su compra.' }}
      </div>
    </div>

    <p class="mt-5 text-xs text-gray-500">
      Para el rollo térmico de 58 mm, usa papel de 58 mm, márgenes «Ninguno» y escala 100 %.
    </p>

    <div class="mt-3 flex justify-stretch sm:justify-end">
      <BaseButton class="w-full sm:w-auto" @click="printTicket">
        <PrinterIcon class="h-5 w-5" />
        Imprimir ticket
      </BaseButton>
    </div>
  </div>
</template>

<style>
#ticket-print-sheet {
  display: none;
}

@page {
  size: auto;
  margin: 0;
}

@media print {
  html,
  body.printing-ticket {
    width: 58mm !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #fff !important;
  }

  body.printing-ticket > *:not(#ticket-print-sheet) {
    display: none !important;
  }

  body.printing-ticket #ticket-print-sheet {
    display: block !important;
    box-sizing: border-box;
    width: 48mm !important;
    max-width: 48mm !important;
    margin: 0 5mm !important;
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
  }

  /* Centra 48 mm dentro del ancho real de 58 mm del rollo. */
  body.printing-ticket #ticket-print-sheet {
    margin: 0 auto !important;
    zoom: 80% !important;
    transform: translateX(-2mm);
  }

  /* La primera marca impresa se coloca antes del nombre del negocio. */
  #ticket-print-sheet::before {
    content: '';
    display: block;
    border-top: 1px dashed #000;
    margin-bottom: 3mm;
  }

  #ticket-print-sheet * {
    color: #000 !important;
    background: transparent !important;
    border-color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  #ticket-print-sheet > .text-center > div:first-child {
    display: none !important;
  }

  #ticket-print-sheet .flex {
    gap: 1mm !important;
    flex-wrap: wrap;
  }

  #ticket-print-sheet .flex > * {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  #ticket-print-sheet .flex > :last-child {
    max-width: 100%;
    margin-left: auto;
    text-align: right;
  }

  #ticket-print-sheet .space-y-3 .flex > :first-child {
    flex: 1 1 auto;
  }

  #ticket-print-sheet .space-y-3 .flex > :last-child {
    flex: 0 0 auto;
  }

  #ticket-print-sheet .text-base,
  #ticket-print-sheet .text-lg {
    font-size: 11pt !important;
  }

  #ticket-print-sheet .ticket-business-name {
    margin: 0 0 1mm !important;
    font-size: 11pt !important;
    font-weight: 700 !important;
    line-height: 1.3 !important;
    text-align: center !important;
  }

  #ticket-print-sheet .text-xs {
    font-size: 9.5pt !important;
  }

  #ticket-print-sheet > .my-5 {
    margin: 3mm 0 !important;
    padding: 2mm 0 !important;
  }

  #ticket-print-sheet > .my-5 .mt-2 {
    margin-top: 1mm !important;
  }

  #ticket-print-sheet > .space-y-3 > div + div {
    margin-top: 2mm !important;
  }

  #ticket-print-sheet > .space-y-3 .mt-1 {
    margin-top: 0.5mm !important;
  }

  #ticket-print-sheet > dl,
  #ticket-print-sheet > div:last-child {
    margin-top: 3mm !important;
    padding-top: 2mm !important;
  }

  #ticket-print-sheet .space-y-3 > div {
    break-inside: avoid;
  }

  #ticket-print-sheet > .text-center,
  #ticket-print-sheet dl,
  #ticket-print-sheet > div:last-child {
    break-inside: avoid;
  }
}
</style>
