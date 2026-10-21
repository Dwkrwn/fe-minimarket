<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Loader2, Search } from 'lucide-vue-next'
import DataTableSelect from '@/components/table/DataTableSelect.vue'
import { apiCall } from '@/lib/api'

interface ApiConfig {
  url: string
  headers?: Record<string, string>
  params?: Record<string, any>
  onsuccess?: (response: any) => any | Promise<any>
}

interface Column {
  key?: string
  field?: string
  label?: string
  headerName?: string
  width?: string | number
  flex?: number
  sortable?: boolean
  filterable?: boolean
  filter?: string
  resizable?: boolean
  wrapText?: boolean
  cellClass?: string[]
  valueGetter?: (params: any) => any
  render?: (item: any, index: number) => any
  renderHtml?: (item: any, index: number) => string
}

interface FieldPopupProps {
  /** Field label */
  label?: string
  /** Input value (ID) */
  value?: string | number
  /** Input value (for v-model support) */
  modelValue?: string | number
  /** Placeholder text */
  placeholder?: string
  /** Error message or hint */
  hints?: string
  /** Error state name */
  errorText?: 'failed' | ''
  /** Is field required */
  required?: boolean
  /** Is field disabled */
  disabled?: boolean
  /** Is field readonly */
  readonly?: boolean
  /** Custom class */
  class?: string
  /** Field ID */
  id?: string
  /** Display field name from API response */
  displayField?: string
  /** Value field name from API response */
  valueField?: string
  /** API configuration */
  api?: ApiConfig
  /** Table columns configuration */
  columns?: Column[]
  /** Allow clearable */
  clearable?: boolean
  /** Pre-populated display text for selected value (e.g., from related object) */
  displayValue?: string
  /** Additional bind props */
  bind?: Record<string, any>
  /** IDs to exclude from the list */
  excludeIds?: string[]
}

const props = withDefaults(defineProps<FieldPopupProps>(), {
  required: false,
  disabled: false,
  readonly: false,
  errorText: '',
  displayField: 'label',
  valueField: 'value',
  clearable: true,
  placeholder: 'Pilih data...',
  displayValue: '',
  columns: () => [],
  excludeIds: () => []
})

const emit = defineEmits<{
  input: [value: string]
  'update:modelValue': [value: string]
  'update:valueFull': [object: any]
}>()

const loading = ref(false)
const loadingMore = ref(false)
const tableData = ref<any[]>([])
const searchQuery = ref('')
const open = ref(false)
const selectedItem = ref<any>(null)
const hasMore = ref(true)
const currentPage = ref(1)
const tableRef = ref<any>(null)
const hasError = computed(() => props.errorText === 'failed')

// Filter data to exclude specified IDs
const filteredTableData = computed(() => {
  if (!props.excludeIds || props.excludeIds.length === 0) {
    return tableData.value
  }
  return tableData.value.filter(item =>
    !props.excludeIds.includes(String(item[props.valueField]))
  )
})
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Support both value prop and modelValue prop
const currentValue = computed(() => {
  const val = props.modelValue ?? props.value ?? ''
  return String(val)
})

const getNestedValue = (obj: any, path: string) => {
  if (!obj || !path) return ''
  const val = path.split('.').reduce((acc, part) => acc && acc[part], obj);
  return val !== undefined && val !== null ? val : '';
}

// Get display text for selected value
const displayText = computed(() => {
  if (!currentValue.value) return ''

  // Use provided displayValue if available (e.g., from related object in form)
  if (props.displayValue) {
    return props.displayValue
  }

  if (selectedItem.value) {
    return getNestedValue(selectedItem.value, props.displayField) || currentValue.value
  }

  // Try to find from loaded data
  const found = tableData.value.find(
    item => String(item[props.valueField]) === currentValue.value
  )

  return found ? getNestedValue(found, props.displayField) || currentValue.value : currentValue.value
})

// Transform columns to DataTable format
const tableColumns = computed(() => {
  if (!props.columns || props.columns.length === 0) {
    // Default columns if not provided
    return [
      { key: 'id', label: 'ID', sortable: true, filterable: true },
      { key: props.displayField, label: 'Nama', sortable: true, filterable: true, width: '100%' }
    ]
  }

  return props.columns.map(col => {
    const key = col.field || col.key || ''
    const label = col.headerName || col.label || key

    // Helper function to get nested properties using dot notation
    const getNestedValue = (obj: any, path: string) => {
      return path.split('.').reduce((current, prop) => current?.[prop], obj)
    }

    return {
      key,
      label,
      width: col.width ? String(col.width) : col.flex ? '100%' : undefined,
      sortable: col.sortable !== false,
      filterable: col.filter === 'ColFilter',
      renderHtml: col.renderHtml,
      render: (item: any, index: number) => {
        if (col.valueGetter) {
          return col.valueGetter({ node: { rowIndex: index }, data: item })
        }
        if (col.render) {
          return col.render(item, index)
        }
        // Default: handle nested field paths with dot notation
        return getNestedValue(item, key)
      }
    }
  })
})

