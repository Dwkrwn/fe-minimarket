import { ref } from 'vue'

// Global state untuk trigger refresh sidebar
const shouldRefresh = ref(false)
const refreshTrigger = ref(0)

export function useSidebarRefresh() {
  /**
   * Trigger sidebar refresh dari component mana saja
   * Biasanya dipanggil setelah create/update/delete menu
   */
  const triggerRefresh = () => {
    refreshTrigger.value++
    shouldRefresh.value = true
  }

  /**
   * Reset refresh flag setelah sidebar selesai refresh
   * Dipanggil oleh AppSidebar setelah loadMenus() selesai
   */
  const resetRefresh = () => {
    shouldRefresh.value = false
  }

  return {
    shouldRefresh,
    refreshTrigger,
    triggerRefresh,
    resetRefresh
  }
}
