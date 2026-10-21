<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { login, getUserDefault } from '@/lib/api'
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
        isLoading.value = false
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
      
      // Step 6: Restore SelectRespo jika ada saved respo ID
      if (savedRespoId) {
        // Cari apakah user masih punya akses ke respo yang sama
        const userDetail = userData.user_details?.find(
          (ud: any) => ud.m_respo_id === savedRespoId && ud.is_active
        )
        
        if (userDetail?.m_respo) {
          // User masih punya akses ke respo yang sama, restore SelectRespo
          // Extract permissions dari respo ini
          const permissions: Record<string, {
            is_read: boolean
            is_create: boolean
            is_update: boolean
            is_delete: boolean
            is_print: boolean
          }> = {}
          
          const menuMap = new Map<string, any>()
          
          userDetail.m_respo.m_respo_ds?.forEach((respoDetail: any) => {
            if (!respoDetail.is_active || !respoDetail.m_role?.is_active) return
            
            respoDetail.m_role.m_role_ds?.forEach((roleDetail: any) => {
              const menuId = roleDetail.m_menu_id
              
              // Store menu data
              if (roleDetail.m_menu && !menuMap.has(menuId)) {
                menuMap.set(menuId, {
                  id: roleDetail.m_menu.id,
                  name: roleDetail.m_menu.name,
                  path: roleDetail.m_menu.path,
                  icon: roleDetail.m_menu.icon,
                  seq: roleDetail.m_menu.seq,
                  modul: roleDetail.m_menu.modul
                })
              }
              
              // Merge permissions
              if (permissions[menuId]) {
                permissions[menuId].is_read = permissions[menuId].is_read || roleDetail.is_read
                permissions[menuId].is_create = permissions[menuId].is_create || roleDetail.is_create
                permissions[menuId].is_update = permissions[menuId].is_update || roleDetail.is_update
                permissions[menuId].is_delete = permissions[menuId].is_delete || roleDetail.is_delete
                permissions[menuId].is_print = permissions[menuId].is_print || roleDetail.is_print
              } else {
                permissions[menuId] = {
                  is_read: roleDetail.is_read,
                  is_create: roleDetail.is_create,
                  is_update: roleDetail.is_update,
                  is_delete: roleDetail.is_delete,
                  is_print: roleDetail.is_print
                }
              }
            })
          })
          
          const selectRespoData = {
            respoId: userDetail.id,
            respoName: userDetail.m_respo.nama,
            isPrimary: userDetail.is_primary,
            companyId: userDetail.m_respo.unit_bisnis?.id || null,
            companyName: userDetail.m_respo.unit_bisnis?.nama_comp || null,
            unitBisnisName: userDetail.m_respo.unit_bisnis?.nama_comp || null,
            companyLegalId: userDetail.m_respo.unit_bisnis?.m_company?.id || null,
            companyLegalName: userDetail.m_respo.unit_bisnis?.m_company?.nama || null,
            companyLogo: userDetail.m_respo.unit_bisnis?.m_company?.logo_img || null,
            gudangId: (userDetail.m_respo as any).m_gudang_id || null,
            menus: Array.from(menuMap.values()),
            permissions
          }
          
          localStorage.setItem('SelectRespo', JSON.stringify(selectRespoData))
        } else {
          // User sudah tidak punya akses ke respo tersebut, use default
          authStore.initializeSelectRespo()
        }
      } else {
        // Tidak ada saved respo, use default
        authStore.initializeSelectRespo()
      }
      
      // Reset saved respo ID
      const restoredRespoId = savedRespoId
      savedRespoId = null
      
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

  <!-- Warning Dialog - User tidak punya respo -->
  <GlobalDialog
    :open="showWarningDialog"
    type="warning"
    title="Akses Ditolak"
    description="User yang Anda pilih belum dikonfigurasi untuk RESPONSIBILITY/RESPO. Silakan hubungi administrator anda untuk mengatur respo terlebih dahulu."
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
