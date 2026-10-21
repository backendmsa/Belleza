<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircleIcon, NoSymbolIcon } from '@heroicons/vue/24/outline'
import AppBreadcrumb from '@/components/layout/AppBreadcrumb.vue'
import BaseLoader from '@/components/ui/BaseLoader.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { activarMetodoPago, desactivarMetodoPago, getMetodosPago } from '@/api/metodosPago'
import { getFriendlyError } from '@/utils/apiError'
import { showError, showSuccess } from '@/utils/notifications'
import type { MetodoPagoCatalogo } from '@/types/metodoPago'

const items = ref<MetodoPagoCatalogo[]>([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const confirmOpen = ref(false)
const selected = ref<MetodoPagoCatalogo | null>(null)

const filtered = computed(() =>
  items.value.filter((item) =>
    item.nombre.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
)

async function loadData() {
  loading.value = true

  try {
    items.value = await getMetodosPago()
  } catch (error) {
    await showError(getFriendlyError(error, 'No fue posible cargar los métodos de pago.'))
  } finally {
    loading.value = false
  }
}

function requestToggle(item: MetodoPagoCatalogo) {
  selected.value = item
  confirmOpen.value = true
}

async function confirmToggle() {
  if (!selected.value || saving.value) return

  saving.value = true

  try {
    if (selected.value.activo) {
      await desactivarMetodoPago(selected.value.id)
    } else {
      await activarMetodoPago(selected.value.id)
    }

    await showSuccess(
      selected.value.activo
        ? 'Método desactivado.'
        : 'Método activado.',
    )

    confirmOpen.value = false
    await loadData()
  } catch (error) {
    await showError(
      getFriendlyError(
        error,
        'No fue posible cambiar el estado del método.',
      ),
    )
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <section class="w-full min-w-0">
    <!-- Breadcrumb -->
    <AppBreadcrumb :items="[{ label: 'Métodos de pago' }]" />

    <!-- Encabezado -->
    <div class="mt-4 mb-6 sm:mb-7">
      <h1 class="text-xl font-semibold text-gray-900 sm:text-2xl">
        Métodos de pago
      </h1>

      <p class="mt-1 max-w-2xl text-sm leading-5 text-gray-500 sm:text-base">
        Activa o desactiva los métodos disponibles para cobrar.
      </p>
    </div>

    <!-- Buscador -->
    <div class="mb-5 w-full sm:max-w-xl">
      <SearchBar
        v-model="search"
        placeholder="Buscar método..."
      />
    </div>

    <!-- Loader -->
    <BaseLoader
      v-if="loading"
      text="Cargando métodos de pago..."
    />

    <!-- Contenido -->
    <div
      v-else
      class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl"
    >
      <!-- ========================================================= -->
      <!-- TABLET Y PC -->
      <!-- ========================================================= -->
      <div class="hidden sm:block">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead class="border-b bg-gray-50 text-gray-500">
              <tr>
                <th class="px-4 py-4 font-medium md:px-5">
                  Nombre
                </th>

                <th class="px-4 py-4 font-medium md:px-5">
                  Estado
                </th>

                <th class="px-4 py-4 text-right font-medium md:px-5">
                  Acción
                </th>
              </tr>
            </thead>

            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="item in filtered"
                :key="item.id"
                class="transition-colors hover:bg-gray-50"
              >
                <!-- Nombre -->
                <td class="px-4 py-4 font-medium text-gray-900 md:px-5">
                  {{ item.nombre }}
                </td>

                <!-- Estado -->
                <td class="px-4 py-4 md:px-5">
                  <StatusChip
                    :status="item.activo ? 'success' : 'neutral'"
                    :label="item.activo ? 'Activo' : 'Inactivo'"
                  />
                </td>

                <!-- Acción -->
                <td class="px-4 py-4 text-right md:px-5">
                  <button
                    type="button"
                    :disabled="saving"
                    class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#B95C7A] transition-colors hover:bg-[#B95C7A]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    @click="requestToggle(item)"
                  >
                    <NoSymbolIcon
                      v-if="item.activo"
                      class="h-4 w-4 shrink-0"
                    />

                    <CheckCircleIcon
                      v-else
                      class="h-4 w-4 shrink-0"
                    />

                    <span>
                      {{ item.activo ? 'Desactivar' : 'Activar' }}
                    </span>
                  </button>
                </td>
              </tr>

              <!-- Sin resultados -->
              <tr v-if="!filtered.length">
                <td
                  colspan="3"
                  class="px-6 py-10 text-center text-sm text-gray-500"
                >
                  No se encontraron métodos.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- CELULAR -->
      <!-- ========================================================= -->
      <div class="divide-y divide-gray-100 sm:hidden">
        <div
          v-for="item in filtered"
          :key="item.id"
          class="p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <!-- Información -->
            <div class="min-w-0 flex-1">
              <p class="break-words text-sm font-semibold text-gray-900">
                {{ item.nombre }}
              </p>

              <div class="mt-2">
                <StatusChip
                  :status="item.activo ? 'success' : 'neutral'"
                  :label="item.activo ? 'Activo' : 'Inactivo'"
                />
              </div>
            </div>

            <!-- Botón -->
            <button
              type="button"
              :disabled="saving"
              class="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#B95C7A] transition-colors hover:bg-[#B95C7A]/10 active:bg-[#B95C7A]/20 disabled:cursor-not-allowed disabled:opacity-40"
              @click="requestToggle(item)"
            >
              <NoSymbolIcon
                v-if="item.activo"
                class="h-4 w-4 shrink-0"
              />

              <CheckCircleIcon
                v-else
                class="h-4 w-4 shrink-0"
              />

              <span>
                {{ item.activo ? 'Desactivar' : 'Activar' }}
              </span>
            </button>
          </div>
        </div>

        <!-- Sin resultados -->
        <div
          v-if="!filtered.length"
          class="px-5 py-10 text-center text-sm text-gray-500"
        >
          No se encontraron métodos.
        </div>
      </div>
    </div>

    <!-- Confirmación -->
    <ConfirmDialog
      :open="confirmOpen"
      :title="selected?.activo ? 'Desactivar método' : 'Activar método'"
      :description="`¿Deseas ${selected?.activo ? 'desactivar' : 'activar'} ${selected?.nombre ?? 'este método'}?`"
      :confirm-text="selected?.activo ? 'Desactivar' : 'Activar'"
      :loading="saving"
      @confirm="confirmToggle"
      @cancel="confirmOpen = false"
    />
  </section>
</template>
