<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import axios from 'axios'
import {
  ArrowRightIcon,
  CameraIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  ShoppingCartIcon,
} from '@heroicons/vue/24/outline'
import { BrowserMultiFormatReader } from '@zxing/browser'

import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import StatusChip from '@/components/common/StatusChip.vue'

import HistorialVentas from './components/HistorialVentas.vue'
import MetodoPago from './components/MetodoPago.vue'
import ResumenVenta from './components/ResumenVenta.vue'
import TicketPreview from './components/TicketPreview.vue'
import VentaCarrito from './components/VentaCarrito.vue'

import { getCajasActivas } from '@/api/cajas'
import { getEmpresa } from '@/api/empresa'
import { getMetodosPagoActivos } from '@/api/metodosPago'
import { getVarianteByCode, getVariantesPage } from '@/api/variantes'
import {
  cancelVenta,
  createVenta,
  getTicketVenta,
  getVenta,
  getVentasPage,
  reprintTicketVenta,
} from '@/api/ventas'
import { useAuthStore } from '@/stores/auth'
import { useCarritoStore } from '@/stores/carrito'
import { formatCurrency } from '@/utils/formatCurrency'
import { getFriendlyError } from '@/utils/apiError'
import { getDatePresetRange } from '@/composables/useDateRangeFilter'
import { showError, showSuccess } from '@/utils/notifications'

import type { Caja } from '@/types/caja'
import type { Empresa } from '@/types/empresa'
import type { MetodoPagoCatalogo } from '@/types/metodoPago'
import type { TicketEmpresa, VarianteVenta, VentaDetalle, VentaResumen } from '@/types/venta'

type PosTab = 'venta' | 'historial'

const authStore = useAuthStore()
const carrito = useCarritoStore()

const { items, descuento, subtotal, descuentoAplicado, iva, total, totalArticulos } =
  storeToRefs(carrito)

const tab = ref<PosTab>('venta')
const search = ref('')
const scannerCode = ref('')
const scannerInput = ref<HTMLInputElement | null>(null)
const scannerMessage = ref('')
const loading = ref(false)
const saving = ref(false)

const paymentOpen = ref(false)
const ticketOpen = ref(false)
const cancelOpen = ref(false)

const selectedSale = ref<VentaDetalle | null>(null)
const ticketEmpresa = ref<TicketEmpresa | null>(null)
const saleToCancel = ref<VentaResumen | null>(null)

const paymentMethodId = ref('')
const selectedCajaId = ref('')
const received = ref(0)
const paymentError = ref('')

const variantes = ref<VarianteVenta[]>([])
const ventas = ref<VentaResumen[]>([])
const variantPage = ref(1)
const variantTotalPages = ref(1)
const variantCount = ref(0)
const salesPage = ref(1)
const salesTotalPages = ref(1)
const salesCount = ref(0)
const salesDateFrom = ref(getDatePresetRange('today').from)
const salesDateTo = ref(getDatePresetRange('today').to)
let variantRequestId = 0
let salesRequestId = 0
let salesDateTimer: ReturnType<typeof setTimeout> | undefined
const metodos = ref<MetodoPagoCatalogo[]>([])
const cajas = ref<Caja[]>([])
const empresa = ref<Empresa | null>(null)



const cameraOpen = ref(false)
const cameraError = ref('')
const barcodeDetected = ref(false)
const processingBarcode = ref(false)
const isMobile = ref(false)

const videoElement = ref<HTMLVideoElement | null>(null)

// Enfocar solo si el usuario NO está escribiendo en otro control.
// No escuchamos el teclado global: así no interceptamos descuentos, búsqueda o cobro.
function focusScannerIfAvailable() {
  if (tab.value !== 'venta' || loading.value || paymentOpen.value ||
      ticketOpen.value || cancelOpen.value || cameraOpen.value) return
  const input = scannerInput.value
  if (!input) return
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== input &&
      (active.matches('input, textarea, select') || active.isContentEditable)) return
  input.focus({ preventScroll: true })
}

// Al entrar a Nueva venta, tras carga de datos y al cerrar ventanas del POS.
watch([tab, loading, paymentOpen, ticketOpen, cancelOpen, cameraOpen], async () => {
  await nextTick()
  focusScannerIfAvailable()
})

