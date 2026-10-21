<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ArrowUpDown, ArrowUp, ArrowDown, Calendar as CalendarIcon, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Date range for DateRangePicker component
interface PickerDateRange {
  from: Date | null
  to: Date | null
}

interface Column<T> {
  key: string
  label: string
  width?: string
  sortable?: boolean
  filterable?: boolean
  // Filter type: 'text' (default) or 'date' for date range filtering
  filterType?: 'text' | 'date'
  wrapText?: boolean
  render?: (item: T, index: number) => any
  renderHtml?: (item: T, index: number) => string
  // Custom function to get the filter value (for complex/nested data)
  filterValue?: (item: T) => string
  // Custom function to get the sort value (for complex/nested data)
  sortValue?: (item: T) => any
  // API filter field name (for API-based filtering), if different from key
  apiFilterField?: string
}

// Date range filter type (string format for API)
interface DateRangeFilter {
  from: string
  to: string
}

interface ApiConfig {
  endpoint: string
  headers?: Record<string, string>
  pageParam?: string // default 'page'
  paginateParam?: string // default 'paginate'
  orderByParam?: string // default 'order_by'
  orderTypeParam?: string // default 'order_type'
  filterColumnPrefix?: string // default 'filter_column_'
  filterOperatorPrefix?: string // default 'filter_operator_'
  whereParam?: string // default 'where'
  defaultParams?: Record<string, string> // additional params like search, searchfield, etc
  onResponseTransform?: (response: any) => { data: T[], pagination?: any, hasMore: boolean }
}

interface Props {
  data?: T[]
  columns: Column<T>[]
  loading?: boolean
  loadingMore?: boolean
  maxHeight?: string
  showIndex?: boolean
  hasMore?: boolean
  rowSelectMode?: boolean
  // Enable API-based filtering (parent handles filtering via API)
  apiFilterMode?: boolean
  // Optional: autonomous API config for DataTable to handle fetching
  apiConfig?: ApiConfig
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingMore: false,
  maxHeight: '400px',
  showIndex: true,
  hasMore: true,
  rowSelectMode: false,
  apiFilterMode: false
})

const emit = defineEmits<{
  loadMore: []
  rowSelect: [item: T, index: number]
  rowDeselect: []
  // Emit filter changes for API filtering (with support for filter operators and WHERE clause)
  filterChange: [filters: { 
    column: Record<string, string>
    operator: Record<string, string>
    dateRange: Record<string, DateRangeFilter>
    where: string
  }]
}>()

const tableContainer = ref<HTMLDivElement>()

// Row selection state
const selectedRowId = ref<any>(null)
const selectedRowData = ref<T | null>(null)
const selectedRowIndex = ref<number | null>(null)

// Column filters
const columnFilters = ref<Record<string, string>>({})

// Column filter operators (e.g., '~*' for ILIKE, '=' for exact match, etc.)
const columnFilterOperators = ref<Record<string, string>>({})

// Date range filters: { columnKey: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } }
const dateRangeFilters = ref<Record<string, DateRangeFilter>>({})

// Date picker state for UI
const datePickerValues = ref<Record<string, PickerDateRange>>({})

// Popover open state for date filters
const datePopoverOpen = ref<Record<string, boolean>>({})

// DateRangePicker refs
const datePickerRefs = ref<Record<string, any>>({})

// Autonomous API mode state
const autonomousLoading = ref(false)
const autonomousLoadingMore = ref(false)
const autonomousData = ref<T[]>([])
const autonomousHasMore = ref(true)
const autonomousCurrentPage = ref(1)

// Initialize filters function
const initializeFilters = () => {
  props.columns.forEach(col => {
    if (col.filterable) {
      if (col.filterType === 'date') {
        if (!dateRangeFilters.value[col.key]) {
          dateRangeFilters.value[col.key] = { from: '', to: '' }
        }
        if (!datePickerValues.value[col.key]) {
          datePickerValues.value[col.key] = { from: null, to: null }
        }
        if (datePopoverOpen.value[col.key] === undefined) {
          datePopoverOpen.value[col.key] = false
        }
      } else {
        if (columnFilters.value[col.key] === undefined) {
          columnFilters.value[col.key] = ''
        }
      }
    }
  })
}

