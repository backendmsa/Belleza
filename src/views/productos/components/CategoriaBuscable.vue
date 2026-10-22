<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

interface CategoriaOpcion {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: CategoriaOpcion[]
  disabled?: boolean
  label?: string
}>(), {
  disabled: false,
  label: 'Categoría (opcional)',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const instanceId = useId()
const menuId = `${instanceId}-categorias`
const triggerId = `${instanceId}-selector`
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

// Ignora acentos y diferencias entre mayúsculas y minúsculas.
function normalizar(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX')
}

const selected = computed(() => props.options.find((item) => item.value === props.modelValue))
const filtered = computed(() => {
  const term = normalizar(query.value.trim())
  if (!term) return props.options
  return props.options.filter((item) => normalizar(item.label).includes(term))
})
const activeOptionId = computed(() =>
  filtered.value[activeIndex.value] ? `${instanceId}-option-${activeIndex.value}` : undefined,
)

watch(query, () => { activeIndex.value = 0 }, { flush: 'sync' })
watch(() => props.disabled, (disabled) => { if (disabled) open.value = false })

async function openMenu() {
  if (props.disabled) return
  query.value = ''
  const selectedIndex = props.options.findIndex((item) => item.value === props.modelValue)
  activeIndex.value = Math.max(0, selectedIndex)
  open.value = true
  await nextTick()
  searchInput.value?.focus()
}

function toggleMenu() {
  if (props.disabled) return
  if (open.value) {
    open.value = false
  } else {
    void openMenu()
  }
}

function choose(value: string) {
  emit('update:modelValue', value)
  open.value = false
  query.value = ''
  void nextTick(() => trigger.value?.focus())
}

function onSearchKeydown(event: KeyboardEvent) {
  const max = filtered.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (max) activeIndex.value = (activeIndex.value + 1) % max
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (max) activeIndex.value = (activeIndex.value - 1 + max) % max
  } else if (event.key === 'Enter') {
    event.preventDefault() // No enviar accidentalmente el formulario de artículo.
    const item = filtered.value[activeIndex.value]
    if (item) choose(item.value)
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    event.preventDefault()
    open.value = false
    trigger.value?.focus()
  } else if (event.key === 'Tab') {
    open.value = false
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void openMenu()
  } else if (event.key === 'Escape') {
    open.value = false
  }
}

function outsidePointer(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
function escapeFromOutside(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    open.value = false
    trigger.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', outsidePointer)
  document.addEventListener('keydown', escapeFromOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outsidePointer)
  document.removeEventListener('keydown', escapeFromOutside)
})
</script>

<template>
  <div ref="root" class="relative w-full">
    <label :for="triggerId" class="mb-2 block text-sm font-semibold text-gray-900">
      {{ label }}
    </label>

    <button
      :id="triggerId"
      ref="trigger"
      type="button"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      aria-haspopup="listbox"
      class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-left text-sm outline-none transition focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15 disabled:cursor-not-allowed disabled:bg-gray-100"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <span :class="['min-w-0 flex-1 truncate', selected ? 'font-semibold text-gray-900' : 'font-medium text-gray-700']">
        {{ selected?.label ?? 'Sin clasificar' }}
      </span>
      <ChevronDownIcon :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform', open ? 'rotate-180' : '']" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 z-[80] mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
    >
      <div class="border-b border-gray-100 p-2">
        <div class="relative">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" aria-hidden="true" />
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            role="combobox"
            autocomplete="off"
            aria-label="Buscar categoría"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="menuId"
            :aria-activedescendant="activeOptionId"
            placeholder="Escribe para buscar categoría..."
            class="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-gray-900 placeholder:text-gray-600 outline-none focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15"
            @keydown="onSearchKeydown"
          />
        </div>
      </div>

      <div :id="menuId" role="listbox" aria-label="Categorías disponibles" class="max-h-56 overflow-y-auto overscroll-contain p-1.5">
        <button
          v-for="(option, index) in filtered"
          :id="`${instanceId}-option-${index}`"
          :key="option.value"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          class="categoria-opcion flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
          :class="{
            'categoria-opcion--active': activeIndex === index,
            'categoria-opcion--selected': option.value === modelValue,
          }"
          @mouseenter="activeIndex = index"
          @click="choose(option.value)"
        >
          <span class="min-w-0 flex-1 break-words">{{ option.label }}</span>
          <CheckIcon v-if="option.value === modelValue" class="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
        <p v-if="!filtered.length" class="px-3 py-4 text-center text-sm font-medium text-gray-700" role="status">
          No se encontraron categorías.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Colores propios: evitan que los estilos globales del tema oculten el texto al pasar el cursor. */
.categoria-opcion { color: #111827; background-color: transparent; font-weight: 500; }
.categoria-opcion--selected { color: #881337; font-weight: 700; }
.categoria-opcion:hover,
.categoria-opcion:focus-visible,
.categoria-opcion--active { color: #6b1235; background-color: #fce7f3; }
:global(html[data-theme='dark']) .categoria-opcion { color: #f9fafb; }
:global(html[data-theme='dark']) .categoria-opcion--selected { color: #ffd2e2; }
:global(html[data-theme='dark']) .categoria-opcion:hover,
:global(html[data-theme='dark']) .categoria-opcion:focus-visible,
:global(html[data-theme='dark']) .categoria-opcion--active { color: #ffffff; background-color: #50313f; }
</style>

<!-- Contraste del menú SOLO en modo oscuro. El modo claro conserva sus estilos originales. -->
<style>
html[data-theme='dark'] .categoria-opcion {
  color: #f3f4f6 !important;
}
html[data-theme='dark'] .categoria-opcion.categoria-opcion--selected {
  color: #ffd6e5 !important;
  font-weight: 700;
}
html[data-theme='dark'] .categoria-opcion:hover,
html[data-theme='dark'] .categoria-opcion:focus-visible,
html[data-theme='dark'] .categoria-opcion.categoria-opcion--active {
  color: #ffffff !important;
  background-color: #4b2d3b !important;
}
</style>
