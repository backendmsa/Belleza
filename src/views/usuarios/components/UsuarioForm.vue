<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'

import { isValidEmail } from '@/utils/validators'

import type { Usuario, UsuarioFormData } from '@/types/usuario'

interface Props {
  usuario?: Usuario | null
  loading?: boolean
  allowAdminCreation?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  usuario: null,
  loading: false,
  allowAdminCreation: false,
})

const emit = defineEmits<{
  submit: [data: UsuarioFormData]
  cancel: []
}>()

const submitted = ref(false)
const showPassword = ref(false)

const form = reactive<UsuarioFormData>({
  tipo: 'EMPLEADO',
  nombre: props.usuario?.nombre ?? '',
  apellido: props.usuario?.apellido ?? '',
  usuario: props.usuario?.usuario ?? '',
  email: props.usuario?.email ?? '',
  password: '',
})

const editing = computed(() => Boolean(props.usuario))

const emailError = computed(() => {
  if (!submitted.value || !form.email.trim()) return ''
  return isValidEmail(form.email)
    ? ''
    : 'Ingresa un correo electrónico válido.'
})

function getPasswordError(value: string, required: boolean) {
  if (!value && !required) return ''
  if (value.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (!/[A-Z]/.test(value)) {
    return 'La contraseña debe contener al menos una mayúscula.'
  }
  if (!/[a-z]/.test(value)) {
    return 'La contraseña debe contener al menos una minúscula.'
  }
  if (!/\d/.test(value)) {
    return 'La contraseña debe contener al menos un número.'
  }

  const specialCharacters = `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`

  if (![...value].some((character) => specialCharacters.includes(character))) {
    return 'La contraseña debe contener al menos un carácter especial.'
  }

  return ''
}

const passwordError = computed(() => {
  if (!submitted.value) return ''
  return getPasswordError(form.password, !editing.value)
})

function submitForm() {
  submitted.value = true

  if (
    !form.nombre.trim() ||
    !form.apellido.trim() ||
    !form.usuario.trim() ||
    !form.email.trim() ||
    !isValidEmail(form.email) ||
    Boolean(getPasswordError(form.password, !editing.value))
  ) {
    return
  }

  emit('submit', {
    tipo: form.tipo,
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    usuario: form.usuario.trim().replace(/^@+/, ''),
    email: form.email.trim(),
    password: form.password,
  })
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submitForm">
    <div class="grid gap-5 sm:grid-cols-2">
      <div
        v-if="!editing && props.allowAdminCreation"
        class="sm:col-span-2"
      >
        <BaseSelect
          v-model="form.tipo"
          label="Tipo de usuario"
          :options="[
            { label: 'Empleado', value: 'EMPLEADO' },
            { label: 'Administrador', value: 'ADMIN' },
          ]"
          required
        />

        <p class="mt-1 text-xs text-gray-500">
          Los administradores pueden gestionar la configuración y las operaciones administrativas.
        </p>
      </div>

      <BaseInput
        v-model="form.nombre"
        label="Nombre"
        placeholder="Nombre"
        required
      />

      <BaseInput
        v-model="form.apellido"
        label="Apellidos"
        placeholder="Apellidos"
        required
      />

      <BaseInput
        v-model="form.usuario"
        label="Usuario"
        placeholder="Nombre de usuario"
        autocomplete="username"
        required
      />

      <BaseInput
        v-model="form.email"
        type="email"
        label="Correo electrónico"
        placeholder="correo@ejemplo.com"
        :error="emailError"
        autocomplete="email"
        required
      />

      <div class="sm:col-span-2">
        <div class="relative">
          <BaseInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            :label="editing ? 'Nueva contraseña' : 'Contraseña'"
            :placeholder="
              editing
                ? 'Dejar vacío para conservar la actual'
                : 'Mínimo 8 caracteres'
            "
            autocomplete="new-password"
            :required="!editing"
            :error="passwordError"
          />

          <button
            type="button"
            class="absolute right-3 top-9 z-10 rounded p-1 text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            :aria-label="
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            "
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <svg
              v-if="!showPassword"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.25 12s3.5-7 9.75-7 9.75 7 9.75 7-3.5 7-9.75 7-9.75-7-9.75-7Z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>

            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c6.25 0 9.75 7 9.75 7a15.8 15.8 0 0 1-3.1 3.8M6.2 6.2C3.6 8 2.25 12 2.25 12s3.5 7 9.75 7c1.1 0 2.1-.2 3-.5"
              />
            </svg>
          </button>
        </div>

        <p class="mt-1 text-xs text-gray-500">
          Usa 8 o más caracteres con mayúscula, minúscula, número y carácter especial.
        </p>
      </div>
    </div>

    <div
      class="mobile-action-row flex justify-end gap-3 border-t border-gray-100 pt-5 sm:flex-row"
    >
      <BaseButton
        type="button"
        variant="secondary"
        @click="emit('cancel')"
      >
        Cancelar
      </BaseButton>

      <BaseButton type="submit" :loading="props.loading">
        {{ editing ? 'Guardar cambios' : 'Crear usuario' }}
      </BaseButton>
    </div>
  </form>
</template>
