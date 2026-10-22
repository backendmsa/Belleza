<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDaysIcon } from '@heroicons/vue/24/outline'
import { getDatePresetRange } from '@/composables/useDateRangeFilter'

interface Props {
  from: string
  to: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:from': [value: string]
  'update:to': [value: string]
  'range-change': [from: string, to: string]
}>()

type Preset = 'today' | '7days' | '30days' | 'month' | 'all'

const presets: Array<{ label: string; value: Preset }> = [
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: '7days' },
  { label: '30 días', value: '30days' },
  { label: 'Todo', value: 'all' },
]

const activePreset = computed<Preset | null>(() => {
  if (!props.from && !props.to) return 'all'

  for (const preset of presets) {
    if (preset.value === 'all') continue

    const range = getDatePresetRange(preset.value)

    if (props.from === range.from && props.to === range.to) {
      return preset.value
    }
  }

  return null
})

// Emite el intervalo completo en una sola notificación para evitar
// que un componente padre combine una fecha nueva con otra anterior.
function applyDateRange(from: string, to: string) {
  emit('update:from', from)
  emit('update:to', to)
  emit('range-change', from, to)
}

function updateFrom(from: string) {
  emit('update:from', from)
  emit('range-change', from, props.to)
}

function updateTo(to: string) {
  emit('update:to', to)
  emit('range-change', props.from, to)
}

function applyPreset(preset: Preset) {
  if (preset === 'all') {
    applyDateRange('', '')
    return
  }

  const range = getDatePresetRange(preset)
  applyDateRange(range.from, range.to)
}
</script>

<template>
  <div class="rounded-2xl border border-[#E8D9DE] bg-white p-3 shadow-sm">
    <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div class="flex items-center gap-2 text-sm font-semibold text-gray-700 xl:pr-2">
        <span
          class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBEFF3] text-[#B65373]"
        >
          <CalendarDaysIcon class="h-5 w-5" />
        </span>
        Periodo
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in presets"
          :key="preset.value"
          type="button"
          class="rounded-xl border px-3 py-2 text-xs font-semibold transition"
          :class="
            activePreset === preset.value
              ? 'border-[#C96886] bg-[#C96886] text-white shadow-sm'
              : 'border-gray-200 bg-white text-gray-600 hover:border-[#D98AA1] hover:bg-[#FFF4F7] hover:text-[#A94D6B]'
          "
          @click="applyPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:ml-auto xl:max-w-lg">
        <label class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <span class="text-xs font-medium text-gray-500">Desde</span>
          <input
            :value="from"
            type="date"
            class="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-800 outline-none"
            @input="updateFrom(($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <span class="text-xs font-medium text-gray-500">Hasta</span>
          <input
            :value="to"
            type="date"
            class="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-800 outline-none"
            @input="updateTo(($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>
  </div>
</template>
