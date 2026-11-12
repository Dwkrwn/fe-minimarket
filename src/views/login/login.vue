<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, type SessionUser } from '@/stores/auth'
import { login, getCurrentUser } from '@/lib/api'
import { toast } from 'vue-sonner'
import { useApi } from '@/composables/useApi'
const { API_BASE_URL } = useApi()
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { LogIn, Eye, EyeOff, Moon, Sun } from 'lucide-vue-next'
const LEGACY_THEME_KEY = 'bb_color_theme'
const LEGACY_THEME_NAMES = [
  'zinc', 'slate', 'stone', 'gray', 'neutral', 'red', 'rose',
  'orange', 'green', 'blue', 'yellow', 'violet',
]
const router = useRouter()
const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const isDark = ref(false)
const showWarningDialog = ref(false)
// Inisialisasi mode gelap dan bersihkan sisa pemilih warna lama
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  isDark.value = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  LEGACY_THEME_NAMES.forEach(name => document.documentElement.classList.remove(`theme-${name}`))
  localStorage.removeItem(LEGACY_THEME_KEY)
})
const toggleDarkMode = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}
const handleLogin = async () => {
  if (!username.value || !password.value) {
    toast.error('Belum lengkap', {
      description: 'Nama pengguna dan kata sandi harus diisi.'
    })
    return
  }
  loading.value = true
  try {
    // Step 1: Call API login
    const response = await login({
      username: username.value,
      password: password.value
    })
    if (response.status === 'success' && response.token) {
      // Step 2: Get complete session user (role, menus, permissions)
      // Login response may only contain basic user info, so fall back to /auth/me.
      let userData = response.data.user as SessionUser
      if (!userData?.role) {
        userData = await getCurrentUser(response.token)
      }
      // Step 3: Validate user — non-super-admin wajib punya role aktif
      const isSuperAdmin = userData.role?.system_key === 'SUPER_ADMIN'
      const hasRole = !!userData.role?.id
      if (!isSuperAdmin && !hasRole) {
        // User tidak punya role dan bukan super admin → TOLAK LOGIN
        showWarningDialog.value = true
        loading.value = false
        return
      }
      // Step 4: Simpan data session lengkap
      authStore.login(response.token, userData)
      // Step 5: Fetch approval data from new API endpoint
      try {
        const approvalResponse = await fetch(
          `${API_BASE_URL}/fn/m_approval/getUserApprovalData?id=${userData.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${response.token}`
            }
          }
        )
        const approvalData = await approvalResponse.json()
        if (approvalData.status === 'success' && approvalData.menu && approvalData.menu.length > 0) {
          // Transform approval data to ApprovalData format
          const transformedList = approvalData.menu.flatMap((menuItem: any) => {
            // Each menu item has syarat array - map each syarat to ApprovalData
            return (menuItem.syarat || []).map((syarat: any) => {
              // Extract modul and sub_modul from menu_path
              const pathParts = menuItem.menu_path?.split('/').filter((p: string) => p) || []
              const modul = pathParts[0]?.toUpperCase() || null
              const subModul = pathParts[1]?.toUpperCase() || null
              return {
                // m_approval id
                id: menuItem.approval_id || null,
                level: syarat.level,
                // min_val/max_val now from header, fallback to syarat for compat
                min_val: (menuItem.min_val ?? syarat.min_val) ?? null,
                max_val: (menuItem.max_val ?? syarat.max_val) ?? null,
                // max_disc: syarat.max_disc || null,           // moved to header
                // max_disc_value: syarat.max_disc_value || null, // reserved
                is_full: syarat.is_full || false,
                is_use_limit: menuItem.is_use_limit ?? false,
                // String properties
                // top: null, // top_id belum ada value-nya di response - not used
                tipe_approve: syarat.jenis_approval || null,
                nama_approval: menuItem.approval_name || null,
                nama_menu: menuItem.menu_name || null,
                modul: modul,
                sub_modul: subModul,
                path: menuItem.menu_path || null,
                // Sender info
                sender_id: syarat.user_default_id || approvalData.user?.id || null,
                sender_name: approvalData.user?.name || null
              }
            })
          })
          authStore.saveApprovalList(transformedList)
        } else {
          console.warn('No approval data found from API')
          authStore.saveApprovalList([])
        }
      } catch (approvalErr) {
        console.warn('Failed to fetch approval data:', approvalErr)
        // Don't block login if approval fetch fails
        authStore.saveApprovalList([])
      }
      // Step 6: Show success message
      toast.success('Berhasil masuk', {
        description: `Selamat datang, ${userData.name}.`
      })
      // Step 7: Redirect to dashboard after short delay
      setTimeout(() => {
        router.push('/')
      }, 500)
    } else {
      toast.error('Gagal masuk', {
        description: 'Terjadi kesalahan. Silakan coba lagi.'
      })
    }
  } catch (err) {
    toast.error('Gagal masuk', {
      description: err instanceof Error ? err.message : 'Nama pengguna atau kata sandi salah.'
    })
  } finally {
    loading.value = false
  }
}
const handleWarningConfirm = () => {
  // Clear auth data dari localStorage
  localStorage.removeItem('auth_bb')
  authStore.logout()
  // Reset form
  username.value = ''
  password.value = ''
  showPassword.value = false
  showWarningDialog.value = false
  // Ensure we're on login page
  router.push('/login')
}
const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>
<template>
  <div class="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
    <!-- Mode gelap/terang -->
    <div class="absolute right-4 top-4 z-50">
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :title="isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'"
        :aria-label="isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'"
        @click="toggleDarkMode"
      >
        <Sun v-if="isDark" class="h-5 w-5" />
        <Moon v-else class="h-5 w-5" />
      </button>
    </div>

    <Card class="w-full max-w-sm border-border shadow-sm">
      <CardHeader class="space-y-2 text-center">
        <div class="mx-auto mb-2 flex h-16 items-center justify-center">
          <img src="/miniMarketLogo.png" alt="Mini Market" class="h-full w-auto object-contain" />
        </div>
        <CardTitle class="text-2xl font-semibold">Mini Market</CardTitle>
        <CardDescription class="text-sm">Masuk untuk mulai bekerja.</CardDescription>
      </CardHeader>

      <form @submit.prevent="handleLogin">
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="username" class="text-sm">Nama pengguna</Label>
            <Input
              id="username"
              v-model="username"
              type="text"
              placeholder="Masukkan nama pengguna"
              :disabled="loading"
              autocomplete="username"
              class="h-11"
            />
          </div>

          <div class="space-y-2">
            <Label for="password" class="text-sm">Kata sandi</Label>
            <div class="relative">
              <Input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Masukkan kata sandi"
                :disabled="loading"
                autocomplete="current-password"
                class="h-11 pr-11"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :disabled="loading"
                :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
                @click="togglePasswordVisibility"
              >
                <Eye v-if="!showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" class="h-11 w-full text-sm font-semibold" :disabled="loading">
            <span v-if="loading" class="flex items-center gap-2">
              <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              Memuat...
            </span>
            <span v-else class="flex items-center gap-2">
              <LogIn class="h-4 w-4" />
              Masuk
            </span>
          </Button>
        </CardFooter>
      </form>
    </Card>

    <p class="mt-6 text-center text-xs text-muted-foreground">
      &copy; 2025 Mini Market. Hak cipta dilindungi.
    </p>

    <!-- Dialog: pengguna belum punya peran -->
    <GlobalDialog
      :open="showWarningDialog"
      type="warning"
      title="Akses ditolak"
      description="Akun ini belum memiliki peran yang diatur. Silakan hubungi administrator untuk mengatur peran terlebih dahulu."
      confirmText="Mengerti"
      :show-cancel="false"
      @confirm="handleWarningConfirm"
      @update:open="(v) => !v && handleWarningConfirm()"
    />
  </div>
</template>
