<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import HelpTooltip from '@/components/ui/HelpTooltip.vue'
import SearchBar from '@/components/common/SearchBar.vue'

type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'

export interface VarianteMovimientoOption {
  value: string
  label: string
  stock: number
  clave?: string
  codigoBarras?: string
}

interface Props {
  tipo: TipoMovimiento
  variantes: VarianteMovimientoOption[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), { loading: false })

export interface MovimientoFormData {
  varianteId: string
  cantidad: number
  motivo: string
}

const emit = defineEmits<{
  submit: [data: MovimientoFormData]
  cancel: []
  search: [value: string]
}>()

const search = ref('')
const buscador = ref<{ focus: () => void } | null>(null)
const selectedVariant = ref<VarianteMovimientoOption | null>(null)
const formError = ref('')
const form = reactive<MovimientoFormData>({
  varianteId: '',
  cantidad: 1,
  motivo: '',
})

const coincidencias = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es')
  if (!term || selectedVariant.value) return []
  return props.variantes.filter((item) =>
    [item.label, item.clave ?? '', item.codigoBarras ?? '']
      .some((value) => value.toLocaleLowerCase('es').includes(term)),
  ).slice(0, 20)
})

function buscarArticulo(value: string) {
  search.value = value
  form.varianteId = ''
  selectedVariant.value = null
  formError.value = ''
  emit('search', value)
}

function cambiarVariante() {
  buscarArticulo('')
  void nextTick(() => buscador.value?.focus())
}

function elegirArticulo(item: VarianteMovimientoOption) {
  selectedVariant.value = item
  form.varianteId = item.value
  search.value = item.label
  formError.value = ''
  // Nunca iniciar un ajuste con 1 unidad por accidente.
  // Primero cargar la existencia actual para que el usuario indique el conteo real.
  if (props.tipo === 'ajuste') form.cantidad = item.stock
}

const preview = computed(() => {
  if (!selectedVariant.value || String(form.cantidad).trim() === '') return null
  const unidades = Number(form.cantidad)
  if (!Number.isInteger(unidades) || unidades < 0) return null
  const anterior = selectedVariant.value.stock
  const posterior = props.tipo === 'entrada'
    ? anterior + unidades
    : props.tipo === 'salida'
      ? anterior - unidades
      : unidades
  return { anterior, posterior, cambio: posterior - anterior }
})

watch(() => form.cantidad, () => { formError.value = '' })

