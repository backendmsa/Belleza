<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bars3Icon,
  ChevronDownIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/vue/24/outline'

import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const menuOpen = ref(false)

const initial = computed(
  () => authStore.user?.nombre?.charAt(0).toUpperCase() ?? 'U',
)

const roleLabel = computed(() => {
  const rol = authStore.user?.rol

  if (rol === 0) return 'Superadministrador'
  if (rol === 1) return 'Administrador'
  if (rol === 2) return 'Empleado'

  return 'Usuario'
})

async function handleLogout() {
  menuOpen.value = false
  await authStore.signOut()
  await router.replace('/login')
}
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-16 w-full min-w-0 items-center justify-between gap-2 border-b border-[#ECECEC] bg-white px-3 sm:h-20 sm:px-5 lg:px-6"
  >
    <!-- Menú y título -->
    <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <button
        type="button"
        class="shrink-0 rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 xl:hidden"
        aria-label="Abrir menú"
        @click="uiStore.toggleSidebar"
      >
        <Bars3Icon class="h-6 w-6" />
      </button>

      <p
        class="min-w-0 truncate text-xs font-medium text-gray-700 sm:text-sm"
      >
        Sistema de punto de venta
      </p>
    </div>

    <!-- Usuario -->
    <div class="relative shrink-0">
      <button
        type="button"
        class="flex max-w-[190px] items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-gray-100 sm:max-w-[280px] sm:gap-3 sm:p-2"
        @click="menuOpen = !menuOpen"
      >
        <!-- Avatar -->
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBEFF3] text-sm font-semibold text-[#C56B86] sm:h-10 sm:w-10"
        >
          {{ initial }}
        </div>

        <!-- Nombre y rol -->
        <div class="min-w-0 text-left">
          <p
            class="truncate text-xs font-medium text-gray-800 sm:text-sm"
          >
            {{ authStore.user?.nombre ?? 'Usuario' }}
          </p>

          <p
            class="truncate text-[10px] text-gray-500 sm:text-xs"
          >
            {{ roleLabel }}
          </p>
        </div>

        <!-- Flecha -->
        <ChevronDownIcon
          class="h-4 w-4 shrink-0 text-gray-400"
        />
      </button>

      <!-- Menú desplegable -->
      <div
        v-if="menuOpen"
        class="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-56 rounded-xl border border-gray-100 bg-white p-2 shadow-lg sm:w-56"
      >
        <!-- Información del usuario -->
        <div class="border-b border-gray-100 px-3 py-2">
          <p class="truncate text-sm font-medium text-gray-800">
            {{ authStore.user?.nombre ?? 'Usuario' }}
          </p>

          <p class="truncate text-xs text-gray-500">
            {{ roleLabel }}
          </p>
        </div>

        <!-- Cerrar sesión -->
        <button
          type="button"
          class="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
          @click="handleLogout"
        >
          <ArrowRightStartOnRectangleIcon class="h-5 w-5 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </div>
  </header>
</template>
