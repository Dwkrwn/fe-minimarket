<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { login, getUserDefault } from '@/lib/api'
import { toast } from 'vue-sonner'
import { useApi } from '@/composables/useApi'

const { API_BASE_URL } = useApi()
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogIn, Eye, EyeOff, Moon, Sun, SwatchBook } from 'lucide-vue-next'

const THEME_STORAGE_KEY = 'bb_color_theme'

// Available themes with their display colors
const themes = [
  { name: 'default', label: 'Default', color: 'hsl(213, 94%, 20%)' },
  { name: 'zinc', label: 'Zinc', color: 'hsl(240, 5%, 26%)' },
  { name: 'slate', label: 'Slate', color: 'hsl(215, 20%, 25%)' },
  { name: 'stone', label: 'Stone', color: 'hsl(25, 6%, 25%)' },
  { name: 'gray', label: 'Gray', color: 'hsl(220, 9%, 26%)' },
  { name: 'neutral', label: 'Neutral', color: 'hsl(0, 0%, 23%)' },
  { name: 'red', label: 'Red', color: 'hsl(0, 72%, 51%)' },
  { name: 'rose', label: 'Rose', color: 'hsl(347, 77%, 50%)' },
  { name: 'orange', label: 'Orange', color: 'hsl(25, 95%, 53%)' },
  { name: 'green', label: 'Green', color: 'hsl(142, 71%, 45%)' },
  { name: 'blue', label: 'Blue', color: 'hsl(217, 91%, 60%)' },
  { name: 'yellow', label: 'Yellow', color: 'hsl(48, 96%, 53%)' },
  { name: 'violet', label: 'Violet', color: 'hsl(263, 70%, 50%)' },
]

const currentTheme = ref('default')

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const isDark = ref(false)
const showWarningDialog = ref(false)

// Initialize dark mode and color theme from localStorage
onMounted(() => {
  // Load dark mode
  const savedTheme = localStorage.getItem('theme')
  isDark.value = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  // Load color theme
  loadColorTheme()
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

// Color theme handling
const loadColorTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme && themes.some(t => t.name === savedTheme)) {
    currentTheme.value = savedTheme
    applyColorTheme(savedTheme)
  }
}

const applyColorTheme = (themeName: string) => {
  // Remove all theme classes
  themes.forEach(t => {
    document.documentElement.classList.remove(`theme-${t.name}`)
  })

  // Add new theme class (except default which has no class)
  if (themeName !== 'default') {
    document.documentElement.classList.add(`theme-${themeName}`)
  }
}

const setColorTheme = (themeName: string) => {
  currentTheme.value = themeName
  localStorage.setItem(THEME_STORAGE_KEY, themeName)
  applyColorTheme(themeName)
}

const getCurrentThemeColor = computed(() => {
  const theme = themes.find(t => t.name === currentTheme.value)
  return theme?.color || 'hsl(213, 94%, 20%)'
})