function submitForm() {
  if (props.loading) return
  formError.value = ''
  if (!selectedVariant.value || !form.varianteId) {
    formError.value = 'Debes hacer clic en una variante de la lista para seleccionarla.'
    return
  }
  if (String(form.cantidad).trim() === '') {
    formError.value = 'Indica la cantidad de unidades.'
    return
  }
  const cantidad = Number(form.cantidad)
  if (!Number.isInteger(cantidad) || cantidad < (props.tipo === 'ajuste' ? 0 : 1)) {
    formError.value = props.tipo === 'ajuste'
      ? 'La existencia real debe ser un entero igual o mayor a cero.'
      : 'La cantidad debe ser un entero mayor a cero.'
    return
  }
  if (props.tipo !== 'ajuste' && cantidad > 10000) {
    formError.value = 'Cada entrada o salida admite como máximo 10,000 unidades.'
    return
  }
  if (props.tipo === 'salida' && cantidad > selectedVariant.value.stock) {
    formError.value = 'No puedes retirar más unidades de las disponibles.'
    return
  }
  if (props.tipo === 'ajuste') {
    const diferencia = cantidad - selectedVariant.value.stock
    if (diferencia === 0) {
      formError.value = 'La existencia real coincide con la actual. No hay nada que ajustar.'
      return
    }
    if (Math.abs(diferencia) > 10000) {
      formError.value = 'La diferencia del ajuste no puede superar 10,000 unidades.'
      return
    }
  }
  emit('submit', {
    varianteId: form.varianteId,
    cantidad,
    motivo: form.motivo.trim(),
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submitForm">

    <div class="space-y-2">
      <label class="block text-sm font-semibold text-gray-800" for="buscar-variante-inventario">
        Busca el artículo <span class="text-red-500">*</span>
      </label>
      <SearchBar
        ref="buscador"
        id="buscar-variante-inventario"
        v-model="search"
        autofocus
        placeholder="Escribe artículo, clave o código de barras..."
        @update:model-value="buscarArticulo"
      />
      <p v-if="!selectedVariant" class="text-xs text-gray-600">
        Escribe y haz clic en la variante correcta.
      </p>

      <!-- Altura reservada: los resultados no desplazan el formulario al escribir. -->
      <div
        class="h-44 overflow-y-auto overscroll-contain rounded-xl border border-[#E5E7EB] bg-white p-2 sm:h-52"
        role="region"
        aria-label="Selector de variantes del inventario"
      >
        <div v-if="selectedVariant" class="rounded-lg bg-gray-50 p-3">
          <p class="text-xs font-semibold uppercase text-gray-700">Variante elegida</p>
          <p class="mt-1 font-semibold text-gray-900">{{ selectedVariant.label }}</p>
          <p class="mt-1 text-sm text-gray-700">Existencia: {{ selectedVariant.stock }} piezas</p>
          <button
            type="button"
            class="mt-3 rounded-lg border border-[#C56B86] px-3 py-2 text-sm font-semibold text-[#C56B86] focus-visible:outline focus-visible:outline-2 hover:bg-[#FBEFF3]"
            @click="cambiarVariante"
          >Cambiar variante</button>
        </div>
        <p v-else-if="!search.trim()" class="p-3 text-sm text-gray-600">
          Escribe el nombre o la clave del artículo.
        </p>
        <div v-else role="listbox" aria-label="Coincidencias de variantes">
          <button
            v-for="item in coincidencias"
            :key="item.value"
            type="button"
            role="option"
            :aria-selected="false"
            class="inventario-opcion block w-full rounded-lg px-3 py-3 text-left text-sm text-gray-900 transition hover:bg-[#FBEFF3] focus-visible:bg-[#FBEFF3] focus-visible:outline-none"
            @click="elegirArticulo(item)"
          >
            <span class="block font-semibold">{{ item.label }}</span>
            <span class="block text-xs text-gray-700">
              Existencia: {{ item.stock }}
              <template v-if="item.clave"> · Clave del artículo: {{ item.clave }}</template>
              <template v-if="item.codigoBarras"> · Código de barras: {{ item.codigoBarras }}</template>
            </span>
          </button>
          <p v-if="!coincidencias.length" class="p-3 text-sm text-gray-600">
            No se encontraron artículos.
          </p>
        </div>
      </div>
    </div>

    <BaseInput
      v-if="tipo !== 'ajuste'"
      v-model="form.cantidad"
      type="number"
      :label="tipo === 'entrada' ? 'Unidades que ingresan' : 'Unidades que salen'"
      :min="1"
      :max="10000"
      :step="1"
      required
    />
    <BaseInput v-else v-model="form.cantidad" type="number" :min="0" :step="1" required>
      <template #label>
        <span>Existencia real (piezas contadas)</span>
        <span class="text-red-500">*</span>
        <HelpTooltip
          text="Anota todas las piezas que contaste, no la diferencia."
        />
      </template>
    </BaseInput>

    <div v-if="preview" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" aria-live="polite">
      <span class="text-gray-700">Existencia:</span>
      <strong class="text-gray-900">{{ preview.anterior }} → {{ preview.posterior }} piezas</strong>
    </div>

    <div>
      <label for="motivo-movimiento" class="mb-2 block text-sm font-medium text-gray-700">
        Motivo (opcional)
      </label>
      <textarea
        id="motivo-movimiento"
        v-model="form.motivo"
        rows="2"
        placeholder="Ej. Llegó mercancía o conteo"
        class="w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15"
      />
    </div>

    <p v-if="formError" role="alert" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ formError }}
    </p>

    <div class="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
      <BaseButton variant="secondary" :disabled="loading" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="loading">{{ tipo === 'ajuste' ? 'Guardar existencia real' : 'Registrar movimiento' }}</BaseButton>
    </div>
  </form>
</template>
