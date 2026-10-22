<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { CameraIcon, MicrophoneIcon, StopIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { BrowserMultiFormatReader } from '@zxing/browser'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import CategoriaBuscable from './CategoriaBuscable.vue'

import type { Categoria } from '@/types/categoria'
import type { Articulo, ArticuloFormValues } from '@/api/articulos'

interface Props {
  articulo?: Articulo | null
  categorias: Categoria[]
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  articulo: null,
  saving: false,
})

const emit = defineEmits<{
  submit: [values: ArticuloFormValues]
  cancel: []
}>()

type CampoNumero = string | number
const form = reactive<{
  nombre: string
  categoriaId: string
  sku: string
  codigoBarras: string
  costo: CampoNumero
  precioVenta: CampoNumero
  precioMayoreo: CampoNumero
  stockInicial: CampoNumero
  stockMinimo: CampoNumero
}>({
  nombre: props.articulo?.nombre ?? '',
  categoriaId: props.articulo?.categoriaId ?? '',
  sku: props.articulo?.sku ?? '',
  codigoBarras: props.articulo?.codigoBarras ?? '',
  costo: props.articulo?.costo ?? 0,
  precioVenta: props.articulo?.precioVenta ?? '',
  precioMayoreo: props.articulo?.precioMayoreo ?? 0,
  stockInicial: 0,
  stockMinimo: props.articulo?.stockMinimo ?? 0,
})

const formError = ref('')
const categoriaOptions = computed(() => [
  { label: 'Sin clasificar (opcional)', value: '' },
  ...props.categorias
    .filter((cat) => cat.activo || cat.id === props.articulo?.categoriaId)
    .filter((cat) => cat.nombre.trim().toUpperCase() !== 'SIN CLASIFICAR')
    .map((cat) => ({
      label: cat.activo ? cat.nombre : `${cat.nombre} (inactiva)`,
      value: cat.id,
    })),
])

// La categoría "SIN CLASIFICAR" se representa con '' en el select:
// al guardar se envía null solo si el empleado cambió la categoría.
const categoriaActualSinClasificar = computed(
  () => props.articulo?.categoriaNombre.trim().toUpperCase() === 'SIN CLASIFICAR',
)
if (categoriaActualSinClasificar.value) form.categoriaId = ''

function valorNumerico(value: CampoNumero): number {
  return value === '' ? 0 : Number(value)
}
const costoNumero = computed(() => valorNumerico(form.costo))
const ventaNumero = computed(() => valorNumerico(form.precioVenta))
const mayoreoNumero = computed(() => valorNumerico(form.precioMayoreo))
const avisoMenudeo = computed(
  () => costoNumero.value > 0 && ventaNumero.value > 0 && ventaNumero.value < costoNumero.value,
)
const avisoMayoreo = computed(
  () => costoNumero.value > 0 && mayoreoNumero.value > 0 && mayoreoNumero.value < costoNumero.value,
)
const ventaHistoricaCero = computed(
  () => Boolean(props.articulo && props.articulo.precioVenta === 0 && ventaNumero.value === 0),
)

function monedaValida(value: CampoNumero, opcional: boolean): boolean {
  if (value === '' && opcional) return true
  return /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) <= 99999999.99
}

// Escáner conservado del formulario de variantes anterior.
const scannerOpen = ref(false)
const scannerError = ref('')
const scannerMessage = ref('')
const videoElement = ref<HTMLVideoElement | null>(null)
const barcodeReader = new BrowserMultiFormatReader(undefined, {
  delayBetweenScanAttempts: 100,
})
let scannerControls: { stop: () => void } | null = null
let scannerSession = 0

function stopScanner() {
  scannerSession += 1
  scannerControls?.stop()
  scannerControls = null
  const video = videoElement.value
  const stream = video?.srcObject
  if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
  if (video) video.srcObject = null
  scannerOpen.value = false
}

async function startScanner() {
  if (scannerOpen.value) return
  scannerError.value = ''
  scannerMessage.value = ''
  scannerOpen.value = true
  const session = ++scannerSession
  await nextTick()
  if (!videoElement.value || session !== scannerSession) return
  try {
    const controls = await barcodeReader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      videoElement.value,
      (result) => {
        if (!result || session !== scannerSession) return
        const code = result.getText().trim()
        if (!/^\d{1,100}$/.test(code)) {
          scannerError.value = 'El código detectado debe contener solo números (máximo 100).'
          return
        }
        form.codigoBarras = code
        scannerMessage.value = 'Código capturado. Revísalo antes de guardar.'
        stopScanner()
      },
    )
    if (session !== scannerSession) {
      controls.stop()
      return
    }
    scannerControls = controls
  } catch {
    if (session === scannerSession) {
      scannerError.value = 'No se pudo abrir la cámara. Revisa permisos y usa HTTPS o localhost.'
    }
  }
}

