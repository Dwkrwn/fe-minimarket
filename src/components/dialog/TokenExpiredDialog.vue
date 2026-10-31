<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, type SessionUser } from '@/stores/auth'
import { login, getCurrentUser } from '@/lib/api'
import { toast } from 'vue-sonner'
import { useApi } from '@/composables/useApi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import FieldX from '@/components/field/FieldX.vue'
import { AlertTriangle, Loader2 } from 'lucide-vue-next'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'

const { API_BASE_URL } = useApi()

interface Props {
  open: boolean
}

const props = defineProps<Props>()

// Watch untuk debugging
watch(() => props.open, (newVal) => {
}, { immediate: true })

const emit = defineEmits<{
  'update:open': [value: boolean]
  'token-renewed': []
}>()

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const usernameError = ref<'failed' | ''>('')
const passwordError = ref<'failed' | ''>('')
const showWarningDialog = ref(false)

// Simpan current respo sebelum expired untuk restore setelah re-login
let savedRespoId: string | null = null

// Watch ketika dialog dibuka
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Simpan current respo ID sebelum clear
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        savedRespoId = parsed.respoId || null
      }
    } catch (e) {
      savedRespoId = null
    }
  }
}, { immediate: true })

const handleOpenChange = (value: boolean) => {
  // Jangan boleh menutup dialog dengan X button atau esc jika dalam loading
  if (!value && isLoading.value) {
    return
  }
  
  if (!value) {
    // Jika menutup dialog, redirect ke login
    redirectToLogin()
  }
}

const handleLogin = async () => {
  // Validasi
  usernameError.value = ''
  passwordError.value = ''

  if (!username.value.trim()) {
    usernameError.value = 'failed'
    toast.error('Validasi Gagal', {
      description: 'Username harus diisi'
    })
    return
  }

  if (!password.value) {
    passwordError.value = 'failed'
    toast.error('Validasi Gagal', {
      description: 'Password harus diisi'
    })
    return
  }

  isLoading.value = true

  try {
    // Step 1: Call API login
    const response = await login({
      username: username.value,
      password: password.value
    })

    if (response.status === 'success' && response.token) {
      // Login response may only contain basic user info, so fall back to /auth/me.
      let userData = response.data.user as SessionUser
      if (!userData?.role) {
        userData = await getCurrentUser(response.token)
      }
      // Non-super-admin wajib punya role aktif
      const isSuperAdmin = userData.role?.system_key === 'SUPER_ADMIN'
      if (!isSuperAdmin && !userData.role?.id) {
        showWarningDialog.value = true
        return
      }
      authStore.login(response.token, userData)
      // Step 7: Show success message
      toast.success('Session Diperbaharui!', {
        description: `Selamat datang kembali, ${userData.name}`
      })

      // Step 8: Emit token renewed event
      emit('token-renewed')
      
      // Step 9: Close dialog
      emit('update:open', false)
      
      // Step 10: Refresh halaman untuk load ulang semua data
      // Tunggu sebentar supaya dialog close animation selesai dan toast message terlihat
      setTimeout(() => {
        window.location.reload()
      }, 500)
      
    } else {
      toast.error('Login Gagal', {
        description: 'Terjadi kesalahan, silakan coba lagi'
      })
    }
  } catch (err) {
    toast.error('Login Gagal', {
      description: err instanceof Error ? err.message : 'Username atau password salah'
    })
  } finally {
    isLoading.value = false
  }
}

const handleWarningConfirm = () => {
  // Clear form and close warning dialog
  username.value = ''
  password.value = ''
  showWarningDialog.value = false
  
  // Redirect ke halaman login
  redirectToLogin()
}

const redirectToLogin = () => {
  authStore.logout()
  emit('update:open', false)
  router.push({ name: 'Login' })
}
</script>

<template>
  <Dialog :open="open" :modal="true" @update:open="handleOpenChange">
    <DialogContent 
      class="max-w-md p-0 gap-0 overflow-hidden" 
      :class="{ 'pointer-events-auto': open }"
    >
      <!-- Header dengan background gradient -->
      <div class="bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-6 pb-4">
        <DialogHeader class="space-y-0">
          <div class="flex items-start gap-4">
            <div class="shrink-0">
              <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <AlertTriangle class="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div class="flex-1 space-y-1">
              <DialogTitle class="text-xl font-bold text-foreground">
                Sesi Telah Berakhir
              </DialogTitle>
              <DialogDescription class="text-sm text-muted-foreground">
                Mohon maaf, sesi login Anda telah berakhir
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </div>

      <!-- Body dengan form -->
      <div class="p-6 space-y-6">
        <p class="text-sm text-muted-foreground leading-relaxed">
          Untuk melanjutkan mengakses dashboard, silakan login kembali dengan memasukkan username dan password Anda.
        </p>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Username Field -->
          <div class="space-y-2">
            <FieldX
              v-model="username"
              label="Username"
              type="text"
              placeholder="Masukkan username Anda"
              :disabled="isLoading"
              :errorname="usernameError"
              :hints="usernameError ? 'Username tidak boleh kosong' : undefined"
              @input="(val) => { username = val; usernameError = '' }"
            />
          </div>

          <!-- Password Field -->
          <div class="space-y-2">
            <FieldX
              v-model="password"
              label="Password"
              type="password"
              placeholder="Masukkan password Anda"
              :disabled="isLoading"
              :errorname="passwordError"
              :hints="passwordError ? 'Password tidak boleh kosong' : undefined"
              @input="(val) => { password = val; passwordError = '' }"
            />
          </div>

          <!-- Buttons -->
          <div class="grid grid-cols-2 gap-3 pt-4">
            <Button 
              type="button"
              variant="outline"
              @click="redirectToLogin"
              :disabled="isLoading"
              class="w-full"
            >
              Kembali ke Login
            </Button>
            <Button 
              type="submit"
              :disabled="isLoading"
              class="w-full bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
              <span>{{ isLoading ? 'Memproses...' : 'Login' }}</span>
            </Button>
          </div>
        </form>
      </div>

    </DialogContent>
  </Dialog>

  <!-- Warning Dialog - User tidak punya role -->
  <GlobalDialog
    :open="showWarningDialog"
    type="warning"
    title="Akses Ditolak"
    description="User yang Anda pilih belum dikonfigurasi untuk ROLE. Silakan hubungi administrator anda untuk mengatur role terlebih dahulu."
    confirmText="Ok"
    :show-cancel="false"
    @confirm="handleWarningConfirm"
    @update:open="(v) => !v && handleWarningConfirm()"
  />
</template>

<style scoped>
/* Smooth transitions */
:deep(.dialog-content) {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