const handleLogin = async () => {
  if (!username.value || !password.value) {
    toast.error('Validasi Gagal', {
      description: 'Username dan password harus diisi'
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
      // Step 2: Get user default data with full respo, role, and permission details
      const userDefaultResponse = await getUserDefault(response.data.user.id, response.token)

      // Step 3: Validate user berdasarkan kondisi
      // Jika BUKAN SUPER ADMIN dan TIDAK ADA user_details (respo) → CEGAH LOGIN
      const userData = userDefaultResponse.data as any
      const isSuperAdmin = userData.tipe?.value1?.toUpperCase() === 'SUPER ADMIN'
      const hasUserDetails = Array.isArray(userData.user_details) && userData.user_details.length > 0

      if (!isSuperAdmin && !hasUserDetails) {
        // User tidak punya respo dan bukan super admin → TOLAK LOGIN
        showWarningDialog.value = true
        loading.value = false
        return
      }

      // Step 4: Pass complete data langsung dari API (sudah sesuai interface)
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
      toast.success('Login Berhasil!', {
        description: `Selamat datang kembali, ${userData.name}`
      })

      // Step 7: Redirect to dashboard after short delay
      setTimeout(() => {
        router.push('/')
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
  <div
    class="relative flex min-h-screen items-center justify-center p-4 bg-linear-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5">
    <!-- Theme Controls -->
    <div class="absolute top-4 right-4 z-50 flex items-center gap-2">
      <!-- Color Theme Picker -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-primary/20 dark:border-primary/30 bg-background hover:bg-primary/10"
            title="Change Color Theme">
            <SwatchBook class="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-40">
          <DropdownMenuLabel class="text-xs">Color Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div class="max-h-[168px] overflow-y-auto">
            <DropdownMenuItem v-for="theme in themes" :key="theme.name" class="flex items-center gap-2 cursor-pointer"
              :class="currentTheme === theme.name ? 'bg-primary/10' : ''" @click="setColorTheme(theme.name)">
              <div class="h-4 w-4 rounded-full border border-border shrink-0"
                :style="{ backgroundColor: theme.color }" />
              <span class="text-sm">{{ theme.label }}</span>
              <span v-if="currentTheme === theme.name" class="ml-auto text-primary">✓</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Dark Mode Toggle Button -->
      <button @click="toggleDarkMode"
        class="flex h-9 w-9 items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-primary/20 dark:border-primary/30 bg-background hover:bg-primary/10"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
        <Sun v-if="!isDark" class="h-4 w-4 text-muted-foreground" />
        <Moon v-else class="h-4 w-4 text-muted-foreground" />
      </button>
    </div>

    <Card class="w-full max-w-md shadow-2xl border-primary/20 dark:border-primary/30 dark:bg-card/50 backdrop-blur-sm"
      v-motion :initial="{ opacity: 0, y: 20 }" :enter="{ opacity: 1, y: 0, transition: { duration: 500 } }">
      <CardHeader class="space-y-1 text-center">
        <div class="mx-auto mb-4 flex h-20 items-center justify-center">
          <img src="/hutomoLogoHitam.png" alt="Hutomo Group" class="h-full w-auto dark:hidden" />
          <img src="/hutomoLogoPutih.png" alt="Hutomo Group" class="h-full w-auto hidden dark:block" />
        </div>
        <CardTitle class="text-2xl font-bold">Selamat Datang</CardTitle>
        <CardDescription>Login ke Hutomo Group ERP</CardDescription>
      </CardHeader>

      <form @submit.prevent="handleLogin">
        <CardContent class="space-y-4">
          <!-- Username Field -->
          <div class="space-y-2">
            <Label for="username">Username</Label>
            <Input id="username" v-model="username" type="text" placeholder="Masukkan username" :disabled="loading"
              autocomplete="username" class="transition-all focus:ring-2 focus:ring-primary/20" />
          </div>

          <!-- Password Field -->
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <div class="relative">
              <Input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
                placeholder="Masukkan password" :disabled="loading" autocomplete="current-password"
                class="pr-10 transition-all focus:ring-2 focus:ring-primary/20" />
              <button type="button" @click="togglePasswordVisibility"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                :disabled="loading">
                <Eye v-if="!showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" class="w-full" :disabled="loading">
            <span v-if="loading" class="flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              Loading...
            </span>
            <span v-else class="flex items-center gap-2">
              <LogIn class="h-4 w-4" />
              Login
            </span>
          </Button>
        </CardFooter>
      </form>
    </Card>

    <!-- Footer -->
    <div class="absolute bottom-4 text-center text-xs text-muted-foreground">
      <p>&copy; 2025 Hutomo Group. All rights reserved.</p>
    </div>

    <!-- Warning Dialog - User tidak punya respo -->
    <GlobalDialog :open="showWarningDialog" type="warning" title="Akses Ditolak"
      description="User yang Anda pilih belum dikonfigurasi untuk RESPONSIBILITY/RESPO. Silakan hubungi administrator anda untuk mengatur respo terlebih dahulu."
      confirmText="Ok" :show-cancel="false" @confirm="handleWarningConfirm"
      @update:open="(v) => !v && handleWarningConfirm()" />
  </div>
</template>