// Se conserva dictado de nombre cuando el navegador admite SpeechRecognition.
interface VoiceResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
interface VoiceRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: VoiceResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type VoiceConstructor = new () => VoiceRecognition
const dictando = ref(false)
const mensajeDictado = ref('')
let reconocimiento: VoiceRecognition | null = null

function detenerDictado() {
  const actual = reconocimiento
  reconocimiento = null
  if (actual) {
    actual.onresult = null
    actual.onerror = null
    actual.onend = null
    actual.abort()
  }
  dictando.value = false
}

function dictarNombre() {
  if (dictando.value) {
    detenerDictado()
    return
  }
  const browser = window as unknown as {
    SpeechRecognition?: VoiceConstructor
    webkitSpeechRecognition?: VoiceConstructor
  }
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
  if (!Constructor) {
    mensajeDictado.value = 'Este navegador no admite dictado. Puedes escribir normalmente.'
    return
  }
  const actual = new Constructor()
  reconocimiento = actual
  actual.lang = 'es-MX'
  actual.continuous = false
  actual.interimResults = false
  actual.onresult = (event) => {
    if (reconocimiento !== actual) return
    const result = event.results[0]
    const texto = result?.[0]?.transcript.trim()
    if (result?.isFinal && texto) {
      form.nombre = texto
      mensajeDictado.value = 'Nombre capturado. Revísalo antes de guardar.'
    }
  }
  actual.onerror = () => {
    if (reconocimiento === actual) mensajeDictado.value = 'No se pudo completar el dictado.'
  }
  actual.onend = () => {
    if (reconocimiento === actual) {
      reconocimiento = null
      dictando.value = false
    }
  }
  try {
    dictando.value = true
    mensajeDictado.value = 'Escuchando…'
    actual.start()
  } catch {
    detenerDictado()
    mensajeDictado.value = 'No se pudo iniciar el micrófono.'
  }
}

function cancelar() {
  detenerDictado()
  stopScanner()
  emit('cancel')
}

onBeforeUnmount(() => {
  detenerDictado()
  stopScanner()
})

