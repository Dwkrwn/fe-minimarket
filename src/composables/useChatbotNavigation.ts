import { onMounted, ref, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

/**
 * Composable untuk handle navigation dari chatbot dengan auto-search
 * 
 * Usage di Landing page:
 * ```ts
 * const { searchQuery } = useChatbotNavigation(searchQuery, () => {
 *   // Optional: callback setelah search di-trigger
 *   fetchData()
 * })
 * ```
 */
export function useChatbotNavigation(
  searchQuery?: Ref<string>,
  onSearchCallback?: () => void
) {
  const route = useRoute()
  const hasProcessedQuery = ref(false)

  onMounted(() => {
    // Prevent double processing
    if (hasProcessedQuery.value) return

    // Check if ada query params dari chatbot
    const querySearch = route.query.search as string
    const queryId = route.query.id as string

    if (querySearch && searchQuery) {
      // Set search query
      searchQuery.value = querySearch
      hasProcessedQuery.value = true

      // Show toast notification
      toast.info('🔍 Auto-search dari Chatbot', {
        description: `Mencari: "${querySearch}"`
      })

      // Trigger callback jika ada
      if (onSearchCallback) {
        setTimeout(() => {
          onSearchCallback()
        }, 100)
      }
    }

    if (queryId) {
      // TODO: Implement auto-open form dengan ID tertentu
      toast.info('📂 Membuka data...', {
        description: `ID: ${queryId}`
      })
    }
  })

  return {
    hasProcessedQuery
  }
}