// Initialize on setup
initializeFilters()

// Helper to convert Date to YYYY-MM-DD string
const dateToString = (date: Date | null): string => {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Handle date range change from picker
const handleDateRangeChange = (columnKey: string, range: PickerDateRange) => {
  datePickerValues.value[columnKey] = range
  dateRangeFilters.value[columnKey] = {
    from: dateToString(range.from),
    to: dateToString(range.to)
  }
}

// Build WHERE clause from date range filters
const buildWhereClause = (): string => {
  const conditions: string[] = []
  
  Object.entries(dateRangeFilters.value).forEach(([key, filter]) => {
    if (!filter) return
    
    // Find column to get proper field name
    const col = props.columns.find(c => c.key === key)
    const fieldName = (col as any)?.apiFilterField || key
    
    if (filter.from) {
      conditions.push(`${fieldName}>=${filter.from}`)
    }
    if (filter.to) {
      conditions.push(`${fieldName}<=${filter.to}`)
    }
  })
  
  return conditions.length > 0 ? conditions.join('|') : ''
}

// Autonomous API fetch function
const autonomousFetch = async (page: number = 1, resetData: boolean = false) => {
  if (!props.apiConfig) return
  
  try {
    if (page === 1 || resetData) {
      autonomousLoading.value = true
      autonomousData.value = []
    } else {
      autonomousLoadingMore.value = true
    }

    const config = props.apiConfig
    const pageParam = config.pageParam || 'page'
    const paginateParam = config.paginateParam || 'paginate'
    const filterColumnPrefix = config.filterColumnPrefix || 'filter_column_'
    const filterOperatorPrefix = config.filterOperatorPrefix || 'filter_operator_'
    const whereParam = config.whereParam || 'where'

    const queryParams = new URLSearchParams({
      [pageParam]: page.toString(),
      [paginateParam]: '20'
    })

    // Add default params (search, searchfield, etc)
    if (config.defaultParams) {
      Object.entries(config.defaultParams).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value)
        }
      })
    }

    // Add column filters
    Object.entries(columnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`${filterColumnPrefix}${key}`, value)
      }
    })

    // Add filter operators
    Object.entries(columnFilterOperators.value).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`${filterOperatorPrefix}${key}`, value)
      }
    })

    // Add WHERE clause
    const whereClause = buildWhereClause()
    if (whereClause) {
      queryParams.append(whereParam, whereClause)
    }

    const response = await fetch(`${config.endpoint}?${queryParams}`, {
      method: 'GET',
      headers: config.headers || {}
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const result = await response.json()

    // Transform response using custom function if provided
    let data: T[]
    let hasMore = true
    
    if (config.onResponseTransform) {
      const transformed = config.onResponseTransform(result)
      data = transformed.data
      hasMore = transformed.hasMore
    } else {
      // Default: assume response.data contains array
      data = result.data || result
      hasMore = (result.pagination?.next_page !== null) ? true : false
    }

    if (page === 1 || resetData) {
      autonomousData.value = data
    } else {
      autonomousData.value.push(...(data as any))
    }

    autonomousHasMore.value = hasMore
  } catch (error) {
    console.error('Autonomous API fetch error:', error)
  } finally {
    autonomousLoading.value = false
    autonomousLoadingMore.value = false
  }
}

// Debounce timer for filter changes
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Emit filter changes when filters change (for non-autonomous API mode)
// For autonomous mode, trigger fetch instead
watch([columnFilters, columnFilterOperators, dateRangeFilters], () => {
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer)
  }

  filterDebounceTimer = setTimeout(() => {
    if (props.apiConfig) {
      // Autonomous mode: fetch from API
      autonomousCurrentPage.value = 1
      autonomousFetch(1, true)
    } else if (props.apiFilterMode) {
      // Non-autonomous API mode: emit to parent
      const whereClause = buildWhereClause()
      emit('filterChange', {
        column: { ...columnFilters.value },
        operator: { ...columnFilterOperators.value },
        dateRange: { ...dateRangeFilters.value },
        where: whereClause
      })
    }
  }, 500)
}, { deep: true })

