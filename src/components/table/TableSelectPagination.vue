<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiCall } from '@/lib/api' // Assuming this helper exists
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface ApiConfig {
  url: string
  params?: Record<string, any>
  headers?: Record<string, string>
}

interface Column {
  field: string
  headerName: string
  width?: string
  sortable?: boolean
  filterable?: boolean
  render?: (item: any) => any
}

interface Props {
  api: ApiConfig
  columns: Column[]
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 10
})

const emit = defineEmits<{
  select: [item: any]
}>()

// State
const data = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const searchQuery = ref('')
const searchField = ref('') // Optional: field to search specifically if needed

// Fetch Data
const fetchData = async () => {
  loading.value = true
  try {
    const queryParams = new URLSearchParams()

    // Add default params
    if (props.api.params) {
      Object.entries(props.api.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }

    // Add Pagination
    queryParams.append('page', String(currentPage.value))
    queryParams.append('paginate', String(props.pageSize))

    // Add Search
    if (searchQuery.value) {
      queryParams.append('search', searchQuery.value)
      // Optional: if explicit search fields logic needed
    }

    // Fix: apiCall likely prepends base URL. If props.api.url is absolute, we should strip the origin if it matches, or just use the path.
    // However, simpler: if url contains 'http', try to extract the relative part or just use it if apiCall supports absolute.
    // Given the double url issue: `https://.../apihttps://...` it seems apiCall joins base + url.
    // The user passes `${API_BASE_URL}/dynamic/t_rfq...`.
    // We should parse this URL and only pass the path + query.

    let endpoint = props.api.url
    try {
      const urlObj = new URL(props.api.url)
      endpoint = urlObj.pathname // pathname usually starts with /
    } catch (e) {
      // relative url
    }

    // Remove /api prefix if multiple exist or apiCall adds it.
    // If endpoint starts with /api, and apiCall adds /api, we get /api/api.
    // We should strip one /api if it exists at the start.
    if (endpoint.startsWith('/api')) {
      endpoint = endpoint.replace('/api', '')
    }

    const fullEndpoint = `${endpoint}?${queryParams.toString()}`

    const response: any = await apiCall(fullEndpoint, {
      method: 'GET',
      headers: props.api.headers
    })

    if (response.status === 'success' || response.data) {
      data.value = Array.isArray(response.data) ? response.data : []
      // Handle pagination data
      if (response.pagination) {
        totalPages.value = response.pagination.last_page || response.pagination.totalPages || 1
        totalItems.value = response.pagination.total || 0
        currentPage.value = response.pagination.current_page || response.pagination.page || 1
      }
    }
  } catch (error) {
    console.error('Error fetching table data:', error)
    data.value = []
  } finally {
    loading.value = false
  }
}

// Handlers
const onPageChange = (page: number) => {
  currentPage.value = page
  fetchData()
}

const onSearch = () => {
  currentPage.value = 1
  fetchData()
}

const clearSearch = () => {
  searchQuery.value = ''
  onSearch()
}

const selectRow = (item: any) => {
  emit('select', item)
}


// Watchers
watch(() => props.api, () => {
  currentPage.value = 1
  fetchData()
}, { deep: true, immediate: true })


defineExpose({
  refresh: fetchData
})
</script>

<template>
  <div class="flex flex-col h-full border border-border/80 rounded-2xl overflow-hidden bg-card shadow-sm">
    <!-- Toolbar -->
    <div class="p-3 border-b border-border/60 bg-muted/20 flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input v-model="searchQuery" type="text" placeholder="Search..."
          class="w-full h-9 pl-9 pr-9 text-xs border border-border/80 rounded-xl bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
          @keydown.enter="onSearch" />
        <button v-if="searchQuery" type="button"
          class="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="clearSearch">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
      <!-- Optional: Refresh/Filter buttons -->
    </div>

    <!-- Table Container -->
    <div class="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent border-b border-border/80">
            <TableHead class="w-12.5 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">No</TableHead>
            <TableHead v-for="col in columns" :key="col.field" :style="{ width: col.width }" class="whitespace-nowrap font-bold text-xs uppercase tracking-wider text-muted-foreground">
              {{ col.headerName }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i" class="border-b border-border/60">
              <TableCell>
                <Skeleton class="h-4 w-8 mx-auto rounded-lg" />
              </TableCell>
              <TableCell v-for="col in columns" :key="col.field">
                <Skeleton class="h-4 w-full rounded-lg" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else-if="data.length === 0">
            <TableRow>
              <TableCell :colspan="columns.length + 1" class="text-center h-24 text-muted-foreground text-xs">
                No data found
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow v-for="(item, index) in data" :key="index" class="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/60"
              @click="selectRow(item)">
              <TableCell class="text-center font-mono text-xs text-muted-foreground">
                {{ (currentPage - 1) * pageSize + index + 1 }}
              </TableCell>
              <TableCell v-for="col in columns" :key="col.field" class="text-xs">
                {{ col.render ? col.render(item) : item[col.field] }}
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div class="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
      <span class="text-xs text-muted-foreground">
        Page <span class="font-semibold text-foreground">{{ currentPage }}</span> of <span class="font-semibold text-foreground">{{ totalPages }}</span>
      </span>
      <div class="flex items-center space-x-2">
        <button class="px-3 py-1.5 text-xs font-medium rounded-xl border border-border/80 bg-background hover:bg-muted transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs" :disabled="currentPage <= 1 || loading"
          @click="onPageChange(currentPage - 1)">
          Prev
        </button>
        <button class="px-3 py-1.5 text-xs font-medium rounded-xl border border-border/80 bg-background hover:bg-muted transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          :disabled="currentPage >= totalPages || loading" @click="onPageChange(currentPage + 1)">
          Next
        </button>
      </div>
    </div>
  </div>
</template>
