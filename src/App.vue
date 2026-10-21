<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import TokenExpiredDialog from '@/components/dialog/TokenExpiredDialog.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import LoadingScreen from '@/components/LoadingScreen.vue'
import { useAuthStore } from '@/stores/auth'
import { setTokenExpiredCallback } from '@/lib/api'
import { useAfkLogout } from '@/composables/useAfkLogout'
import { toast } from 'vue-sonner'
import 'vue-sonner/style.css'
import ChatWidget from "./views/ChatWidget.vue";
import { navigationGuardState, handleConfirm, handleCancel } from "@/lib/navigationGuard";

const showTokenExpiredDialog = ref(false)
const showLoadingScreen = ref(false)
const authStore = useAuthStore()
const router = useRouter()
const afk = useAfkLogout()

// Track current respoId untuk detect changes
let currentRespoId: string | null = null

/** Initialize current respoId from localStorage */
const initCurrentRespoId = () => {
  try {
    const selectRespo = localStorage.getItem('SelectRespo')
    if (selectRespo) {
      const parsed = JSON.parse(selectRespo)
      currentRespoId = parsed.respoId || null
    }
  } catch (e) {
    console.error('Failed to parse SelectRespo:', e)
    currentRespoId = null
  }
}

/** Handle respo change - show loading screen and redirect to dashboard */
const handleRespoChanged = (event: Event) => {
  const customEvent = event as CustomEvent
  const newRespoId = customEvent.detail
  
  // Check if respoId actually changed
  if (currentRespoId && newRespoId && currentRespoId !== newRespoId) {
    // Show loading screen
    showLoadingScreen.value = true
    
    // Wait for loading screen animation, then redirect
    setTimeout(() => {
      router.push('/').then(() => {
        // Hide loading screen after navigation completes
        setTimeout(() => {
          showLoadingScreen.value = false
        }, 300)
      })
    }, 1000)
  }
  
  // Update current respoId
  currentRespoId = newRespoId
}

onMounted(() => {
  // Initialize current respoId
  initCurrentRespoId()
  
  // Set callback di API layer untuk handle token expired
  setTokenExpiredCallback(() => {
    // Hanya clear token tapi JANGAN logout dulu
    // Biarkan user re-login via dialog
    showTokenExpiredDialog.value = true
  })
  
  // Listen untuk respo changes
  window.addEventListener('respoChanged', handleRespoChanged)
})

onUnmounted(() => {
  // Cleanup listener
  window.removeEventListener('respoChanged', handleRespoChanged)
})

const handleTokenRenewed = () => {
  showTokenExpiredDialog.value = false
  
  // Setelah token renewed, initialize SelectRespo
  authStore.initializeSelectRespo()
  
  // Update current respoId
  initCurrentRespoId()
}

const handleDialogClosed = (open: boolean) => {
  showTokenExpiredDialog.value = open
}

const afkWarningDescription = computed(() => {
  return `Anda tidak melakukan aktivitas. Sesi akan berakhir dalam ${afk.warningCountdownSeconds.value} detik.`
})
const afkWarningOpen = computed(() => afk.isWarningVisible.value)

const handleStayLoggedIn = () => {
  afk.resetAfkTimer()
}

const handleAfkLogout = async (reason: 'afk' | 'manual' | 'cross-tab') => {
  const skipServer = reason === 'cross-tab'
  await authStore.logoutWithServer({ reason, skipServer })

  if (router.currentRoute.value.name !== 'Login') {
    await router.push('/login')
  }

  if (reason !== 'cross-tab') {
    toast.warning('Sesi Berakhir', {
      description: 'Sesi berakhir karena tidak ada aktivitas.'
    })
  }
}

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      afk.startAfkWatcher()
      afk.resetAfkTimer()
    } else {
      afk.stopAfkWatcher()
    }
  },
  { immediate: true }
)

onMounted(() => {
  afk.setLogoutHandler(handleAfkLogout)
})

onUnmounted(() => {
  afk.stopAfkWatcher()
  afk.setLogoutHandler(null)
})
</script>

<template>
  <Toaster position="top-right" :duration="3000" rich-colors :expand="true" :close-button="true" />
  <TokenExpiredDialog :open="showTokenExpiredDialog" @update:open="handleDialogClosed"
    @token-renewed="handleTokenRenewed" />
  <GlobalDialog
    :open="afkWarningOpen"
    title="Sesi Akan Berakhir"
    :description="afkWarningDescription"
    type="warning"
    confirm-text="Tetap Login"
    cancel-text="Logout Sekarang"
    :persistent="true"
    @confirm="handleStayLoggedIn"
    @cancel="afk.triggerForcedLogout('manual')"
    @update:open="() => {}"
  />
  <GlobalDialog
    :open="navigationGuardState.isOpen"
    :title="navigationGuardState.title"
    :description="navigationGuardState.description"
    type="warning"
    confirm-text="Tinggalkan"
    cancel-text="Tetap di Sini"
    :persistent="true"
    @confirm="handleConfirm"
    @cancel="handleCancel"
    @update:open="(val) => !val && handleCancel()"
  />
  <LoadingScreen :show="showLoadingScreen" message="Memuat Data Responsibility" />
  <RouterView />
  <ChatWidget v-if="authStore.isAuthenticated" />
</template>