// Clear date filter for a column
const clearDateFilter = (columnKey: string) => {
  dateRangeFilters.value[columnKey] = { from: '', to: '' }
  datePickerValues.value[columnKey] = { from: null, to: null }
  // Reset the picker component
  if (datePickerRefs.value[columnKey]) {
    datePickerRefs.value[columnKey].reset()
  }
}

// Check if date filter is active
const hasActiveDateFilter = (columnKey: string) => {
  const filter = dateRangeFilters.value[columnKey]
  return filter && (filter.from || filter.to)
}

// Format date for display
const formatDateDisplay = (columnKey: string) => {
  const filter = dateRangeFilters.value[columnKey]
  if (!filter) return ''
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
  }
  
  if (filter.from && filter.to) {
    return `${formatDate(filter.from)} - ${formatDate(filter.to)}`
  } else if (filter.from) {
    return `≥ ${formatDate(filter.from)}`
  } else if (filter.to) {
    return `≤ ${formatDate(filter.to)}`
  }
  return ''
}

// Column resizing state
const columnWidths = ref<Record<string, number>>({})
const resizingColumn = ref<string | null>(null)
const startX = ref(0)
const startWidth = ref(0)

// Initialize column widths
const initializeColumnWidths = () => {
  const widths: Record<string, number> = {}

  if (props.showIndex) {
    widths['index'] = 60
  }

  props.columns.forEach(col => {
    if (col.width) {
      widths[col.key] = parseInt(col.width) || 150
    } else {
      widths[col.key] = 150
    }
  })

  columnWidths.value = widths
}

// Start column resize
const startResize = (columnKey: string, event: MouseEvent) => {
  resizingColumn.value = columnKey
  startX.value = event.clientX
  startWidth.value = columnWidths.value[columnKey] || 150

  document.body.classList.add('resizing-column')
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  event.preventDefault()
}

// Handle column resize
const handleResize = (event: MouseEvent) => {
  if (!resizingColumn.value) return

  const diff = event.clientX - startX.value
  const newWidth = Math.max(50, startWidth.value + diff) // Minimum 50px

  columnWidths.value[resizingColumn.value] = newWidth
}

// Stop column resize
const stopResize = () => {
  resizingColumn.value = null
  document.body.classList.remove('resizing-column')
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// Sorting
type SortOrder = 'asc' | 'desc' | null
const sortColumn = ref<string | null>(null)
const sortOrder = ref<SortOrder>(null)

const handleSort = (columnKey: string) => {
  if (sortColumn.value === columnKey) {
    // Cycle through: asc -> desc -> null
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc'
    } else if (sortOrder.value === 'desc') {
      sortOrder.value = null
      sortColumn.value = null
    }
  } else {
    sortColumn.value = columnKey
    sortOrder.value = 'asc'
  }
}

// Helper function to get nested value from object using dot notation
// e.g., getNestedValue(item, 'm_unit_bisni.nama_comp') returns item.m_unit_bisni.nama_comp
const getNestedValue = (obj: any, path: string): any => {
  if (!path.includes('.')) {
    return obj[path]
  }
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null
  }, obj)
}