const barcodeReader = new BrowserMultiFormatReader(undefined, {
  delayBetweenScanAttempts: 100,
  delayBetweenScanSuccess: 500,
})

let cameraControls: { stop: () => void } | undefined
let currentStream: MediaStream | null = null
let lastScannedCode = ''



const openBoxes = computed(() =>
  cajas.value.filter(
    (item) => item.activa && item.ocupada && item.esMia && item.estado === 'ABIERTA',
  ),
)

const cajaOptions = computed(() =>
  openBoxes.value.map((item) => ({
    label: item.nombre,
    value: item.id,
  })),
)

const selectedPaymentMethod = computed(() =>
  metodos.value.find((item) => item.id === paymentMethodId.value),
)

const isCash = computed(() =>
  selectedPaymentMethod.value?.nombre.toLowerCase().includes('efectivo'),
)

function getUsableBoxes(boxes: Caja[]): Caja[] {
  return boxes.filter((box) => box.activa && box.ocupada && box.esMia && box.estado === 'ABIERTA')
}



const filteredVariants = computed(() => variantes.value)

function mapSaleVariant(item: Awaited<ReturnType<typeof getVariantesPage>>['items'][number]): VarianteVenta {
  return {
    id: item.id,
    producto: item.productoNombre,
    variante: item.nombre,
    sku: item.sku,
    codigoBarras: item.codigoBarras,
    stock: item.stock,
    stockMinimo: item.stockMinimo,
    precioMenudeo: item.precioMenudeo,
    precioMayoreo: item.precioMayoreo,
  }
}

async function loadVariants() {
  const currentRequest = ++variantRequestId
  try {
    const result = await getVariantesPage(variantPage.value, 20, undefined, { search: search.value })
    if (currentRequest !== variantRequestId) return
    variantes.value = result.items.map(mapSaleVariant)
    variantCount.value = result.count
    variantTotalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === variantRequestId)
      await showError(getFriendlyError(error, 'No fue posible cargar las variantes.'))
  }
}

async function loadSales() {
  const currentRequest = ++salesRequestId
  try {
    const result = await getVentasPage(salesPage.value, 10, {
      fecha_desde: salesDateFrom.value || undefined,
      fecha_hasta: salesDateTo.value || undefined,
    })
    if (currentRequest !== salesRequestId) return
    ventas.value = result.items
    salesCount.value = result.count
    salesTotalPages.value = result.totalPages
  } catch (error) {
    if (currentRequest === salesRequestId)
      await showError(getFriendlyError(error, 'No fue posible cargar las ventas.'))
  }
}

function goToVariantPage(value: number) {
  variantPage.value = value
  void loadVariants()
}

function goToSalesPage(value: number) {
  salesPage.value = value
  void loadSales()
}

function changeSalesDates(from: string, to: string) {
  salesDateFrom.value = from
  salesDateTo.value = to
  salesPage.value = 1
  if (salesDateTimer) clearTimeout(salesDateTimer)
  salesDateTimer = setTimeout(() => void loadSales(), 0)
}

watch(search, (_value, _old, onCleanup) => {
  variantPage.value = 1
  ++variantRequestId
  const timer = setTimeout(() => void loadVariants(), 300)
  onCleanup(() => clearTimeout(timer))
})

async function loadData() {
  loading.value = true
  try {
    const [paymentMethods, boxes] = await Promise.all([
      getMetodosPagoActivos(),
      getCajasActivas(),
      loadVariants(),
      loadSales(),
    ])
    metodos.value = paymentMethods
    const usableBoxes = getUsableBoxes(boxes)
    cajas.value = usableBoxes
    if (!paymentMethods.some((item) => item.id === paymentMethodId.value)) {
      paymentMethodId.value = paymentMethods[0]?.id ?? ''
    }
    const firstOpenBox = usableBoxes.find((item) => item.estado === 'ABIERTA')
    if (!usableBoxes.some((item) => item.id === selectedCajaId.value)) {
      selectedCajaId.value = firstOpenBox?.id ?? ''
    }
    try {
      empresa.value = await getEmpresa()
      carrito.ivaPorcentaje = empresa.value.iva
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        empresa.value = null
        carrito.ivaPorcentaje = 0
      } else {
        throw error
      }
    }
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible cargar la información de ventas.'))
  } finally {
    loading.value = false
  }
}