const handleValueChange = (newValue: string, fullObject?: any) => {
  emit('input', newValue)
  emit('update:modelValue', newValue)
  if (fullObject !== undefined) {
    emit('update:valueFull', fullObject)
  }
}

const handleClear = (e: Event) => {
  e.stopPropagation()
  selectedItem.value = null
  handleValueChange('', null)
}

const openDialog = () => {
  if (props.disabled || props.readonly) return
  open.value = true
  currentPage.value = 1
  searchQuery.value = ''
  fetchData(true)
}

const closeDialog = () => {
  open.value = false
}

const handleRowSelect = (item: any, index: number) => {
  selectedItem.value = item
  const value = String(item[props.valueField])
  handleValueChange(value, item)
  closeDialog()
}

const handleSearch = () => {
  currentPage.value = 1
  tableData.value = []
  fetchData(true)
}

const clearSearch = () => {
  searchQuery.value = ''
  handleSearch()
}

const handleSearchInput = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    handleSearch()
  }, 400)
}

const handleLoadMore = () => {
  if (!loadingMore.value && hasMore.value) {
    currentPage.value++
    fetchData(false)
  }
}

// Fetch data from API
const fetchData = async (reset = false) => {
  if (!props.api) return

  if (reset) {
    loading.value = true
    tableData.value = []
  } else {
    loadingMore.value = true
  }

  try {
    // Extract endpoint from full URL
    const url = new URL(props.api.url)
    const endpoint = url.pathname.replace('/api', '')

    // Build query params
    const queryParams = new URLSearchParams()

    // Add API params (excluding search-related params that will be added separately)
    if (props.api.params) {
      Object.entries(props.api.params).forEach(([key, value]) => {
        // Skip searchfield from params, we'll add it separately if search is active
        if (key !== 'searchfield') {
          queryParams.append(key, String(value))
        }
      })
    }

    // Add pagination
    queryParams.append('page', String(currentPage.value))
    queryParams.append('paginate', '20')

    // Add search query and searchfield if search is active
    if (searchQuery.value && props.api.params?.searchfield) {
      queryParams.append('search', searchQuery.value)
      queryParams.append('searchfield', String(props.api.params.searchfield))
    }

    const fullEndpoint = `${endpoint}?${queryParams.toString()}`

    // Call API using apiCall helper
    let response: any = await apiCall(fullEndpoint, {
      method: 'GET',
      headers: props.api.headers
    })

    // Apply onsuccess transformation if provided
    if (props.api.onsuccess) {
      response = await props.api.onsuccess(response)
    }

    if (response.status === 'success' && response.data) {
      const newData = Array.isArray(response.data) ? response.data : []

      if (reset) {
        tableData.value = newData
      } else {
        tableData.value = [...tableData.value, ...newData]
      }

      // Check if has more data
      if (response.hasNext !== undefined) {
        hasMore.value = response.hasNext
      } else if (response.pagination?.next_page) {
        hasMore.value = true
      } else {
        hasMore.value = newData.length >= 20
      }
    } else {
      if (reset) {
        tableData.value = []
      }
      hasMore.value = false
    }
  } catch (error) {
    console.error('Failed to fetch popup data:', error)
    if (reset) {
      tableData.value = []
    }
    hasMore.value = false
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Fetch detail of selected item by ID
const fetchDetailById = async (id: string) => {
  if (!props.api || !id || !id.trim()) return

  try {
    // Extract endpoint from full URL
    const url = new URL(props.api.url)
    const endpoint = url.pathname.replace('/api', '')

    // Build query params - fetch detail by ID
    const queryParams = new URLSearchParams()

    // Add filter by ID using valueField
    queryParams.append(`filter_column_${props.valueField}`, id)
    queryParams.append('paginate', '1')

    // Add other API params (like filter_column_is_active)
    if (props.api.params) {
      Object.entries(props.api.params).forEach(([key, value]) => {
        if (key !== 'searchfield') {
          queryParams.append(key, String(value))
        }
      })
    }

    const fullEndpoint = `${endpoint}?${queryParams.toString()}`

    // Call API
    let response: any = await apiCall(fullEndpoint, {
      method: 'GET',
      headers: props.api.headers
    })

    // Apply onsuccess transformation if provided
    if (props.api.onsuccess) {
      response = await props.api.onsuccess(response)
    }

    if (response.status === 'success' && response.data) {
      const data = Array.isArray(response.data) ? response.data[0] : response.data
      if (data) {
        selectedItem.value = data
      }
    }
  } catch (error) {
    console.error('Failed to fetch detail by ID:', error)
  }
}

// Load initial data if value is set
onMounted(() => {
  // Fetch detail data if we have initial value (for edit/view mode)
  if (currentValue.value && currentValue.value.trim() && props.api && !props.displayValue) {
    fetchDetailById(currentValue.value)
  }
})

onBeforeUnmount(() => {
  // Restore body scroll on unmount
  document.body.style.overflow = ''
  open.value = false
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

// Watch value changes to fetch detail when value is set (for edit/view mode)
watch(
  () => currentValue.value,
  (newVal, oldVal) => {
    // Fetch detail if value changed from empty to non-empty OR value changed
    if (newVal && newVal.trim() && newVal !== oldVal && props.api && !props.displayValue) {
      fetchDetailById(newVal)
    } else if (!newVal) {
      // Clear selectedItem if value is cleared
      selectedItem.value = null
    }
  }
)

// Watch open state to manage body scroll
watch(open, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', handleEscape)
  }
})

// Handle ESC key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && open.value) {
    closeDialog()
  }
}
</script>