// Filtered and sorted data with index tracking
const filteredData = computed(() => {
  // Use autonomous data if apiConfig is provided, otherwise use props.data
  const sourceData = props.apiConfig ? autonomousData.value : (props.data || [])
  
  let result = sourceData
    .map((item, idx) => ({
      ...item,
      _originalIndex: idx + 1
    }))
  
  // Apply filtering
  // In API mode: skip date filtering (handled by API via WHERE clause)
  // In non-API mode: apply date filtering locally
  result = result.filter(item => {
    return props.columns.every(col => {
      if (!col.filterable) return true
      
      // Handle date range filter - only in non-API mode (API handles via WHERE clause)
      if (col.filterType === 'date') {
        // Skip local filtering in API mode - API will handle it via WHERE clause
        if (props.apiFilterMode) return true
        
        const dateFilter = dateRangeFilters.value[col.key]
        if (!dateFilter || (!dateFilter.from && !dateFilter.to)) return true
        
        // Get date value from item
        let itemDateValue: string
        if (col.filterValue) {
          itemDateValue = col.filterValue(item as T)
        } else {
          itemDateValue = String(getNestedValue(item, col.key) || '')
        }
        
        if (!itemDateValue) return false
        
        // Parse item date (assuming format could be ISO or various formats)
        const itemDate = new Date(itemDateValue)
        if (isNaN(itemDate.getTime())) return false
        
        // Normalize to start of day for comparison
        const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate())
        
        // Check from date
        if (dateFilter.from) {
          const fromDate = new Date(dateFilter.from)
          const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
          if (itemDateOnly < fromDateOnly) return false
        }
        
        // Check to date
        if (dateFilter.to) {
          const toDate = new Date(dateFilter.to)
          const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
          if (itemDateOnly > toDateOnly) return false
        }
        
        return true
      }
      
      // Skip text filter in API mode (handled by API)
      if (props.apiFilterMode) return true
      
      // Handle text filter (default) - only in non-API mode
      const filterValue = columnFilters.value[col.key]
      if (!filterValue) return true

      // Use custom filterValue function if provided, otherwise use nested key path
      let itemValue: string
      if (col.filterValue) {
        itemValue = String(col.filterValue(item as T) || '').toLowerCase()
      } else {
        // Support nested keys like 'm_unit_bisni.nama_comp'
        itemValue = String(getNestedValue(item, col.key) || '').toLowerCase()
      }
      return itemValue.includes(filterValue.toLowerCase())
    })
  })

  // Apply sorting
  if (sortColumn.value && sortOrder.value) {
    result = [...result].sort((a, b) => {
      let comparison = 0

      if (sortColumn.value === 'index') {
        // Sort by original index
        comparison = a._originalIndex - b._originalIndex
      } else {
        const column = props.columns.find(c => c.key === sortColumn.value)
        let aVal, bVal

        if (column?.sortValue) {
          aVal = column.sortValue(a as T)
          bVal = column.sortValue(b as T)
        } else {
          // Support nested keys for sorting
          aVal = getNestedValue(a, sortColumn.value!)
          bVal = getNestedValue(b, sortColumn.value!)
        }

        // Handle different types
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal
        } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          comparison = aVal === bVal ? 0 : aVal ? 1 : -1
        } else {
          const aStr = String(aVal ?? '').toLowerCase()
          const bStr = String(bVal ?? '').toLowerCase()
          comparison = aStr.localeCompare(bStr)
        }
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
  }

  return result
})

// Handle row selection
const selectRow = (item: T, index: number) => {
  if (!props.rowSelectMode) return

  const rowId = (item as any).id ?? index

  // If clicking same row, deselect
  if (selectedRowId.value === rowId) {
    selectedRowId.value = null
    selectedRowData.value = null
    selectedRowIndex.value = null
    emit('rowDeselect')
  } else {
    selectedRowId.value = rowId
    selectedRowData.value = item
    selectedRowIndex.value = index
    emit('rowSelect', item, index)
  }
}

const getSelectedRowId = () => selectedRowId.value
const getSelectedRowData = () => selectedRowData.value
const getSelectedRowIndex = () => selectedRowIndex.value
const clearSelection = () => {
  selectedRowId.value = null
  selectedRowData.value = null
  selectedRowIndex.value = null
}

// Reset all filters
const resetFilters = () => {
  // Reset column filters
  Object.keys(columnFilters.value).forEach(key => {
    columnFilters.value[key] = ''
  })
  // Reset date range filters
  Object.keys(dateRangeFilters.value).forEach(key => {
    dateRangeFilters.value[key] = { from: '', to: '' }
  })
}

