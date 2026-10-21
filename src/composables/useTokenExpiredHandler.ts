import { useAuthStore } from '@/stores/auth'
import { TokenExpiredError } from '@/lib/api'

/**
 * Composable untuk handle token expired errors
 * Gunakan di components yang melakukan API calls
 */
export function useTokenExpiredHandler() {
  const authStore = useAuthStore()

  const handleApiError = (error: unknown) => {
    if (error instanceof TokenExpiredError) {
      // Trigger token expired dialog
      authStore.handleTokenExpired()
      throw error
    }
    throw error
  }

  return {
    handleApiError
  }
}
