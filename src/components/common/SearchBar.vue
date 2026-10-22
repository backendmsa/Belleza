<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

interface Props {
  modelValue?: string
  placeholder?: string
  autofocus?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Buscar...',
  autofocus: false,
})

const inputRef = ref<HTMLInputElement | null>(null)
function focus() { inputRef.value?.focus({ preventScroll: true }) }
onMounted(async () => {
  if (!props.autofocus) return
  await nextTick()
  focus()
})
defineExpose({ focus })

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()


function handleEnter(event: KeyboardEvent) {
  if (typeof window === 'undefined') return
  if (!window.matchMedia('(pointer: coarse)').matches) return

  event.preventDefault()
  ;(event.currentTarget as HTMLInputElement).blur()
}

function updateValue(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="relative w-full">
    <MagnifyingGlassIcon
      class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400"
    />

    <input
      ref="inputRef"
      :id="id"
      :autofocus="autofocus"
      :value="modelValue"
      type="search"
      enterkeyhint="done"
      :placeholder="placeholder"
      class="search-input w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pr-4 pl-11 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15"
      @input="updateValue"
      @keydown.enter="handleEnter"
    />
  </div>
</template>