// Build API query parameters from current filters
// Returns query string parameters based on API documentation
const buildApiFilterParams = (): Record<string, string> => {
  const params: Record<string, string> = {}
  
  // Add column filters (text search)
  props.columns.forEach(col => {
    if (!col.filterable) return
    
    const apiField = col.apiFilterField || col.key
    
    if (col.filterType === 'date') {
      const dateFilter = dateRangeFilters.value[col.key]
      if (dateFilter?.from) {
        // API format: filter_column_[field]_from or filter_column_[field]_gte
        params[`filter_column_${apiField}_gte`] = dateFilter.from
      }
      if (dateFilter?.to) {
        // API format: filter_column_[field]_to or filter_column_[field]_lte
        params[`filter_column_${apiField}_lte`] = dateFilter.to
      }
    } else {
      const filterValue = columnFilters.value[col.key]
      const filterOperator = columnFilterOperators.value[col.key]
      if (filterValue) {
        // API format: filter_column_[field]=[value] and filter_operator_[field]=[operator]
        params[`filter_column_${apiField}`] = filterValue
        if (filterOperator) {
          params[`filter_operator_${apiField}`] = filterOperator
        }
      }
    }
  })
  
  return params
}

// Get current filter state
const getFilters = () => ({
  column: { ...columnFilters.value },
  operator: { ...columnFilterOperators.value },
  dateRange: { ...dateRangeFilters.value }
})

// Infinite scroll handler
const handleScroll = () => {
  if (!tableContainer.value) return
  
  // Check if still loading or no more data
  const isLoading = props.apiConfig ? autonomousLoadingMore.value : props.loadingMore
  const hasMore = props.apiConfig ? autonomousHasMore.value : props.hasMore
  
  if (isLoading || !hasMore) return

  const element = tableContainer.value
  const scrollBottom = element.scrollHeight - element.scrollTop - element.clientHeight

  // Trigger load more when within 100px of bottom
  if (scrollBottom < 100) {
    if (props.apiConfig) {
      // Autonomous mode: fetch next page
      autonomousCurrentPage.value++
      autonomousFetch(autonomousCurrentPage.value, false)
    } else {
      // Non-autonomous mode: emit to parent
      emit('loadMore')
    }
  }
}

onMounted(() => {
  initializeColumnWidths()

  if (tableContainer.value) {
    tableContainer.value.addEventListener('scroll', handleScroll)
  }
  
  // Autonomous mode: fetch data on mount
  if (props.apiConfig) {
    autonomousFetch(1, true)
  }
})

onUnmounted(() => {
  if (tableContainer.value) {
    tableContainer.value.removeEventListener('scroll', handleScroll)
  }

  // Clean up resize listeners
  document.body.classList.remove('resizing-column')
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})

defineExpose({
  tableContainer,
  selectRow,
  getSelectedRowId,
  getSelectedRowData,
  getSelectedRowIndex,
  clearSelection,
  // Filter methods
  resetFilters,
  getFilters,
  buildApiFilterParams,
  // Autonomous mode refresh
  refreshData: () => {
    if (props.apiConfig) {
      autonomousCurrentPage.value = 1
      autonomousFetch(1, true)
    }
  },
  // Direct access to filter state (for parent component)
  columnFilters,
  columnFilterOperators,
  dateRangeFilters
})
</script>

