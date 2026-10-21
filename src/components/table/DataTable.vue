<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, watch, defineComponent, h, useSlots, useAttrs, Fragment, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import type { ColDef, GridApi, GridReadyEvent, CellContextMenuEvent, RowClickedEvent } from 'ag-grid-community'
import { getGridTheme } from './theme'
import DateRangeFilterFloating from './DateRangeFilterFloating.vue'
import { toast } from 'vue-sonner'
import * as LucideIcons from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date'

interface ActionButton<T> {
  icon: string
  variant?: 'default' | 'ghost' | 'outline' | 'destructive'
  title?: string
  ifShow?: (item: T) => boolean
  onClick: (item: T) => void
}

interface Column<T> {
  key: string
  label: string
  width?: string | number
  minWidth?: number
  maxWidth?: number
  flex?: number
  sortable?: boolean
  filterable?: boolean
  filterType?: 'text' | 'date'
  wrapText?: boolean
  truncate?: boolean | number
  align?: 'left' | 'center' | 'right'
  valueGetter?: (item: T, index: number) => any
  render?: (item: T, index: number) => any
  renderHtml?: (item: T, index: number) => string
  actionButtons?: ActionButton<T>[]
  spanRows?: boolean | ((params: { valueA: any, valueB: any, dataA: any, dataB: any }) => boolean)
  suppressSizeToFit?: boolean
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
  multiSelectMode?: boolean
  selectedItems?: T[]
  apiFilterMode?: boolean
  emptyMessage?: string
  rowHeight?: number
  selectionCheckboxVisible?: (item: T) => boolean
  showSelectAll?: boolean
  truncateText?: boolean
  textTruncateLength?: number
  // Pagination props
  currentPage?: number
  totalPages?: number
  totalItems?: number
  pageSize?: number
  showPagination?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingMore: false,
  maxHeight: '500px',
  showIndex: true,
  hasMore: true,
  rowSelectMode: false,
  multiSelectMode: false,
  selectedItems: () => [],
  apiFilterMode: false,
  emptyMessage: 'Tidak ada data',
  rowHeight: 50,
  showSelectAll: true,
  truncateText: true,
  textTruncateLength: 0,
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  pageSize: 10,
  showPagination: true  // Default true - pagination button aktif otomatis
})

const emit = defineEmits<{
  loadMore: []
  rowSelect: [item: T, index: number]
  rowDeselect: []
  selectionChange: [items: T[]]
  filterChange: [filters: { column: Record<string, string>, operator: Record<string, string>, dateRange: Record<string, { from: string, to: string }>, where: string }]
  actionCompleted: [action: string, item: T]  // New: emit after action button completes
  refreshRequested: []  // New: emit when refresh is needed
  pageChange: [page: number]  // New: emit when page changes
  pageSizeChange: [pageSize: number]  // Emit when page size changes
}>()

// Define slots
defineSlots<{
  empty: () => any
}>()

const gridApi = ref<GridApi>()
const selectedRowId = ref<any>(null)  // Track by ID, not object reference
const selectedRowData = ref<T | null>(null)
const selectedRowIndex = ref<number | null>(null)

// ============================================================================
// INTERNAL PAGINATION STATE (client-side pagination)
// ============================================================================
const internalCurrentPage = ref(1)
const internalPageSize = ref(10)

// Computed: Use props if provided (API pagination), otherwise use internal (client-side)
const effectiveCurrentPage = computed(() => {
  // If parent provides totalPages > 0, use parent's pagination
  if (props.totalPages > 0) return props.currentPage
  return internalCurrentPage.value
})

const effectiveTotalItems = computed(() => {
  if (props.totalPages > 0) return props.totalItems
  return props.data?.length || 0
})

const effectiveTotalPages = computed(() => {
  if (props.totalPages > 0) return props.totalPages
  const total = props.data?.length || 0
  return Math.ceil(total / internalPageSize.value) || 1
})

const effectivePageSize = computed(() => {
  if (props.totalPages > 0) return props.pageSize
  return internalPageSize.value
})

// Paginated data for display (only used for client-side pagination)
const paginatedData = computed(() => {
  if (!props.data) return []

  // If parent handles pagination (totalPages > 0), show all data as-is
  if (props.totalPages > 0) return props.data

  // Client-side pagination: slice data
  const start = (internalCurrentPage.value - 1) * internalPageSize.value
  const end = start + internalPageSize.value
  return props.data.slice(start, end)
})

// Handle page change
const handleInternalPageChange = (newPage: number) => {
  if (props.totalPages > 0) {
    // API pagination - emit to parent
    emit('pageChange', newPage)
  } else {
    // Client-side pagination
    internalCurrentPage.value = newPage
  }
}

// Handle page size change
const handlePageSizeChange = (newSize: number) => {
  internalPageSize.value = newSize
  // Reset to page 1 when changing page size
  internalCurrentPage.value = 1
  emit('pageSizeChange', newSize)
}

// Reset to page 1 when data changes (for client-side pagination)
watch(() => props.data?.length, () => {
  if (props.totalPages === 0) {
    internalCurrentPage.value = 1
  }
})

// Filter state
interface DateRangeFilter { from: string; to: string }
interface DateRangeFilters { [key: string]: DateRangeFilter }
const columnFilters = ref<Record<string, string>>({})
const dateRangeFilters = ref<DateRangeFilters>({})
const dateColumnKeys = computed(() =>
  new Set(props.columns.filter((col) => col.filterType === 'date').map((col) => col.key))
)