function addVariant(variante: VarianteVenta) {
  carrito.agregar(variante)
}


async function scanCode() {
  const code = scannerCode.value.trim()

  if (!code) return

  scannerMessage.value = ''

  try {
    const item = await getVarianteByCode(code)

    const variante: VarianteVenta = {
      id: item.id,
      producto: item.productoNombre,
      variante: item.nombre,
      sku: item.sku,
      codigoBarras: item.codigoBarras,
      stock: item.stock,
      stockMinimo: item.stockMinimo,
      precioMenudeo: item.precioMenudeo,
      precioMayoreo: item.precioMayoreo,
    }

    if (variante.stock <= 0) {
      scannerMessage.value = 'La variante está agotada.'
      return
    }

    carrito.agregar(variante)

    scannerCode.value = ''

    scannerMessage.value =
      `${variante.producto} - ${variante.variante} agregado al carrito.`
  } catch (error) {
    scannerMessage.value = getFriendlyError(
      error,
      'No se encontró una variante con ese código.',
    )
  }
}

// La cámara sigue usando scanCode() directamente, sin cambiar su flujo.
// Solo el formulario USB recupera el foco después de pulsar Agregar / Enter.
async function scanCodeFromForm() {
  await scanCode()
  await nextTick()
  focusScannerIfAvailable()
}

async function waitForCameraStream() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const stream = videoElement.value?.srcObject as MediaStream | null

    if (stream) {
      currentStream = stream
      return stream
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return null
}


async function setupCameraFocus(stream: MediaStream) {
  const track = stream.getVideoTracks()[0]

  if (!track) return

  try {
    const capabilities = track.getCapabilities() as unknown as {
      focusMode?: string[]
    }

    if (!capabilities.focusMode?.length) {
      return
    }

    if (capabilities.focusMode.includes('continuous')) {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'continuous',
          } as unknown as MediaTrackConstraintSet,
        ],
      })
    }
  } catch (error) {
    console.warn('No se pudo configurar el enfoque automático:', error)
  }
}



async function focusCamera() {
  cameraError.value = ''

  const stream =
    currentStream ??
    (videoElement.value?.srcObject as MediaStream | null)

  if (!stream) {
    cameraError.value = 'La cámara todavía no está disponible.'
    return
  }

  const track = stream.getVideoTracks()[0]

  if (!track) {
    cameraError.value = 'No se encontró la cámara activa.'
    return
  }

  try {
    const capabilities = track.getCapabilities() as unknown as {
      focusMode?: string[]
    }

    if (!capabilities.focusMode?.length) {

      return
    }


    if (capabilities.focusMode.includes('single-shot')) {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'single-shot',
          } as unknown as MediaTrackConstraintSet,
        ],
      })
    }


    if (capabilities.focusMode.includes('continuous')) {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'continuous',
          } as unknown as MediaTrackConstraintSet,
        ],
      })
    }
  } catch (error) {
    console.warn('No fue posible enfocar la cámara:', error)
  }
}


async function openCameraScanner() {

  if (cameraOpen.value) {
    closeCameraScanner()
    return
  }

  cameraError.value = ''
  scannerMessage.value = ''
  barcodeDetected.value = false
  processingBarcode.value = false
  lastScannedCode = ''

  cameraOpen.value = true

  await nextTick()

  if (!videoElement.value) {
    cameraError.value = 'No se pudo preparar la cámara.'
    cameraOpen.value = false
    return
  }

  try {

    cameraControls = await barcodeReader.decodeFromConstraints(
      {
        video: {
          facingMode: {
            ideal: 'environment',
          },

          width: {
            ideal: 1920,
            min: 1280,
          },

          height: {
            ideal: 1080,
            min: 720,
          },

          aspectRatio: {
            ideal: 16 / 9,
          },
        },

        audio: false,
      },

      videoElement.value,

      async (result) => {
        /*
         * No hay código detectado.
         * Mantener el marco rojo.
         */
        if (!result) {
          if (!processingBarcode.value) {
            barcodeDetected.value = false
          }

          return
        }

        const code = result.getText().trim()

        if (!code) {
          barcodeDetected.value = false
          return
        }

        barcodeDetected.value = true


        if (processingBarcode.value || code === lastScannedCode) {
          return
        }

        processingBarcode.value = true
        lastScannedCode = code


        scannerCode.value = code


        await scanCode()


        setTimeout(() => {
          closeCameraScanner()
        }, 250)
      },
    )


    const stream = await waitForCameraStream()

    if (stream) {
      currentStream = stream


      await setupCameraFocus(stream)
    }
  } catch (error) {
    console.error('Error al abrir la cámara:', error)

    cameraError.value =
      'No fue posible acceder a la cámara. Verifica que hayas permitido el acceso a la cámara.'

    barcodeDetected.value = false
    processingBarcode.value = false

    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop())
      currentStream = null
    }

    cameraControls?.stop()
    cameraControls = undefined
  }
}


