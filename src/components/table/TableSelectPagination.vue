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
  <div class="flex flex-col h-full border rounded-md overflow-hidden bg-background">
    <!-- Toolbar -->
    <div class="p-2 border-b flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input v-model="searchQuery" type="text" placeholder="Search..."
          class="w-full h-8 pl-8 pr-8 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          @keydown.enter="onSearch" />
        <button v-if="searchQuery" type="button"
          class="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
          @click="clearSearch">
          <X class="h-4 w-4" />
        </button>
      </div>
      <!-- Optional: Refresh/Filter buttons -->
    </div>

    <!-- Table Container -->
    <div class="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-12.5 text-center">No</TableHead>
            <TableHead v-for="col in columns" :key="col.field" :style="{ width: col.width }" class="whitespace-nowrap">
              {{ col.headerName }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="i in 5" :key="i">
              <TableCell>
                <Skeleton class="h-4 w-8 mx-auto" />
              </TableCell>
              <TableCell v-for="col in columns" :key="col.field">
                <Skeleton class="h-4 w-full" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else-if="data.length === 0">
            <TableRow>
              <TableCell :colspan="columns.length + 1" class="text-center h-24 text-muted-foreground">
                No data found
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow v-for="(item, index) in data" :key="index" class="cursor-pointer hover:bg-muted/50"
              @click="selectRow(item)">
              <TableCell class="text-center">
                {{ (currentPage - 1) * pageSize + index + 1 }}
              </TableCell>
              <TableCell v-for="col in columns" :key="col.field">
                {{ col.render ? col.render(item) : item[col.field] }}
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div class="p-2 border-t flex justify-end">
      <div class="flex items-center space-x-2">
        <button class="px-2 py-1 text-sm border rounded disabled:opacity-50" :disabled="currentPage <= 1 || loading"
          @click="onPageChange(currentPage - 1)">
          Prev
        </button>
        <span class="text-sm">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button class="px-2 py-1 text-sm border rounded disabled:opacity-50"
          :disabled="currentPage >= totalPages || loading" @click="onPageChange(currentPage + 1)">
          Next
        </button>
      </div>
    </div>
  </div>
</template>