<template>
  <div class="rounded-lg overflow-auto border bg-background/50" ref="tableContainer" :style="{ maxHeight }">
    <Table class="min-w-full" style="table-layout: auto;">

        <!-- Sticky Header + Filter Row -->
        <TableHeader class="sticky top-0 z-20 bg-background">
          <!-- Header Row -->
          <TableRow class="border-b-2 bg-background">
            <TableHead
              v-if="showIndex"
              class="cursor-pointer select-none hover:bg-muted/50 bg-background relative border-l border-r w-16"
              @click="handleSort('index')"
            >
              <div class="flex items-center gap-1 justify-center font-semibold">
                No
                <ArrowUpDown v-if="sortColumn !== 'index'" class="h-3 w-3 opacity-50" />
                <ArrowUp v-else-if="sortOrder === 'asc'" class="h-3 w-3" />
                <ArrowDown v-else-if="sortOrder === 'desc'" class="h-3 w-3" />
              </div>
              <!-- Resize Handle -->
              <div
                class="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 transition-colors z-20 group"
                @mousedown="startResize('index', $event)"
                title="Drag to resize column"
              >
                <div class="absolute right-0 top-0 bottom-0 w-0.5 bg-border group-hover:bg-primary/70"></div>
              </div>
            </TableHead>

            <TableHead
              v-for="col in columns"
              :key="col.key"
              :class="[
                'select-none transition-colors bg-background lg:whitespace-nowrap whitespace-normal wrap-break-word relative border-r text-xs lg:text-sm px-4',
                col.sortable === false ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50'
              ]"
              :style="col.width ? { width: col.width } : {}"
              @click="col.sortable !== false && handleSort(col.key)"
            >
              <div class="flex items-start gap-1 font-semibold text-left leading-snug">
                {{ col.label }}
                <template v-if="col.sortable !== false">
                  <ArrowUpDown v-if="sortColumn !== col.key" class="h-3 w-3 opacity-50" />
                  <ArrowUp v-else-if="sortOrder === 'asc'" class="h-3 w-3" />
                  <ArrowDown v-else-if="sortOrder === 'desc'" class="h-3 w-3" />
                </template>
              </div>
              <!-- Resize Handle -->
              <div
                class="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 transition-colors z-20 group"
                @mousedown.stop="startResize(col.key, $event)"
                title="Drag to resize column"
              >
                <div class="absolute right-0 top-0 bottom-0 w-0.5 bg-border group-hover:bg-primary/70"></div>
              </div>
            </TableHead>
          </TableRow>

          <!-- Filter Row -->
          <TableRow class="bg-muted/80 backdrop-blur-sm border-b">
            <TableHead
              v-if="showIndex"
              class="bg-muted/80 backdrop-blur-sm p-2 border-l border-r"
            />
            <TableHead
              v-for="col in columns"
              :key="`filter-${col.key}`"
              class="bg-muted/80 backdrop-blur-sm p-2 border-r"
            >
              <!-- Date Range Filter -->
              <template v-if="col.filterable && col.filterType === 'date'">
                <Popover 
                  :open="datePopoverOpen[col.key]" 
                  @update:open="(v: boolean) => datePopoverOpen[col.key] = v"
                >
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      size="sm"
                      :class="[
                        'h-8 w-full justify-start text-left font-normal text-[11px] lg:text-xs bg-background',
                        hasActiveDateFilter(col.key) ? 'border-primary text-primary' : 'text-muted-foreground'
                      ]"
                    >
                      <CalendarIcon class="mr-1 h-3 w-3 shrink-0" />
                      <span class="truncate">
                        {{ hasActiveDateFilter(col.key) ? formatDateDisplay(col.key) : 'Pilih tanggal...' }}
                      </span>
                      <span 
                        v-if="hasActiveDateFilter(col.key)" 
                        class="ml-auto h-4 w-4 shrink-0 flex items-center justify-center rounded-full hover:bg-destructive/20 cursor-pointer z-10"
                        @click.stop.prevent="clearDateFilter(col.key)"
                        @mousedown.stop.prevent
                        @pointerdown.stop.prevent
                      >
                        <X class="h-3 w-3 hover:text-destructive" />
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <DateRangePicker
                      v-if="datePopoverOpen[col.key]"
                      :ref="(el: any) => datePickerRefs[col.key] = el"
                      :model-value="datePickerValues[col.key]"
                      @update:model-value="(v: PickerDateRange) => handleDateRangeChange(col.key, v)"
                    />
                    <div class="px-3 pb-3 flex items-center justify-between border-t pt-3">
                      <div class="text-xs text-muted-foreground">
                        <template v-if="hasActiveDateFilter(col.key)">
                          {{ formatDateDisplay(col.key) }}
                        </template>
                        <template v-else>
                          Pilih rentang tanggal
                        </template>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        class="h-7 text-xs"
                        @click="clearDateFilter(col.key)"
                      >
                        Reset
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </template>
              
              <!-- Text Filter (default) - Only enable in non-API mode -->
              <Input
                v-else-if="col.filterable"
                v-model="columnFilters[col.key]"
                placeholder="Search..."
                class="h-8 text-[11px] w-full bg-background lg:text-xs"
              />
            </TableHead>
          </TableRow>
        </TableHeader>

        <!-- Table Body -->
        <TableBody>
          <!-- Loading Skeletons (Initial Load) -->
          <template v-if="loading && (data?.length ?? 0) === 0">
            <TableRow v-for="i in 5" :key="`skeleton-${i}`">
              <TableCell v-if="showIndex" class="border-l border-r">
                <Skeleton class="h-4 w-8" />
              </TableCell>
              <TableCell
                v-for="col in columns"
                :key="`skeleton-${col.key}-${i}`"
                class="border-r"
              >
                <Skeleton class="h-4 w-full" />
              </TableCell>
            </TableRow>
          </template>

          <!-- Empty State -->
          <TableRow v-else-if="filteredData.length === 0">
            <TableCell
              :colspan="columns.length + (showIndex ? 1 : 0)"
              class="h-32 text-center border-l border-r"
            >
              <div class="flex flex-col items-center justify-center text-muted-foreground">
                <slot name="empty">Tidak ada data</slot>
              </div>
            </TableCell>
          </TableRow>

          <!-- Data Rows with Animation -->
          <template v-else>
            <TableRow
              v-for="(item, index) in filteredData"
              :key="(item as any).id || index"
              :class="[
                'transition-colors cursor-pointer',
                {
                  'bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900':
                    rowSelectMode && selectedRowId === ((item as any).id || index),
                  'hover:bg-muted/50':
                    !rowSelectMode || selectedRowId !== ((item as any).id || index)
                }
              ]"
              @click="selectRow(item as T, index)"
            >
              <TableCell
                v-if="showIndex"
                class="text-center font-medium border-l border-r w-16"
              >
                {{ index + 1 }}
              </TableCell>

              <TableCell
                v-for="col in columns"
                :key="col.key"
                :class="[
                  'border-r text-xs lg:text-sm px-4',
                  col.wrapText ? 'whitespace-normal wrap-break-word' : 'lg:whitespace-nowrap whitespace-normal wrap-break-word'
                ]"
                :style="col.width ? { width: col.width } : {}"
              >
                <template v-if="col.renderHtml">
                  <span v-html="col.renderHtml(item as T, index)" class="text-left block"></span>
                </template>
                <template v-else-if="col.render">
                  <span class="text-left block">
                    {{ col.render(item as T, index) }}
                  </span>
                </template>
                <template v-else>
                  <span
                    :class="col.wrapText ? 'block text-left' : 'block truncate lg:max-w-xs max-w-[140px] text-left'"
                    :title="String(getNestedValue(item, col.key) ?? '')"
                  >
                    {{ getNestedValue(item, col.key) }}
                  </span>
                </template>
              </TableCell>
            </TableRow>
          </template>

          <!-- Loading More Skeletons -->
          <template v-if="loadingMore">
            <TableRow v-for="i in 3" :key="`skeleton-more-${i}`">
              <TableCell v-if="showIndex" class="border-l border-r">
                <Skeleton class="h-4 w-8" />
              </TableCell>
              <TableCell
                v-for="col in columns"
                :key="`skeleton-more-${col.key}-${i}`"
                class="border-r"
              >
                <Skeleton class="h-4 w-full" />
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
  </div>
</template>

<style scoped>
/* Table row animations */
.table-row-move {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.table-row-enter-active,
.table-row-leave-active {
  transition: all 0.3s ease;
}

.table-row-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.table-row-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.table-row-leave-active {
  position: absolute;
}

/* Column resize handle */
.resize-handle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-handle:active {
  background: hsl(var(--primary) / 0.3);
}

/* Column resize cursor */
body.resizing-column {
  cursor: col-resize !important;
  user-select: none;
}

body.resizing-column * {
  cursor: col-resize !important;
  user-select: none;
}
</style>