// Computed: check if any column filter or date range filter is active
const hasFilters = computed(() => {
  const hasColFilters = Object.values(columnFilters.value).some((v) => Boolean(v && String(v).trim()))
  const hasDateFilters = Object.values(dateRangeFilters.value).some((f) => Boolean(f && (f.from || f.to)))
  let hasGridModel = false
  if (gridApi.value) {
    const model = gridApi.value.getFilterModel()
    hasGridModel = Boolean(model && Object.keys(model).length > 0)
  }
  return hasColFilters || hasDateFilters || hasGridModel
})

// Clear all active filters (both text filters in AG grid & date range filters)
const clearAllFilters = () => {
  dateRangeFilters.value = {}
  columnFilters.value = {}
  if (gridApi.value) {
    gridApi.value.setFilterModel(null)
  }
  emitFilterChange()
}

// Build WHERE clause from date range filters (like REFF.vue)
const buildWhereClause = (): string => {
  const conditions: string[] = []

  Object.entries(dateRangeFilters.value).forEach(([key, filter]) => {
    if (!filter || (!filter.from && !filter.to)) {
      return
    }

    const from = filter.from?.trim()
    const to = filter.to?.trim()

    if (from && to) {
      conditions.push(`${key}>=${from}`)
      conditions.push(`${key}<=${to}`)
    } else if (from) {
      conditions.push(`${key}=${from}`)
    } else if (to) {
      conditions.push(`${key}<=${to}`)
    }
  })

  const whereClause = conditions.length > 0 ? conditions.join('|') : ''
  return whereClause
}

const attrs = useAttrs()
const effectiveApiFilterMode = computed(() => Boolean(props.apiFilterMode || attrs.onFilterChange))

// Emit filter change to parent component
const emitFilterChange = () => {
  if (!effectiveApiFilterMode.value) {
    return
  }

  const whereClause = buildWhereClause()

  emit('filterChange', {
    column: columnFilters.value,
    operator: {},
    dateRange: dateRangeFilters.value,
    where: whereClause
  })
}

// Provide date filter handler for DateRangeFilterFloating component
const handleDateFilterChange = (columnKey: string, from: string, to: string) => {
  if (!columnKey) {
    return
  }

  // Update date range filters state
  if (from || to) {
    dateRangeFilters.value[columnKey] = { from, to }
  } else {
    delete dateRangeFilters.value[columnKey]
  }

  // Emit filter change to parent
  emitFilterChange()
}

// Provide handlers and reactive state to child components (DateRangeFilterFloating)
provide('onDateFilterChange', handleDateFilterChange)
provide('dateRangeFilters', dateRangeFilters)

// Dark mode detection
const isDarkMode = ref(false)
const themeVersion = ref(0)  // Trigger recompute on theme change

const checkDarkMode = () => {
  isDarkMode.value = document.documentElement.classList.contains('dark')
}

// Watch for dark mode and theme changes
let darkModeObserver: MutationObserver | null = null

onMounted(() => {
  checkDarkMode()

  // Observe class changes on html element for dark mode and theme toggle
  darkModeObserver = new MutationObserver(() => {
    checkDarkMode()
    themeVersion.value++  // Force theme recompute
  })

  darkModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  // Ctrl+C / Cmd+C: copy native browser text selection (works with enableCellTextSelection)
  window.addEventListener('keydown', handleCtrlCopy)
})

onUnmounted(() => {
  darkModeObserver?.disconnect()
  window.removeEventListener('keydown', handleCtrlCopy)
})

// Handle Ctrl+C to copy browser-selected cells in TSV format (row-based, like Excel)
const handleCtrlCopy = (e: KeyboardEvent) => {
  if (!((e.ctrlKey || e.metaKey) && e.key === 'c')) return

  const selection = window.getSelection()
  if (!selection || !selection.toString().trim()) return

  try {
    // Collect AG Grid cells that contain selected text
    const gridEl = document.querySelector('.ag-center-cols-container') as HTMLElement
    if (!gridEl) return

    const allCells = Array.from(gridEl.querySelectorAll('.ag-cell')) as HTMLElement[]
    const selectedCells: { rowIndex: number; colIndex: number; text: string }[] = []

    allCells.forEach((cell) => {
      if (!selection.containsNode(cell, true)) return
      const text = cell.textContent?.trim() ?? ''
      if (!text) return

      const rowEl = cell.closest('.ag-row') as HTMLElement | null
      const rowIndex = rowEl ? parseInt(rowEl.getAttribute('row-index') || '0') : 0
      const colIndex = parseInt(cell.getAttribute('aria-colindex') || '0')
      selectedCells.push({ rowIndex, colIndex, text })
    })

    if (selectedCells.length === 0) {
      // Fallback: copy raw selection
      const raw = selection.toString().trim()
      copyTextToClipboard(raw).then(() => {
        toast.success(`Disalin: ${raw.length > 60 ? raw.slice(0, 60) + '...' : raw}`, { duration: 1500 })
      })
      return
    }

    // Sort by row then column
    selectedCells.sort((a, b) => a.rowIndex !== b.rowIndex ? a.rowIndex - b.rowIndex : a.colIndex - b.colIndex)

    // Group by row → join columns with tab, join rows with newline
    const rowMap = new Map<number, string[]>()
    selectedCells.forEach(({ rowIndex, text }) => {
      if (!rowMap.has(rowIndex)) rowMap.set(rowIndex, [])
      rowMap.get(rowIndex)!.push(text)
    })

    const tsv = Array.from(rowMap.values())
      .map(cols => cols.join('\t'))
      .join('\n')

    e.preventDefault()
    copyTextToClipboard(tsv).then(() => {
      const rowCount = rowMap.size
      const colCount = Math.max(...Array.from(rowMap.values()).map(c => c.length))
      toast.success(`Disalin ${rowCount} baris × ${colCount} kolom`, { duration: 1500 })
    })
  } catch {
    // Fallback: copy raw selection
    const raw = selection.toString().trim()
    if (raw) {
      copyTextToClipboard(raw).then(() => {
        toast.success(`Disalin: ${raw.length > 60 ? raw.slice(0, 60) + '...' : raw}`, { duration: 1500 })
      })
    }
  }
}