function submitForm() {
  if (props.saving) return
  formError.value = ''
  const nombre = form.nombre.trim()
  if (!nombre || nombre.length > 150) {
    formError.value = 'El nombre del artículo es obligatorio (máximo 150 caracteres).'
    return
  }
  if (!monedaValida(form.costo, true) || !monedaValida(form.precioMayoreo, true)) {
    formError.value = 'El precio de compra y el mayoreo deben ser importes positivos o cero, con hasta 2 decimales.'
    return
  }
  if (!ventaHistoricaCero.value && (!monedaValida(form.precioVenta, false) || ventaNumero.value <= 0)) {
    formError.value = 'El precio de venta es obligatorio y debe ser mayor que cero.'
    return
  }
  if (form.sku.trim() && !/^[A-Za-z0-9_-]{1,100}$/.test(form.sku.trim())) {
    formError.value = 'La clave del artículo solo admite letras, números, guiones y guion bajo (máximo 100).'
    return
  }
  if (form.codigoBarras.trim() && !/^\d{1,100}$/.test(form.codigoBarras.trim())) {
    formError.value = 'El código de barras debe contener solo números (máximo 100).'
    return
  }
  const stockInicial = valorNumerico(form.stockInicial)
  const stockMinimo = valorNumerico(form.stockMinimo)
  if (
    !Number.isInteger(stockInicial) || stockInicial < 0 || stockInicial > 10000 ||
    !Number.isInteger(stockMinimo) || stockMinimo < 0
  ) {
    formError.value = 'La existencia inicial y la mínima deben ser números enteros no negativos (existencia inicial máxima: 10,000).'
    return
  }
  detenerDictado()
  stopScanner()
  emit('submit', {
    nombre,
    categoriaId: form.categoriaId,
    sku: form.sku.trim(),
    codigoBarras: form.codigoBarras.trim(),
    costo: costoNumero.value,
    precioVenta: ventaNumero.value,
    precioMayoreo: mayoreoNumero.value,
    stockInicial,
    stockMinimo,
  })
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submitForm">
    <div class="space-y-2">
      <BaseInput
        v-model="form.nombre"
        label="Artículo"
        placeholder="Ej. Mascarilla Post-Tinte Percapelli"
        :disabled="saving"
        required
      />
      <button
        type="button"
        :aria-pressed="dictando"
        class="inline-flex items-center gap-2 rounded-xl border border-[#C56B86] px-3 py-2 text-sm text-[#C56B86] hover:bg-[#FBEFF3]"
        :disabled="saving"
        @click="dictarNombre"
      >
        <StopIcon v-if="dictando" class="h-4 w-4" />
        <MicrophoneIcon v-else class="h-4 w-4" />
        {{ dictando ? 'Detener dictado' : 'Dictar nombre' }}
      </button>
      <p v-if="mensajeDictado" class="text-xs text-gray-600" role="status">{{ mensajeDictado }}</p>
      <p v-if="articulo && articulo.nombreMostrar !== articulo.nombre" class="text-xs text-gray-600">
        Solo cambias esta presentación; las demás quedan igual.
      </p>
    </div>

    <CategoriaBuscable
      v-model="form.categoriaId"
      label="Categoría (opcional)"
      :options="categoriaOptions"
      :disabled="saving"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput v-model="form.sku" label="Clave del artículo (opcional)" placeholder="Ej. 7631" :disabled="saving" />

      <div class="space-y-2">
        <div class="flex items-end gap-2">
          <BaseInput
            v-model="form.codigoBarras"
            label="Código de barras (opcional)"
            placeholder="Escanea o escribe el código"
            inputmode="numeric"
            :disabled="saving"
          />
          <button
            type="button"
            class="inline-flex h-[42px] shrink-0 items-center gap-1 rounded-xl border border-[#C56B86] px-3 text-sm text-[#C56B86] hover:bg-[#FBEFF3]"
            aria-label="Escanear código de barras"
            :disabled="saving"
            @click="startScanner"
          >
            <CameraIcon class="h-5 w-5" />
            <span class="hidden sm:inline">Escanear</span>
          </button>
        </div>
        <p v-if="scannerMessage" class="text-xs text-green-700">{{ scannerMessage }}</p>
      </div>

      <BaseInput v-model="form.costo" label="Precio compra (opcional)" type="number" min="0" step="0.01" :disabled="saving" />
      <BaseInput v-model="form.precioVenta" label="Precio venta" type="number" min="0" step="0.01" :disabled="saving" required />
      <BaseInput v-model="form.precioMayoreo" label="Mayoreo (opcional)" type="number" min="0" step="0.01" :disabled="saving" />
      <BaseInput v-model="form.stockMinimo" label="Existencia mínima (opcional)" type="number" min="0" step="1" :disabled="saving" />
      <BaseInput v-if="!articulo" v-model="form.stockInicial" label="Existencia inicial (opcional)" type="number" min="0" max="10000" step="1" :disabled="saving" />
    </div>

    <div v-if="articulo" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
      <span><strong>Existencia:</strong> {{ articulo.stock }} piezas</span>
      <RouterLink to="/inventario/ajustes" class="font-semibold text-[#C56B86] underline underline-offset-2">Corregir en Inventario</RouterLink>
    </div>

    <div v-if="avisoMenudeo || avisoMayoreo" class="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700" role="status">
      <span aria-hidden="true" class="shrink-0">ⓘ</span>
      <span v-if="avisoMenudeo && avisoMayoreo">Precio venta y mayoreo por debajo de compra. Puedes guardar.</span>
      <span v-else-if="avisoMenudeo">Precio venta por debajo de compra. Puedes guardar.</span>
      <span v-else>Mayoreo por debajo de compra. Puedes guardar.</span>
    </div>
    <p v-if="ventaHistoricaCero" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Precio venta $0: asigna un precio antes de vender.
    </p>

    <p v-if="formError" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{{ formError }}</p>

    <div class="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
      <BaseButton type="button" variant="secondary" :disabled="saving" @click="cancelar">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="saving" :disabled="saving">{{ articulo ? 'Guardar cambios' : 'Guardar artículo' }}</BaseButton>
    </div>
  </form>

  <Teleport to="body">
    <div
      v-if="scannerOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Escáner de código de barras"
      @click.self="stopScanner"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div class="flex items-center justify-between gap-3">
          <p class="font-medium text-gray-900">Apunta al código de barras</p>
          <button type="button" class="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Cerrar escáner" @click="stopScanner">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
        <video ref="videoElement" autoplay muted playsinline class="mt-4 w-full rounded-xl bg-black" />
        <p v-if="scannerError" class="mt-3 text-sm text-red-600">{{ scannerError }}</p>
        <p class="mt-3 text-xs text-gray-500">La lectura es opcional; también puedes escribir el código.</p>
      </div>
    </div>
  </Teleport>
</template>
