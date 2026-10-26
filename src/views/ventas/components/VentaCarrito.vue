<script setup lang="ts">
import { MinusIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'

import EmptyState from '@/components/common/EmptyState.vue'
import { formatCurrency } from '@/utils/formatCurrency'

import type { CarritoItem } from '@/types/venta'

interface Props {
  items: CarritoItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  increment: [varianteId: string]
  decrement: [varianteId: string]
  remove: [varianteId: string]
  clear: []
}>()
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-[#ECECEC] bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
      <div>
        <h2 class="font-semibold text-gray-900">Carrito</h2>
        <p class="mt-0.5 text-xs text-gray-500">
          {{ items.length }} {{ items.length === 1 ? 'variante' : 'variantes' }}
        </p>
      </div>

      <button
        v-if="items.length"
        type="button"
        class="text-sm font-medium text-red-500 hover:text-red-600"
        @click="emit('clear')"
      >
        Vaciar
      </button>
    </div>

    <div v-if="items.length" class="divide-y divide-gray-100">
      <article v-for="item in items" :key="item.variante.id" class="interactive-lift-card p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="truncate font-medium text-gray-900">
              {{ item.variante.producto }}
            </p>
            <p class="mt-1 truncate text-sm text-gray-500">
              {{ [item.variante.variante, item.variante.sku].filter(Boolean).join(' · ') }}
            </p>
            <p class="mt-2 text-sm font-semibold text-[#C56B86]">
              {{ formatCurrency(item.variante.precioMenudeo) }}
            </p>
          </div>

          <button
            type="button"
            class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Eliminar del carrito"
            @click="emit('remove', item.variante.id)"
          >
            <TrashIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="mt-4 flex items-center justify-between gap-4">
          <div class="inline-flex items-center rounded-xl border border-gray-200">
            <button
              type="button"
              class="p-2 text-gray-500 hover:bg-gray-50"
              aria-label="Disminuir cantidad"
              @click="emit('decrement', item.variante.id)"
            >
              <MinusIcon class="h-4 w-4" />
            </button>

            <span class="min-w-10 px-2 text-center text-sm font-medium text-gray-900">
              {{ item.cantidad }}
            </span>

            <button
              type="button"
              :disabled="item.cantidad >= item.variante.stock"
              class="p-2 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Aumentar cantidad"
              @click="emit('increment', item.variante.id)"
            >
              <PlusIcon class="h-4 w-4" />
            </button>
          </div>

          <p class="font-semibold text-gray-900">
            {{ formatCurrency(item.variante.precioMenudeo * item.cantidad) }}
          </p>
        </div>
      </article>
    </div>

    <EmptyState
      v-else
      title="El carrito está vacío"
      description="Busca una variante o escanea un código para comenzar la venta."
    />
  </div>
</template>