function closeCameraScanner() {

  cameraControls?.stop()
  cameraControls = undefined


  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop())
    currentStream = null
  }

  const stream = videoElement.value?.srcObject as MediaStream | null

  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }

  if (videoElement.value) {
    videoElement.value.pause()
    videoElement.value.srcObject = null
  }

  cameraOpen.value = false
  barcodeDetected.value = false
  processingBarcode.value = false
  lastScannedCode = ''
}

function checkMobile() {
  isMobile.value = window.matchMedia('(max-width: 767px)').matches
}

function handleResize() {
  checkMobile()

  if (!isMobile.value && cameraOpen.value) {
    closeCameraScanner()
  }
}



function setDiscount(value: number) {
  descuento.value = Math.max(0, Number(value) || 0)
}



function openPayment() {
  paymentError.value = ''

  if (!items.value.length) return

  if (!empresa.value) {
    paymentError.value =
      'Primero registra la información del negocio en Configuración.'

    paymentOpen.value = true
    return
  }

  if (!openBoxes.value.length) {
    paymentError.value =
      'Primero abre una caja para registrar la venta.'

    paymentOpen.value = true
    return
  }

  if (!metodos.value.length) {
    paymentError.value =
      'No hay métodos de pago disponibles.'

    paymentOpen.value = true
    return
  }

  paymentMethodId.value ||= metodos.value[0]?.id ?? ''
  selectedCajaId.value ||= openBoxes.value[0]?.id ?? ''
  received.value = 0

  paymentOpen.value = true
}



async function loadTicket(
  saleId: string,
  mode: 'generate' | 'reprint' | 'detail' = 'generate',
) {
  if (mode === 'detail') {
    selectedSale.value = await getVenta(saleId)
    ticketEmpresa.value = empresa.value
    return
  }

  try {
    const result =
      mode === 'reprint'
        ? await reprintTicketVenta(saleId)
        : await getTicketVenta(saleId)

    selectedSale.value = result.venta
    ticketEmpresa.value = result.empresa ?? empresa.value
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 404 ||
        error.response?.status === 405)
    ) {
      selectedSale.value = await getVenta(saleId)
      ticketEmpresa.value = empresa.value
      return
    }

    throw error
  }
}

async function confirmPayment() {
  if (saving.value) return
  paymentError.value = ''

  if (!selectedCajaId.value) {
    paymentError.value = 'Selecciona una caja abierta.'
    return
  }

  if (!paymentMethodId.value) {
    paymentError.value = 'Selecciona un método de pago.'
    return
  }

  if (isCash.value && received.value < total.value) {
    paymentError.value =
      'El efectivo recibido es menor que el total.'
    return
  }

  saving.value = true

  try {
    const result = await createVenta({
      caja_id: selectedCajaId.value,
      metodo_pago_id: paymentMethodId.value,
      descuento: descuentoAplicado.value,
      ...(isCash.value ? { efectivo_recibido: received.value } : {}),

      productos: items.value.map((item) => ({
        variante_id: item.variante.id,
        cantidad: item.cantidad,
      })),
    })

    // La venta queda registrada aunque falle posteriormente la consulta o impresión del ticket.
    paymentOpen.value = false
    carrito.vaciar()
    await showSuccess(
      result.folio ? `${result.message} Folio: ${result.folio}` : result.message,
    )
    if (result.venta_id) {
      try {
        await loadTicket(result.venta_id)
        ticketOpen.value = true
      } catch {
        await showError(
          'Venta registrada. No se pudo preparar el ticket; podrás consultarlo en el historial.',
        )
      }
    } else {
      // El cobro fue exitoso: nunca intentar repetir el POST por un ticket sin identificador.
      await showError(
        'Venta registrada. No se pudo preparar el ticket; podrás consultarlo en el historial.',
      )
    }
    try {
      await Promise.all([loadVariants(), loadSales()])
    } catch {
      // No registrar la misma venta otra vez si solo falla la actualización del listado.
    }
  } catch (error) {
    paymentError.value = getFriendlyError(
      error,
      'No fue posible registrar la venta.',
    )
  } finally {
    saving.value = false
  }
}



