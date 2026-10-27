<script setup lang="ts">
import { PrinterIcon } from '@heroicons/vue/24/outline'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { CorteCaja } from '@/types/caja'

defineProps<{
  open: boolean
  corte: CorteCaja | null
}>()

const emit = defineEmits<{
  close: []
  print: [id: string]
}>()
</script>

<template>
  <BaseModal :open="open" title="Detalle del corte" max-width="lg" @close="emit('close')">
    <div v-if="corte" class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="font-semibold text-gray-900">{{ corte.cajaNombre || 'Caja' }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ corte.usuarioNombre || 'Empleado' }}</p>
          <p class="mt-1 text-xs text-gray-500">Apertura: {{ formatDate(corte.fechaInicio) }}</p>
          <p class="mt-1 text-xs text-gray-500">
            Cierre: {{ corte.fechaFin ? formatDate(corte.fechaFin) : 'Turno abierto' }}
          </p>
        </div>
        <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {{ corte.fechaFin ? 'Cerrado' : 'Abierto' }}
        </span>
      </div>

      <section class="rounded-xl border border-gray-200 p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500">Ventas de esta caja</p>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-3"><dt>Efectivo</dt><dd>{{ formatCurrency(corte.totalVentasEfectivo) }}</dd></div>
          <div class="flex justify-between gap-3"><dt>Tarjeta</dt><dd>{{ formatCurrency(corte.totalVentasTarjeta) }}</dd></div>
          <div class="flex justify-between gap-3"><dt>Transferencia</dt><dd>{{ formatCurrency(corte.totalVentasTransferencia) }}</dd></div>
          <div class="flex justify-between gap-3 border-t border-gray-200 pt-3 font-semibold text-gray-900">
            <dt>Total vendido <span class="block text-xs font-normal text-gray-500">Todos los pagos</span></dt>
            <dd class="text-lg">{{ formatCurrency(corte.totalVentas) }}</dd>
          </div>
        </dl>
        <div v-if="corte.totalReembolsos > 0" class="mt-2 flex justify-between gap-3 text-xs text-gray-500">
          <span>Reembolsos (todos los pagos)</span>
          <span>{{ formatCurrency(corte.totalReembolsos) }}</span>
        </div>
      </section>

      <section class="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-rose-800">Dinero en caja · Solo efectivo</p>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-3"><dt>Fondo inicial</dt><dd>{{ formatCurrency(corte.efectivoInicial) }}</dd></div>
          <div class="flex justify-between gap-3"><dt>+ Ventas en efectivo</dt><dd>{{ formatCurrency(corte.totalVentasEfectivo) }}</dd></div>
          <div class="flex justify-between gap-3"><dt>− Reembolsos en efectivo</dt><dd>{{ formatCurrency(corte.totalReembolsosEfectivo) }}</dd></div>
          <div class="flex justify-between gap-3 border-t border-rose-200 pt-3 font-semibold text-gray-900">
            <dt>Efectivo que debe haber</dt>
            <dd class="text-lg">{{ formatCurrency(corte.efectivoEsperadoActual) }}</dd>
          </div>
        </dl>
      </section>

      <div class="rounded-xl bg-gray-50 p-4 text-sm">
        <div class="flex justify-between gap-3"><span>Efectivo contado</span><strong>{{ corte.efectivoFinal === null ? 'Pendiente' : formatCurrency(corte.efectivoFinal) }}</strong></div>
        <div class="mt-3 flex justify-between gap-3 border-t border-gray-200 pt-3">
          <strong>Diferencia de efectivo</strong>
          <strong :class="corte.diferencia === null ? 'text-gray-500' : corte.diferencia < 0 ? 'text-red-600' : corte.diferencia > 0 ? 'text-amber-700' : 'text-green-700'">
            {{ corte.diferencia === null ? 'Pendiente' : `${corte.diferencia > 0 ? '+' : ''}${formatCurrency(corte.diferencia)}` }}
          </strong>
        </div>
      </div>

      <div class="flex justify-end border-t border-gray-100 pt-4">
        <BaseButton
          variant="secondary"
          :disabled="!corte.fechaFin || corte.efectivoFinal === null || corte.diferencia === null"
          @click="emit('print', corte.id)"
        >
          <PrinterIcon class="h-4 w-4" /> Generar ticket
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