<template>
  <div :class="props.class">
    <Label v-if="label" :for="id" :class="{ 'required': required }" class="mb-2 block">
      {{ label }}
    </Label>

    <div class="relative">
      <div :class="[
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer hover:bg-primary/10 hover:text-foreground transition-colors',
        { 'border-destructive': hasError },
        { 'cursor-not-allowed opacity-50': disabled || readonly },
        { 'pr-16': clearable && currentValue }
      ]" @click="openDialog" v-bind="bind">
        <span :class="[
          'truncate flex-1',
          !displayText && 'text-muted-foreground'
        ]">
          {{ displayText || placeholder }}
        </span>
        <Search class="h-4 w-4 shrink-0 opacity-50" />
      </div>

      <!-- Clear Button -->
      <button v-if="clearable && currentValue && !disabled && !readonly" type="button"
        class="absolute right-8 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-destructive z-10"
        @click="handleClear">
        <X class="h-4 w-4" />
      </button>
    </div>

    <p v-if="hints" :class="hasError ? 'text-destructive' : 'text-muted-foreground'" class="text-sm mt-1">
      {{ hints }}
    </p>

    <!-- Custom Popup Modal with Teleport -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          @click.self="closeDialog">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeDialog"></div>

          <!-- Modal Content - Responsive sizing -->
          <div
            class="relative w-full max-w-7xl h-[95vh] sm:h-[90vh] bg-background rounded-lg sm:rounded-xl shadow-2xl flex flex-col overflow-hidden z-10">
            <!-- Header - Responsive padding -->
            <div class="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b bg-background shrink-0">
              <div class="flex-1 min-w-0">
                <h2 class="text-lg sm:text-xl font-bold text-foreground truncate">Pilih Data</h2>
                <p class="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Klik pada baris untuk
                  memilih data</p>
              </div>
              <Button variant="ghost" size="icon" @click="closeDialog"
                class="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-destructive/10 shrink-0 ml-2">
                <X class="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>

            <!-- Search Bar - Responsive layout -->
            <div class="px-4 py-3 sm:px-6 sm:py-4 border-b bg-muted/20 shrink-0">
              <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div class="relative flex-1">
                  <Input v-model="searchQuery" placeholder="Ketik untuk mencari data..."
                    class="pr-9 text-sm sm:text-base"
                    @input="handleSearchInput"
                    @keyup.enter="handleSearch" />
                  <Button v-if="searchQuery" type="button" size="icon" variant="ghost"
                    class="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-white"
                    @click="clearSearch">
                    <X class="h-4 w-4" />
                  </Button>
                </div>
                <Button @click="handleSearch" :disabled="loading"
                  class="w-full sm:w-auto px-4 sm:px-6 text-sm sm:text-base">
                  <Search class="h-4 w-4 mr-2" />
                  Cari
                </Button>
              </div>
            </div>

            <!-- Data Table - Full Height with Proper Scroll, Responsive padding -->
            <div class="flex-1 min-h-0 overflow-hidden">
              <div class="h-full px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                <DataTableSelect ref="tableRef" :data="filteredTableData" :columns="tableColumns" :loading="loading"
                  :loading-more="loadingMore" :has-more="hasMore" @row-select="handleRowSelect"
                  @load-more="handleLoadMore" />
              </div>
            </div>

            <!-- Footer - Responsive layout -->
            <div class="px-4 py-3 sm:px-6 sm:py-4 border-t bg-muted/20 shrink-0">
              <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <Button variant="outline" @click="closeDialog"
                  class="w-full sm:w-auto sm:min-w-[120px] text-sm sm:text-base">
                  Batal
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: #ef4444;
  font-weight: bold;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .relative {
  transform: scale(0.95);
  opacity: 0;
}

.modal-leave-to .relative {
  transform: scale(0.95);
  opacity: 0;
}
</style>