// Extract primary color from CSS variables
const primaryColor = computed(() => {
  const root = document.documentElement
  const styles = getComputedStyle(root)

  // Extract primary color HSL value (format: "213 94% 20%")
  const primaryHSL = styles.getPropertyValue('--primary').trim()

  if (!primaryHSL) {
    // Fallback color if CSS variable not found
    return '#0ea5e9'
  }

  // Convert HSL to hex for better compatibility
  // Parse HSL values: "0 72.2% 50.6%" or "hsl(0 72.2% 50.6%)" -> h=0, s=72.2, l=50.6
  let cleanStr = primaryHSL
  if (cleanStr.startsWith('hsl(')) {
    cleanStr = cleanStr.substring(4)
  }
  if (cleanStr.endsWith(')')) {
    cleanStr = cleanStr.substring(0, cleanStr.length - 1)
  }

  const hslParts = cleanStr.split(/[\s,]+/).filter(p => p.length > 0)
  if (hslParts.length >= 3) {
    const h = parseInt(hslParts[0]!) || 0
    const s = (parseInt(hslParts[1]!) || 0) / 100
    const l = (parseInt(hslParts[2]!) || 0) / 100

    // HSL to RGB conversion
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0

    if (h < 60) { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else { r = c; g = 0; b = x }

    const toHex = (v: number) => {
      const hex = Math.round((v + m) * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }

    return '#' + toHex(r) + toHex(g) + toHex(b)
  }

  // Fallback
  return '#0ea5e9'
})

// Convert hex color to RGB string for use in rgba()
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result && result.length >= 4) {
    const r = parseInt(result[1]!, 16)
    const g = parseInt(result[2]!, 16)
    const b = parseInt(result[3]!, 16)
    return `${r}, ${g}, ${b}`
  }
  return '66, 165, 244' // Fallback blue RGB
}

const getNestedValue = (data: any, key?: string) => {
  if (!key || !data) return undefined
  return key.split('.').reduce((value, part) => value?.[part], data)
}

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim()

const hasHtmlTag = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const normalizeCellText = (value: any) => {
  if (value === null || value === undefined || value === '') return '-'
  if (value instanceof Date) return value.toLocaleDateString('id-ID')
  if (typeof value === 'object') return ''
  return String(value)
}

const getTruncateLength = (col: Column<T>) => {
  if (!props.truncateText || col.truncate === false) return 0
  if (typeof col.truncate === 'number') return col.truncate
  if (props.textTruncateLength && props.textTruncateLength > 0) return props.textTruncateLength
  return 0
}

