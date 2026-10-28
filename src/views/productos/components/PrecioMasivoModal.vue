<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { consultarVariantesDelProducto, actualizarPrecioMasivo, getArticulosPage } from '@/api/articulos'
import { formatCurrency } from '@/utils/formatCurrency'
import { getFriendlyError } from '@/utils/apiError'
import type { Articulo } from '@/api/articulos'

type FilaPrecio = { id: string; nombre: string; precioVenta: number; activo: boolean }
const props = defineProps<{ open: boolean; articulo: Articulo | null; precio: number }>()
const emit = defineEmits<{ close: []; saved: [cantidad: number] }>()
const seleccion = ref<FilaPrecio[]>([])
const resultados = ref<Articulo[]>([])
const consulta = ref('')
const pagina = ref(1)
const paginas = ref(1)
const loading = ref(false)
const searching = ref(false)
const saving = ref(false)
const etapa = ref<'elegir' | 'confirmar'>('elegir')
const error = ref('')
let secuencia = 0
const ids = computed(() => new Set(seleccion.value.map(v => v.id)))
const precioLegible = computed(() => formatCurrency(props.precio))
const cambioReal = computed(() => seleccion.value.filter(v => v.precioVenta !== props.precio).length)

watch(() => props.open, async (open) => {
  const turno = ++secuencia
  if (!open || !props.articulo) return
  seleccion.value = []
  idsDeGrupo.value = new Set<string>()
  resultados.value = []
  consulta.value = ''
  pagina.value = 1
  paginas.value = 1
  error.value = ''
  etapa.value = 'elegir'
  loading.value = true
  try {
    // Incluye variantes inactivas pertenecientes al mismo Producto interno.
    const grupo = await consultarVariantesDelProducto(props.articulo.productoId)
    if (turno !== secuencia) return
    seleccion.value = grupo.map(v => ({
      id: v.id, nombre: v.nombre, precioVenta: Number(v.precio_menudeo), activo: v.activo,
    }))
    if (!seleccion.value.some(v => v.id === props.articulo?.varianteId)) {
      throw new Error('El artículo seleccionado no aparece en el grupo. Actualiza la pantalla.')
    }
    idsDeGrupo.value = new Set(seleccion.value.map(v => v.id))
  } catch (e) {
    if (turno === secuencia) error.value = getFriendlyError(e, 'No se pudieron consultar las variantes.')
  } finally {
    if (turno === secuencia) loading.value = false
  }
})

async function buscar(p = 1) {
  const texto = consulta.value.trim()
  if (texto.length < 2) {
    error.value = 'Escribe al menos dos caracteres para buscar otros artículos.'
    return
  }
  const turno = secuencia
  searching.value = true
  error.value = ''
  try {
    const r = await getArticulosPage(p, 10, { activo: 'todos', search: texto })
    if (turno !== secuencia) return
    resultados.value = r.items
    pagina.value = p
    paginas.value = r.totalPages
  } catch (e) {
    if (turno === secuencia) error.value = getFriendlyError(e, 'Error al buscar artículos.')
  } finally {
    if (turno === secuencia) searching.value = false
  }
}

function agregar(v: Articulo) {
  if (ids.value.has(v.varianteId)) return
  if (seleccion.value.length >= 200) {
    error.value = 'Puedes cambiar como máximo 200 variantes en una operación.'
    return
  }
  seleccion.value = [...seleccion.value, {
    id: v.varianteId, nombre: v.nombreMostrar,
    precioVenta: v.precioVenta, activo: v.activo,
  }]
}

function quitar(id: string) {
  // No permitir quitar artículos del Producto base; «todas» debe ser literal.
  if (idsDeGrupo.value.has(id)) return
  seleccion.value = seleccion.value.filter(v => v.id !== id)
}
const idsDeGrupo = ref(new Set<string>())
function continuar() {
  if (loading.value || saving.value || error.value || !seleccion.value.length) return
  if (!Number.isFinite(props.precio) || props.precio <= 0) {
    error.value = 'El precio de venta debe ser mayor a cero.'
    return
  }
  etapa.value = 'confirmar'
}

async function confirmar() {
  if (saving.value || !seleccion.value.length || etapa.value !== 'confirmar') return
  saving.value = true
  error.value = ''
  try {
    const respuesta = await actualizarPrecioMasivo(seleccion.value.map(v => v.id), props.precio)
    emit('saved', respuesta.actualizadas)
  } catch (e) {
    error.value = getFriendlyError(e, 'No se pudieron aplicar los precios. Ningún cambio debe quedar parcial.')
  } finally {
    saving.value = false
  }
}