async function showTicket(venta: VentaResumen) {
  loading.value = true

  try {
    await loadTicket(venta.id, 'detail')
    ticketOpen.value = true
  } catch (error) {
    await showError(
      getFriendlyError(error, 'No fue posible cargar la venta.'),
    )
  } finally {
    loading.value = false
  }
}


async function reprintTicket(venta: VentaResumen) {
  loading.value = true

  try {
    await loadTicket(venta.id, 'reprint')
    ticketOpen.value = true
  } catch (error) {
    await showError(
      getFriendlyError(error, 'No fue posible preparar el ticket.'),
    )
  } finally {
    loading.value = false
  }
}


function requestCancel(venta: VentaResumen) {
  saleToCancel.value = venta
  cancelOpen.value = true
}

async function confirmCancel() {
  if (!saleToCancel.value) return

  saving.value = true

  try {
    const message = await cancelVenta(saleToCancel.value.id)

    cancelOpen.value = false

    await showSuccess(message)

    await Promise.all([loadVariants(), loadSales()])
  } catch (error) {
    await showError(
      getFriendlyError(error, 'No fue posible cancelar la venta.'),
    )
  } finally {
    saving.value = false
    saleToCancel.value = null
  }
}

onMounted(() => {
  loadData()

  checkMobile()

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  closeCameraScanner()
  if (salesDateTimer) clearTimeout(salesDateTimer)

  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <section>
    <AppBreadcrumb :items="[{ label: 'Ventas' }]" />

    <div class="mt-4 mb-8">
      <h1 class="text-2xl font-semibold text-gray-900">
        Ventas / POS
      </h1>

      <p class="mt-1 text-sm text-gray-500">
        Busca variantes, administra el carrito y registra ventas.
      </p>
    </div>

    <div class="mb-6 inline-flex rounded-xl bg-gray-100 p-1">
      <button
        type="button"
        :class="[
          'rounded-lg px-4 py-2 text-sm font-medium transition',
          tab === 'venta'
            ? 'bg-white text-[#C56B86] shadow-sm'
            : 'text-gray-500',
        ]"
        @click="tab = 'venta'"
      >
        Nueva venta
      </button>

      <button
        type="button"
        :class="[
          'rounded-lg px-4 py-2 text-sm font-medium transition',
          tab === 'historial'
            ? 'bg-white text-[#C56B86] shadow-sm'
            : 'text-gray-500',
        ]"
        @click="tab = 'historial'"
      >
        Historial
      </button>
    </div>

    <BaseLoader
      v-if="loading"
      text="Cargando ventas..."
    />

    <div
      v-else-if="tab === 'venta'"
      class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]"
    >
      <div class="space-y-5">

        <div class="rounded-2xl border border-[#ECECEC] bg-white p-5">

          <div class="flex items-center gap-2">
            <QrCodeIcon class="h-5 w-5 text-[#C56B86]" />

            <h2 class="font-semibold text-gray-900">
              Código de barras
            </h2>
          </div>

          <form
            class="mt-4 flex flex-col gap-3 sm:flex-row"
            @submit.prevent="scanCodeFromForm"
          >
            <div class="flex min-w-0 flex-1 gap-2">

              <input
                ref="scannerInput"
                v-model="scannerCode"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                placeholder="Escanea o escribe el código..."
                class="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#C56B86] focus:ring-2 focus:ring-[#C56B86]/15"
              />


              <button
                v-if="isMobile"
                type="button"
                class="flex h-[44px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition active:scale-95 hover:bg-gray-50 hover:text-[#C56B86]"
                :class="
                  cameraOpen
                    ? 'border-[#C56B86] bg-[#C56B86]/10 text-[#C56B86]'
                    : ''
                "
                aria-label="Abrir o cerrar cámara"
                @click="openCameraScanner"
              >
                <CameraIcon class="h-6 w-6" />
              </button>

            </div>

            <BaseButton type="submit">
              <ArrowRightIcon class="h-4 w-4" />
              Agregar
            </BaseButton>
          </form>



          <div
            v-if="cameraOpen"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            @click.self="closeCameraScanner"
          >

            <div
              class="w-full max-w-lg overflow-hidden rounded-2xl bg-black shadow-2xl"
            >


              <div
                class="relative cursor-pointer overflow-hidden"
                @click="focusCamera"
              >

                <video
                  ref="videoElement"
                  autoplay
                  muted
                  playsinline
                  class="aspect-video w-full bg-black object-cover"
                />

                <div
                  class="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <div
                    :class="[
                      'h-24 w-[78%] rounded-xl border-4 transition-all duration-150',
                      barcodeDetected
                        ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.65)]'
                        : 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.55)]',
                    ]"
                  />
                </div>


                <div
                  :class="[
                    'pointer-events-none absolute left-3 top-3 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-lg',
                    barcodeDetected
                      ? 'bg-green-600/90'
                      : 'bg-red-600/90',
                  ]"
                >
                  {{
                    barcodeDetected
                      ? '✓ Código detectado'
                      : 'Buscando código...'
                  }}
                </div>


                <div
                  class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-black/65 px-3 py-2 text-xs font-medium text-white backdrop-blur"
                >
                  Toca la cámara para enfocar
                </div>

              </div>


              <div class="px-4 py-4 text-center">

                <p class="text-sm font-medium text-white">
                  Apunta la cámara al código de barras
                </p>

                <p
                  v-if="!barcodeDetected"
                  class="mt-1 text-xs text-gray-300"
                >
                  Coloca el código dentro del recuadro rojo
                </p>

                <p
                  v-if="barcodeDetected"
                  class="mt-1 text-xs font-medium text-green-300"
                >
                  Código detectado, agregando al carrito...
                </p>

                <p
                  v-if="cameraError"
                  class="mt-2 text-xs text-red-300"
                >
                  {{ cameraError }}
                </p>

              </div>

            </div>
          </div>

          <p
            v-if="scannerMessage"
            class="mt-3 text-sm text-gray-500"
          >
            {{ scannerMessage }}
          </p>

        </div>


        <div class="rounded-2xl border border-[#ECECEC] bg-white p-5">

          <div class="flex items-center gap-2">
            <MagnifyingGlassIcon
              class="h-5 w-5 text-[#C56B86]"
            />

            <h2 class="font-semibold text-gray-900">
              Buscar variantes
            </h2>
          </div>

          <div class="mt-4">
            <SearchBar
              v-model="search"
              placeholder="Buscar por producto, variante, SKU o código..."
            />
          </div>

          <div class="mt-5 overflow-x-auto">
            <table
              class="mobile-stack-table w-full min-w-[720px] text-left text-sm"
            >

              <thead
                class="border-y border-gray-200 bg-gray-50"
              >
                <tr
                  class="text-xs font-semibold uppercase text-gray-500"
                >
                  <th class="px-4 py-3">
                    Producto
                  </th>

                  <th class="px-4 py-3">
                    Variante
                  </th>

                  <th class="px-4 py-3">
                    SKU
                  </th>

                  <th class="px-4 py-3">
                    Precio
                  </th>

                  <th class="px-4 py-3">
                    Stock
                  </th>

                  <th class="px-4 py-3 text-right">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-gray-100">

                <tr
                  v-for="variante in filteredVariants"
                  :key="variante.id"
                  class="interactive-lift-row"
                >

                  <td
                    data-label="Producto"
                    class="px-4 py-4 font-medium text-gray-900"
                  >
                    {{ variante.producto }}
                  </td>

                  <td
                    data-label="Variante"
                    class="px-4 py-4 text-gray-600"
                  >
                    {{ variante.variante }}
                  </td>

                  <td
                    data-label="SKU"
                    class="px-4 py-4 text-gray-600"
                  >
                    {{ variante.sku }}
                  </td>

                  <td
                    data-label="Precio"
                    class="px-4 py-4 font-semibold text-gray-900"
                  >
                    {{ formatCurrency(variante.precioMenudeo) }}
                  </td>

                  <td
                    data-label="Stock"
                    class="px-4 py-4"
                  >
                    <StatusChip
                      :status="
                        variante.stock <= 0
                          ? 'danger'
                          : variante.stock <= variante.stockMinimo
                            ? 'warning'
                            : 'success'
                      "
                      :label="
                        variante.stock <= 0
                          ? 'Agotado'
                          : `${variante.stock} disponibles`
                      "
                    />
                  </td>

                  <td
                    data-label="Acciones"
                    class="px-4 py-4 text-right"
                  >
                    <BaseButton
                      variant="secondary"
                      :disabled="variante.stock <= 0"
                      @click="addVariant(variante)"
                    >
                      Agregar
                    </BaseButton>
                  </td>

                </tr>

                <tr v-if="!filteredVariants.length">
                  <td
                    colspan="6"
                    class="px-6 py-10 text-center text-gray-500"
                  >
                    No se encontraron variantes.
                  </td>
                </tr>

              </tbody>

            </table>
          </div>
          <div v-if="variantCount > 20" class="mt-4">
            <BasePagination :page="variantPage" :total-pages="variantTotalPages" @change="goToVariantPage" />
          </div>

        </div>
      </div>


      <aside class="space-y-5">

        <VentaCarrito
          :items="items"
          @increment="carrito.incrementar"
          @decrement="carrito.disminuir"
          @remove="carrito.eliminar"
          @clear="carrito.vaciar"
        />

        <ResumenVenta
          :descuento="descuento"
          :subtotal="subtotal"
          :descuento-aplicado="descuentoAplicado"
          :iva="iva"
          :total="total"
          :total-articulos="totalArticulos"
          @update:descuento="setDiscount"
        >

          <BaseButton
            class="mt-5 w-full"
            :disabled="!items.length"
            @click="openPayment"
          >
            <ShoppingCartIcon class="h-5 w-5" />

            Cobrar {{ formatCurrency(total) }}
          </BaseButton>

        </ResumenVenta>

      </aside>
    </div>


    <HistorialVentas
      v-else-if="!loading"
      :ventas="ventas"
      :page="salesPage"
      :total-pages="salesTotalPages"
      :count="salesCount"
      :date-from="salesDateFrom"
      :date-to="salesDateTo"
      @page="goToSalesPage"
      @dates="changeSalesDates"
      :can-cancel="authStore.isAuthenticated"
      @view="showTicket"
      @reprint="reprintTicket"
      @cancel="requestCancel"
    />


    <BaseModal
      :open="paymentOpen"
      title="Cobrar venta"
      max-width="lg"
      @close="paymentOpen = false"
    >

      <div class="space-y-5">

        <BaseSelect
          v-model="selectedCajaId"
          label="Caja"
          :options="cajaOptions"
          placeholder="Selecciona una caja abierta"
          required
        />

        <MetodoPago
          v-model="paymentMethodId"
          v-model:recibido="received"
          :metodos="metodos"
          :total="total"
        />

      </div>

      <p
        v-if="paymentError"
        class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ paymentError }}
      </p>

      <div
        class="tablet-action-stack mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center"
      >
        <BaseButton variant="secondary" @click="paymentOpen = false"> Cancelar </BaseButton>
        <BaseButton :loading="saving" @click="confirmPayment"> Confirmar venta </BaseButton>
      </div>

    </BaseModal>

    <BaseModal
      :open="ticketOpen"
      title="Ticket de venta"
      max-width="md"
      @close="ticketOpen = false"
    >

      <TicketPreview
        v-if="selectedSale"
        :venta="selectedSale"
        :empresa="ticketEmpresa ?? empresa"
      />

    </BaseModal>
    <ConfirmDialog
      :open="cancelOpen"
      title="Cancelar venta"
      :description="`¿Deseas cancelar la venta ${saleToCancel?.folio ?? ''}? El stock será reintegrado.`"
      confirm-text="Cancelar venta"
      :loading="saving"
      @confirm="confirmCancel"
      @cancel="cancelOpen = false"
    />

  </section>
</template>