const truncateCellText = (value: string, maxLength: number) => {
  if (!maxLength || value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}...`
}

const formatCellText = (value: any, col: Column<T>) => {
  const text = normalizeCellText(value)
  const maxLength = getTruncateLength(col)
  return text === '-' ? text : truncateCellText(text, maxLength)
}

const resolveCellDisplayValue = (params: any, col: Column<T>) => {
  if (!params.data) return params.value

  if (col.render) {
    return col.render(params.data, params.node?.rowIndex ?? 0)
  }

  if (col.renderHtml) {
    return stripHtml(col.renderHtml(params.data, params.node?.rowIndex ?? 0))
  }

  if (col.valueGetter) {
    return col.valueGetter(params.data, params.node?.rowIndex ?? 0)
  }

  return getNestedValue(params.data, col.key)
}

// Dynamic theme based on dark/light mode
const gridTheme = computed(() => {
  // Access all dependencies to trigger reactivity
  const version = themeVersion.value
  const isDark = isDarkMode.value
  const color = primaryColor.value

  // Get theme from theme.ts
  return getGridTheme(isDark)
})

// Access parent slots
const slots = useSlots() as any

// Custom no-rows overlay component - render slot or default message
const noRowsOverlay = defineComponent({
  name: 'NoRowsOverlay',
  props: ['params'],
  setup() {
    // Get slot content outside of setup
    let slotContent: any = null
    try {
      slotContent = slots?.empty?.()
    } catch (e) {
      slotContent = null
    }

    return () => {
      const content = slotContent || props.emptyMessage

      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%'
          }
        },
        h('div', { class: 'text-muted-foreground text-center' }, content)
      )
    }
  }
})

// Convert columns to AG Grid format
const columnDefs = computed<ColDef[]>(() => {
  const cols: ColDef[] = []

  // Add index column if needed
  if (props.showIndex) {
    cols.push({
      headerName: 'No',
      valueGetter: (params: any) => {
        // Calculate global index: (currentPage - 1) * pageSize + rowIndex + 1
        const currentPage = effectiveCurrentPage.value
        const pageSize = effectivePageSize.value
        return (currentPage - 1) * pageSize + params.node.rowIndex + 1
      },
      width: 60,
      minWidth: 60,
      maxWidth: 60,
      flex: 0,
      pinned: 'left',
      sortable: false,
      filter: true,
      floatingFilter: true,
      floatingFilterComponentParams: {
        suppressFilterButton: true
      },
      floatingFilterComponent: defineComponent({
        name: 'ClearFiltersFloatingFilter',
        setup() {
          const onParentModelChanged = () => {}
          return { onParentModelChanged }
        },
        render() {
          if (!hasFilters.value) {
            return h('div', { class: 'w-full h-full flex items-center justify-center' })
          }
          return h(
            'button',
            {
              type: 'button',
              class:
                'w-full h-7 flex items-center justify-center text-xs font-bold text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer',
              title: 'Clear All Filters',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                clearAllFilters()
              }
            },
            [h(LucideIcons.X, { class: 'h-4 w-4' })]
          )
        }
      }),
      resizable: false,
      suppressSizeToFit: true,
      cellStyle: { textAlign: 'center', fontWeight: '500' },
      headerClass: 'ag-header-cell-center',
    })
  }

  // Add data columns
  props.columns.forEach(col => {
    const isDateFilter = col.filterType === 'date'
    // Determine alignment style (default: left)
    const textAlign = col.align || 'left'
    const shouldTruncate = props.truncateText && col.truncate !== false && !col.actionButtons?.length
    // Enable wrapText only when not truncating with ellipsis
    const wrapText = shouldTruncate ? false : col.wrapText !== false
    const colDef: ColDef = {
      headerName: col.label,
      field: col.key,
      valueGetter: col.valueGetter
        ? (params: any) => {
            if (!params.data) return null
            return col.valueGetter!(params.data, params.node?.rowIndex ?? 0)
          }
        : undefined,
      sortable: col.sortable !== false,
      filter: col.filterable ? 'agTextColumnFilter' : false,
      floatingFilter: col.filterable,
      floatingFilterComponent: col.filterable && isDateFilter ? DateRangeFilterFloating : 'agTextColumnFloatingFilter',
      filterParams: effectiveApiFilterMode.value && !isDateFilter ? {
        textMatcher: () => true
      } : undefined,
      width: typeof col.width === 'number' ? col.width : (col.width ? parseInt(col.width) : 150),
      minWidth: col.minWidth,
      maxWidth: col.maxWidth,
      flex: col.flex,
      suppressSizeToFit: col.suppressSizeToFit,
      resizable: true,
      wrapText: wrapText,
      autoHeight: wrapText,
      cellClass: shouldTruncate ? 'ag-cell-text-truncate' : undefined,
      tooltipValueGetter: shouldTruncate
        ? (params: any) => {
            const text = normalizeCellText(resolveCellDisplayValue(params, col))
            return text !== '-' ? text : null
          }
        : undefined,
      suppressHeaderMenuButton: true,
      cellStyle: { textAlign },
      headerClass: `ag-header-cell-${textAlign}`,
    }

    // Add spanRows if provided (for row spanning/merging)
    if (col.spanRows !== undefined) {
      (colDef as any).spanRows = col.spanRows
    }

    // Custom cell renderer if provided
    if (col.actionButtons && col.actionButtons.length > 0) {
      // Render action buttons
      colDef.cellRenderer = defineComponent({
        name: 'ActionButtonsCell',
        props: ['params'],
        setup(props: any) {
          const handleButtonClick = async (btn: ActionButton<T>, rowData: T, e: MouseEvent) => {
            e.stopPropagation()
            e.preventDefault()

            try {
              // Execute action
              await btn.onClick(rowData)

              // DEFAULT: Always auto-refresh after action - emit event with delay
              setTimeout(() => {
                emit('refreshRequested')
              }, 300) // Small delay for backend processing

              // Emit action completed for tracking
              emit('actionCompleted', btn.icon, rowData)
            } catch (error) {
              console.error('Action button error:', error)
            }
          }

          return () => {
            const rowData = props.params.data
            if (!rowData) return null

            return h('div', {
              class: 'flex items-center justify-center gap-1.5 h-full py-1 px-1',
              style: { minWidth: 'fit-content' },
              onMousedown: (e: Event) => {
                e.stopPropagation()
              },
              onClick: (e: Event) => {
                e.stopPropagation()
                e.preventDefault()
              }
            }, col.actionButtons!.filter(btn => btn.ifShow ? btn.ifShow(rowData) : true).map((btn, idx) => {
              // Get icon component from lucide-vue-next
              const IconComponent = (LucideIcons as any)[btn.icon]

              // Use native button with Lucide icon for better click handling
              return h('button', {
                key: idx,
                type: 'button',
                class: `inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${btn.variant === 'destructive' ? 'hover:bg-destructive/10 hover:text-destructive' : ''}`,
                title: btn.title || '',
                onMousedown: (e: MouseEvent) => {
                  e.stopPropagation()
                },
                onClick: (e: MouseEvent) => {
                  handleButtonClick(btn, rowData, e)
                }
              }, IconComponent ? [h(IconComponent, { class: 'h-4 w-4', strokeWidth: 2 })] : [])
            }))
          }
        }
      })
      colDef.sortable = false
      colDef.filter = false
      colDef.floatingFilter = false
      colDef.suppressNavigable = true
      colDef.suppressMovable = true
      colDef.cellStyle = {
        textAlign: 'center',
        padding: '4px',
        overflow: 'visible'
      }
      colDef.headerClass = 'ag-header-cell-center'
    } else if (col.renderHtml) {
      // Preserve raw value for filter/sort when using renderHtml.
      // If a custom valueGetter was provided above, keep it.
      if (!colDef.valueGetter) {
        colDef.valueGetter = (params: any) => {
          if (col.key && params.data) {
            const fieldParts = col.key.split('.')
            let value = params.data
            for (const part of fieldParts) {
              value = value?.[part]
            }
            return value
          }
          return params.value
        }
      }
      colDef.cellRenderer = (params: any) => {
        if (params.data) {
          const rendered = col.renderHtml!(params.data, params.node.rowIndex)
          if (hasHtmlTag(rendered)) {
            return rendered
          }

          return escapeHtml(formatCellText(rendered, col))
        }
        return escapeHtml(formatCellText(params.value, col))
      }
    } else if (col.render) {
      colDef.valueFormatter = (params: any) => {
        const value = params.data
          ? col.render!(params.data, params.node.rowIndex)
          : params.value
        return formatCellText(value, col)
      }
    } else if (isDateFilter) {
      colDef.valueFormatter = (params: any) => {
        return formatDate(params.value)
      }
    }

    if (!col.actionButtons && !col.renderHtml && !col.render && !isDateFilter) {
      colDef.valueFormatter = (params: any) => {
        return formatCellText(params.value, col)
      }
    }

    cols.push(colDef)
  })

  return cols
})

// AG Grid options
const defaultColDef = computed<ColDef>(() => ({
  flex: 1,
  minWidth: 100,
  filter: true,
  floatingFilter: true,  // Enable floating filter row below header
  sortable: true,
  resizable: true
}))

// Grid display options - show all borders
const gridOptions = computed(() => ({
  enableCellSpan: true,  // Enable cell spanning feature
  getRowId: (params: any) => {
    const data = params.data
    if (data && data.id !== undefined && data.id !== null) {
      return String(data.id)
    }
    return String(data?._rowKey ?? JSON.stringify(data))
  },
  rowClassRules: {
    'ag-row-selected': (params: any) => params.node.selected
  }
}))

// Debounce timer for filter changes
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Create filter header component (hanya dipakai untuk apiFilterMode)
// const createFilterHeaderComponent = (colKey: string) => {
//   return defineComponent({
//     name: 'FilterHeader',
//     props: ['params'],
//     setup(props: any) {
//       const filterValue = ref(columnFilters.value[colKey] || '')
//       
//       const handleFilterChange = (e: any) => {
//         filterValue.value = e.target.value
//         columnFilters.value[colKey] = filterValue.value
//       }
//       
//       return () => h('div', { class: 'w-full h-full flex flex-col bg-muted/30 dark:bg-slate-800' }, [
//         h('div', { class: 'flex-1 flex items-center px-2 py-1 text-xs font-medium text-foreground border-b border-border dark:border-slate-700' }, 
//           props.params?.displayName || ''
//         ),
//         h('input', {
//           type: 'text',
//           class: 'w-full px-2 py-1 text-xs bg-background dark:bg-slate-950 text-foreground dark:text-slate-100 border-0 outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground dark:placeholder:text-slate-500',
//           placeholder: `Search...`,
//           value: filterValue.value,
//           onInput: handleFilterChange
//         })
//       ])
//     }
//   })
// }
const rowSelectionConfig = computed(() => {
  if (props.multiSelectMode) {
    return {
      mode: 'multiRow' as const,
      // Checkbox hanya tampil/centang untuk baris yang lolos selectionCheckboxVisible.
      // Baris lain tetap bisa diklik (row-select) untuk view/edit karena enableClickSelection.
      checkboxes: props.selectionCheckboxVisible
        ? (params: any) => props.selectionCheckboxVisible!(params.data)
        : true,
      headerCheckbox: props.showSelectAll,
      enableClickSelection: props.rowSelectMode,
      enableSelectionWithoutKeys: true,
    }
  }

  if (props.rowSelectMode) {
    return {
      mode: 'singleRow' as const,
      checkboxes: false,
      enableClickSelection: true,
    }
  }

  return undefined
})

// Row class rules for selected state - more reliable than CSS
const getRowClass = (params: any) => {
  const classes = []
  if (params.node.selected) {
    classes.push('ag-row-selected-custom')
  }
  return classes
}

const makeFloatingFiltersSearchable = () => {
  nextTick(() => {
    const inputs = document.querySelectorAll('.ag-floating-filter-input input')
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement && input.type !== 'search') {
        input.type = 'search'
      }
    })
  })
}

// Grid ready handler
const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api
  params.api.sizeColumnsToFit()
  makeFloatingFiltersSearchable()

  // Restore selection if selectedItems provided in multi-select mode
  if (props.multiSelectMode) {
    syncSelection()
  }
}

// Sync selection with selectedItems prop (for multi-select mode)
const syncSelection = () => {
  if (!gridApi.value || !props.multiSelectMode) return

  const selectedIds = new Set(props.selectedItems.map((item: any) => item.id))

  gridApi.value.forEachNode((node) => {
    const nodeId = (node.data as any)?.id
    node.setSelected(Boolean(nodeId && selectedIds.has(nodeId)), false, 'api')
  })
}

// Watch selectedItems prop to sync selection across pagination
watch(() => props.selectedItems, () => {
  if (props.multiSelectMode && gridApi.value) {
    syncSelection()
  }
}, { deep: true })

// Watch data changes to restore selection
watch(() => props.data, () => {
  if (props.multiSelectMode && props.selectedItems && props.selectedItems.length > 0 && gridApi.value) {
    // Use nextTick to ensure grid has updated
    setTimeout(() => {
      syncSelection()
    }, 50)
  }
})

// Selection change handler - triggered when any row selection changes
const onSelectionChanged = (event: any) => {
  if (!gridApi.value) return

  const selectedRows = gridApi.value.getSelectedRows()

  // Multi-select mode
  if (props.multiSelectMode) {
    emit('selectionChange', selectedRows as T[])
  }

  // In combined multi-select + row-select mode, row clicks own the active row
  // so bulk checkbox changes do not clear the row used by View/Edit actions.
  if (!props.rowSelectMode || props.multiSelectMode) return

  if (selectedRows && selectedRows.length === 1) {
    const selectedRow = selectedRows[0]
    selectedRowId.value = (selectedRow as any).id ?? 0
    selectedRowData.value = selectedRow as T
    selectedRowIndex.value = 0 // For single row mode, index is always first
    emit('rowSelect', selectedRow as T, 0)
  } else {
    selectedRowId.value = null
    selectedRowData.value = null
    selectedRowIndex.value = null
    emit('rowDeselect')
  }
}

const setActiveRow = (item: T, index: number) => {
  selectedRowId.value = (item as any)?.id ?? 0
  selectedRowData.value = item
  selectedRowIndex.value = index
  emit('rowSelect', item, index)
}

const onRowClicked = (event: RowClickedEvent<T>) => {
  if (!props.rowSelectMode || !event.data) return

  setActiveRow(event.data, event.rowIndex ?? 0)
}

// Filter change handler - triggered by AG Grid filter changes
const onFilterChanged = () => {
  if (!gridApi.value) return

  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)

  filterDebounceTimer = setTimeout(() => {
    const filterModel = gridApi.value!.getFilterModel()

    const filters: Record<string, string> = {}
    // Extract filters from AG Grid filter model
    Object.entries(filterModel).forEach(([key, value]: any) => {
      if (dateColumnKeys.value.has(key)) {
        return
      }

      // Text filter
      if (value && value.filter && typeof value.filter === 'string') {
        filters[key] = value.filter
      }
    })

    columnFilters.value = filters

    if (!effectiveApiFilterMode.value) return

    // Build WHERE clause and emit filter change event
    const whereClause = buildWhereClause()

    emit('filterChange', {
      column: filters,
      operator: {},
      dateRange: dateRangeFilters.value,
      where: whereClause
    })
  }, 300) // Reduced debounce from 500ms to 300ms for faster response
}

// Scroll handler for infinite load
const onBodyScroll = (event: any) => {
  // Only enable infinite scroll if pagination is disabled
  if (props.showPagination) return
  if (!gridApi.value || props.loadingMore || !props.hasMore) return

  const scrollTop = event.top
  const scrollHeight = gridApi.value.getVerticalPixelRange().bottom
  const clientHeight = gridApi.value.getVerticalPixelRange().top

  if (scrollHeight - scrollTop - clientHeight < 100) {
    emit('loadMore')
  }
}

const isPlainObjectOrArray = (value: unknown) => {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date)
  )
}

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) {
      throw new Error('Browser tidak mengizinkan copy otomatis')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

// Cell context menu handler - right click to copy cell value
const onCellContextMenu = (event: CellContextMenuEvent) => {
  // Prevent default context menu
  event.event?.preventDefault()

  const colDef = event.colDef
  const field = colDef?.field
  const headerName = colDef?.headerName || field || 'Field'

  // Get row data
  let rowData = event.data
  
  // If rowData not available, try from gridApi selection
  if (!rowData && gridApi.value) {
    const selectedRows = gridApi.value.getSelectedRows()
    if (selectedRows.length > 0) {
      rowData = selectedRows[0]
    }
  }

  // Try multiple approaches to get raw value
  let rawValue: any = null
  const targetEl = event.event?.target as HTMLElement | undefined
  const cellEl = targetEl?.closest?.('.ag-cell') as HTMLElement | null
  const domText = cellEl?.textContent?.trim()

  // Approach 1: Use event.value (should contain raw value from valueGetter if set)
  if (
    event.value !== null &&
    event.value !== undefined &&
    event.value !== '' &&
    !isPlainObjectOrArray(event.value)
  ) {
    rawValue = event.value
  }

  // Approach 2: Access from row data via field path
  if ((rawValue === null || rawValue === undefined) && field && rowData) {
    try {
      const fieldParts = field.split('.')
      let resolved: any = rowData

      for (const part of fieldParts) {
        if (resolved !== null && resolved !== undefined) {
          resolved = resolved[part]
        } else {
          resolved = undefined
          break
        }
      }

      if (
        resolved !== null &&
        resolved !== undefined &&
        !isPlainObjectOrArray(resolved)
      ) {
        rawValue = resolved
      }
    } catch (err) {
      console.warn('[Copy] Error accessing nested field:', err)
      rawValue = null
    }
  }

  // Approach 3: if the raw value is an object/array, prefer the rendered cell text
  // because copying the raw relation object would produce "[object Object]".
  if (
    rawValue &&
    typeof rawValue === 'object' &&
    !(rawValue instanceof Date) &&
    domText
  ) {
    rawValue = domText
  }

  // Approach 4: fall back to the rendered cell text (what the user actually sees).
  // Needed when the column display uses renderHtml that resolves a different
  // relation key than colDef.field (e.g. data under `m_unit_bisni` while the
  // column key is `m_unit_bisnis`), otherwise copy yields an empty "-".
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    if (domText) {
      rawValue = domText
    }
  }

  // Get display value
  let displayValue = rawValue
  if (displayValue === null || displayValue === undefined || displayValue === '') {
    displayValue = '-'
  } else {
    // Format date values to DD/MM/YYYY if it matches YYYY-MM-DD or YYYY/MM/DD pattern
    const colConfig = props.columns?.find((c: any) => c.key === field)
    const isDateColumn = colConfig?.filterType === 'date'
    if (isDateColumn || (typeof displayValue === 'string' && /^(\d{4})[-/](\d{2})[-/](\d{2})(?:T|\s|$)/.test(displayValue))) {
      const match = String(displayValue).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/)
      if (match) {
        displayValue = `${match[3]}/${match[2]}/${match[1]}`
      }
    }
  }

  // Copy to clipboard
  const textToCopy = String(displayValue)

  copyTextToClipboard(textToCopy).then(() => {
    toast.success(`FIELD ${headerName.toUpperCase()} = ${textToCopy} BERHASIL DI COPY`, {
      duration: 2000
    })
  }).catch((err) => {
    console.error('[Copy] Clipboard error:', err)
    toast.error('Gagal menyalin ke clipboard')
  })
}

// Clear selection
const clearSelection = () => {
  gridApi.value?.deselectAll()
  selectedRowId.value = null
  selectedRowData.value = null
  selectedRowIndex.value = null
}

// Get selected data
const getSelectedRowData = () => selectedRowData.value
const getSelectedRowIndex = () => selectedRowIndex.value
const getSelectedRowId = () => selectedRowId.value
const getSelectedRows = () => gridApi.value?.getSelectedRows() || []

// Expose methods for compatibility with old DataTable API
defineExpose({
  clearSelection,
  getSelectedRowData,
  getSelectedRowIndex,
  getSelectedRowId,
  getSelectedRows,
  gridApi,
  columnFilters,
  dateRangeFilters,
  tableContainer: ref(null), // For compatibility
  selectRow: (item: T, index: number) => {
    if (gridApi.value) {
      gridApi.value.forEachNode((node) => {
        if (node.data === item || node.rowIndex === index) {
          node.setSelected(true)
        }
      })
    }
  },
  resetFilters: () => {
    clearAllFilters()
  },
  getFilters: () => {
    return gridApi.value?.getFilterModel() || {}
  },
  buildApiFilterParams: () => ({}),
  refreshData: () => {
    // DEFAULT: Always emit refresh event
    emit('refreshRequested')
    // Also refresh cells for visual update
    gridApi.value?.refreshCells()
  }
})
</script>

<template>
  <div class="w-full max-w-full min-w-0 border rounded-lg overflow-hidden bg-background flex flex-col">
    <!-- Scrollable container for AG Grid -->
    <div class="w-full overflow-x-auto overflow-y-auto relative flex-1 min-w-0" :style="{ maxHeight: maxHeight }">
      <!-- AG Grid with custom filter row -->
      <div :class="[
        'w-full',
        'ag-theme-quartz',
        'dark:ag-theme-quartz-dark'
      ]" :style="{
          height: showPagination ? 'auto' : '100%',
          minHeight: showPagination ? '200px' : undefined,
          '--ag-row-hover-bg': `rgba(${hexToRgb(primaryColor)}, 0.12)`,
          '--ag-row-selected-bg': `rgba(${hexToRgb(primaryColor)}, 0.25)`
        }">
        <AgGridVue :columnDefs="columnDefs" :rowData="paginatedData" :defaultColDef="defaultColDef"
          :gridOptions="gridOptions" :rowSelection="rowSelectionConfig" :loading="loading" :domLayout="showPagination ? 'autoHeight' : 'normal'" :theme="gridTheme"
          :enableBrowserTooltips="true"
          :enableCellTextSelection="true"
          :noRowsOverlayComponent="noRowsOverlay" :loadingOverlayComponent="'agLoadingOverlay'" :headerHeight="40"
          :rowHeight="props.rowHeight" :suppressRowHoverHighlight="false" :getRowClass="getRowClass"
          @grid-ready="onGridReady" @selection-changed="onSelectionChanged" @row-clicked="onRowClicked" @filter-changed="onFilterChanged"
          @body-scroll="onBodyScroll" @cell-context-menu="onCellContextMenu" :preventDefaultOnContextMenu="true"
          class="w-full h-full" />
      </div>
    </div>

    <!-- Pagination Controls - Always show when pagination enabled -->
    <div v-if="showPagination" class="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
      <div class="flex items-center gap-3">
        <!-- Page size selector -->
        <div class="flex items-center gap-2">
          <label class="text-sm text-muted-foreground">Show</label>
          <select :value="effectivePageSize"
            @change="handlePageSizeChange(Number(($event.target as HTMLSelectElement).value))"
            class="h-8 px-2 py-1 text-sm border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <label class="text-sm text-muted-foreground">entries</label>
        </div>

        <!-- Showing info -->
        <div class="text-sm text-muted-foreground">
          <template v-if="effectiveTotalItems > 0">
            Showing {{ ((effectiveCurrentPage - 1) * effectivePageSize) + 1 }} to {{ Math.min(effectiveCurrentPage *
              effectivePageSize, effectiveTotalItems) }} of {{ effectiveTotalItems }}
          </template>
          <template v-else>
            No entries to display
          </template>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="effectiveCurrentPage <= 1 || loading"
          @click="handleInternalPageChange(effectiveCurrentPage - 1)">
          <component :is="LucideIcons.ChevronLeft" class="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div class="flex items-center gap-1">
          <span class="text-sm font-medium">Page {{ effectiveCurrentPage }} of {{ effectiveTotalPages }}</span>
        </div>

        <Button variant="outline" size="sm" :disabled="effectiveCurrentPage >= effectiveTotalPages || loading"
          @click="handleInternalPageChange(effectiveCurrentPage + 1)">
          Next
          <component :is="LucideIcons.ChevronRight" class="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Row hover and selection styling */
:deep(.ag-row) {
  transition: background-color 0.15s ease;
}

/* Row hover state */
:deep(.ag-row:hover) {
  background-color: var(--ag-row-hover-bg, rgba(66, 133, 244, 0.15));
}

/* Row selected state */
:deep(.ag-row.ag-row-selected) {
  background-color: transparent;
  font-weight: 500;
}



/* Dark mode - white border for focused cell */
.dark :deep(.ag-cell.ag-cell-focus) {
  outline: 2px solid #ffffff !important;
}

/* Cell styling - allow overflow for images and action controls */
:deep(.ag-cell) {
  overflow: visible !important;
  padding: 8px 12px !important;
}

:deep(.ag-cell.ag-cell-text-truncate) {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

:deep(.ag-cell.ag-cell-text-truncate .ag-cell-wrapper) {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

:deep(.ag-cell.ag-cell-text-truncate .ag-cell-value) {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  display: block !important;
  line-height: inherit;
}

/* Cell content wrapper - inherit text-align from parent */
:deep(.ag-cell-value) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

/* Spanned cells - center vertically and horizontally */
:deep(.ag-cell[rowspan]) {
  vertical-align: middle !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

:deep(.ag-cell[rowspan] .ag-cell-value) {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

:deep(.ag-cell[rowspan] .ag-cell-wrapper) {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* Cell alignment based on cellStyle textAlign */
:deep(.ag-cell[style*="text-align: left"]) .ag-cell-value,
:deep(.ag-cell[style*="text-align:left"]) .ag-cell-value {
  justify-content: flex-start;
  text-align: left !important;
}

:deep(.ag-cell[style*="text-align: center"]) .ag-cell-value,
:deep(.ag-cell[style*="text-align:center"]) .ag-cell-value {
  justify-content: center;
  text-align: center !important;
}

:deep(.ag-cell[style*="text-align: right"]) .ag-cell-value,
:deep(.ag-cell[style*="text-align:right"]) .ag-cell-value {
  justify-content: flex-end;
  text-align: right !important;
}

/* Header alignment classes */
:deep(.ag-header-cell-left .ag-header-cell-label) {
  justify-content: flex-start;
}

:deep(.ag-header-cell-center .ag-header-cell-label) {
  justify-content: center;
}

:deep(.ag-header-cell-right .ag-header-cell-label) {
  justify-content: flex-end;
}

/* Image styling */
:deep(.ag-cell img) {
  max-height: 100%;
  max-width: 100%;
  cursor: pointer;
  pointer-events: auto;
}

/* Make all interactive elements inside cells clickable */
:deep(.ag-cell button),
:deep(.ag-cell a),
:deep(.ag-cell img) {
  pointer-events: auto;
}

/* Floating filter row & input styling */
:deep(.ag-floating-filter) {
  padding: 2px 4px !important;
}

:deep(.ag-floating-filter-body) {
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
}

:deep(.ag-floating-filter-input) {
  width: 100% !important;
  height: 28px !important;
  display: flex !important;
  align-items: center !important;
}

:deep(.ag-floating-filter-input input),
:deep(.ag-floating-filter-input input[type="search"]),
:deep(.ag-floating-filter-input input[type="text"]) {
  width: 100% !important;
  height: 26px !important;
  background-color: #ffffff !important;
  color: #111827 !important;
  border: 1px solid #d1d5db !important;
  border-radius: 6px !important;
  padding: 2px 20px 2px 8px !important;
  font-size: 12px !important;
  outline: none !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
}

:deep(.ag-floating-filter-input input:focus),
:deep(.ag-floating-filter-input input[type="search"]:focus),
:deep(.ag-floating-filter-input input[type="text"]:focus) {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
}

/* Style WebKit search cancel button (X clear button inside floating filter inputs) */
:deep(.ag-floating-filter-input input[type="search"]::-webkit-search-cancel-button) {
  -webkit-appearance: searchfield-cancel-button;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

:deep(.ag-floating-filter-input input[type="search"]::-webkit-search-cancel-button:hover) {
  opacity: 1;
}
</style>

<!-- Non-scoped styles for dark mode floating filter - .dark selector cannot pierce scoped boundary -->
<style>
.dark .ag-floating-filter-input input,
.dark .ag-floating-filter-input input[type="search"],
.dark .ag-floating-filter-input input[type="text"] {
  background-color: #0f172a !important;
  color: #f8fafc !important;
  border-color: #334155 !important;
}

.dark .ag-floating-filter-input input:focus,
.dark .ag-floating-filter-input input[type="search"]:focus,
.dark .ag-floating-filter-input input[type="text"]:focus {
  border-color: #60a5fa !important;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2) !important;
}
</style>