function salir() {
  if (saving.value) return
  ++secuencia
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" title="Aplicar precio a todas las variantes" max-width="lg" @close="salir">
    <div class="precio-masivo-modal min-w-0 space-y-4 text-sm text-gray-800">
      <div class="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Precio de venta nuevo</p>
        <p class="mt-1 break-words text-xl font-bold text-gray-900 sm:text-2xl">{{ precioLegible }}</p>
        <p class="mt-1 text-xs text-gray-600">Solo cambiará el precio de venta. No modifica compra, mayoreo, stock, SKU, categoría ni garantía. Otros campos sin guardar del formulario anterior no se aplican.</p>
      </div>

      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-red-700">{{ error }}</p>
      <p v-if="loading" role="status">Cargando las variantes asociadas…</p>

      <template v-else-if="etapa === 'elegir'">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold text-gray-900">Variantes seleccionadas ({{ seleccion.length }})</p>
            <span class="text-xs text-gray-500">{{ cambioReal }} con precio distinto</span>
          </div>
          <div class="max-h-48 min-w-0 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-3">
            <div v-for="v in seleccion" :key="v.id" class="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div class="min-w-0">
                <p class="break-words font-medium text-gray-900">{{ v.nombre }} <span v-if="!v.activo" class="text-xs text-gray-500">(Inactiva)</span></p>
                <p class="text-xs text-gray-500">Antes: {{ formatCurrency(v.precioVenta) }}</p>
              </div>
              <button v-if="!idsDeGrupo.has(v.id)" type="button" class="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700" @click="quitar(v.id)">Quitar</button>
              <span v-else class="shrink-0 text-xs text-gray-500">Mismo producto</span>
            </div>
          </div>
        </div>

        <div class="space-y-3 rounded-xl border border-gray-200 p-3">
          <p class="font-semibold text-gray-900">Añadir artículos registrados por separado (opcional)</p>
          <p class="text-xs text-gray-600">El catálogo nuevo guarda cada artículo como variante independiente. Busca por nombre y añade explícitamente los labiales que quieras igualar. No se agrupan por nombre automáticamente.</p>
          <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="buscar(1)">
            <input v-model="consulta" type="search" class="min-w-0 w-full flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" placeholder="Ej. LABIAL" aria-label="Buscar artículos" />
            <BaseButton type="submit" variant="secondary" class="w-full sm:w-auto" :disabled="searching">Buscar</BaseButton>
          </form>
          <p v-if="searching" class="text-xs text-gray-500">Buscando…</p>
          <div v-for="v in resultados" :key="v.varianteId" class="flex items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-0">
            <div class="min-w-0">
              <p class="break-words font-medium text-gray-900">{{ v.nombreMostrar }}</p>
              <p class="text-xs text-gray-500">{{ formatCurrency(v.precioVenta) }} · {{ v.categoriaNombre }}</p>
            </div>
            <BaseButton type="button" variant="secondary" class="shrink-0" :disabled="ids.has(v.varianteId) || seleccion.length >= 200" @click="agregar(v)">
              {{ ids.has(v.varianteId) ? 'Incluido' : 'Añadir' }}
            </BaseButton>
          </div>
          <div v-if="resultados.length" class="flex items-center justify-between gap-2 text-xs text-gray-600">
            <button type="button" :disabled="searching || pagina <= 1" @click="buscar(pagina-1)">Anterior</button>
            <span>Página {{ pagina }} de {{ paginas }}</span>
            <button type="button" :disabled="searching || pagina >= paginas" @click="buscar(pagina+1)">Siguiente</button>
          </div>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t border-gray-200 pt-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <BaseButton type="button" variant="secondary" class="w-full sm:w-auto" @click="salir">Cancelar</BaseButton>
          <BaseButton type="button" class="w-full sm:w-auto" :disabled="!seleccion.length || !!error" @click="continuar">Revisar y confirmar</BaseButton>
        </div>
      </template>

      <template v-else>
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p class="font-bold text-gray-900">¿Confirmas actualizar {{ seleccion.length }} variantes a {{ precioLegible }} cada una?</p>
          <p class="mt-2 text-gray-700">Se modificarán {{ cambioReal }} precios diferentes; las variantes que ya tienen ese importe quedarán iguales. El cambio es inmediato y queda registrado en Bitácora.</p>
          <p class="mt-2 text-xs text-gray-600">No se modifican ventas pasadas. La operación será completa o no se aplicará.</p>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t border-gray-200 pt-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <BaseButton type="button" variant="secondary" class="w-full sm:w-auto" :disabled="saving" @click="etapa = 'elegir'">Regresar</BaseButton>
          <BaseButton type="button" class="w-full sm:w-auto" :loading="saving" :disabled="saving" @click="confirmar">Sí, aplicar precio a todas</BaseButton>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

<style scoped>
/* El tema oscuro global aclara .text-gray-*, incluso dentro de alertas.
   Estas reglas garantizan contraste en el panel ámbar y el aviso rojo. */
:global(html[data-theme='dark']) .precio-masivo-modal .bg-amber-50 .text-gray-900 {
  color: #fff2d6 !important;
}
:global(html[data-theme='dark']) .precio-masivo-modal .bg-amber-50 .text-gray-700 {
  color: #f5deb1 !important;
}
:global(html[data-theme='dark']) .precio-masivo-modal .bg-amber-50 .text-gray-600 {
  color: #e2cda9 !important;
}
:global(html[data-theme='dark']) .precio-masivo-modal .bg-red-50 .text-red-700 {
  color: #fda4af !important;
}
</style>
