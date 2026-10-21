import { ref } from 'vue'

export interface TableFilterChangePayload {
  column: Record<string, string>
  operator: Record<string, string>
  dateRange: Record<string, { from: string; to: string }>
  where: string
}

/**
 * Composable untuk manage default filters di data table
 * Memudahkan setup filter yang otomatis di-apply ke API backend
 *
 * @param onReload Callback yang dipanggil saat filter berubah (biasanya reset ke page 1 & fetch data baru)
 * @param debounceMs Delay debounce dalam milidetik (default: 400ms)
 */
export const useDataTableFilters = (
  onReload?: (filters?: TableFilterChangePayload) => void | Promise<void>,
  debounceMs: number = 400
) => {
  // Filter column values
  const tableColumnFilters = ref<Record<string, string>>({})
  
  // Filter operators (e.g., '~*' for ILIKE, '=' for exact match)
  const tableColumnFilterOperators = ref<Record<string, string>>({})
  
  // Date range filters
  const tableDateRangeFilters = ref<Record<string, { from: string; to: string }>>({})

  // WHERE clause untuk complex filtering (e.g., date ranges dengan format API)
  const tableWhereClause = ref<string>('')
  const whereClause = tableWhereClause

  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Event handler yang langsung dipasang pada <DataTable @filter-change="handleTableFilterChange">
   */
  const handleTableFilterChange = (
    filters: TableFilterChangePayload,
    customReload?: () => void | Promise<void>
  ) => {
    tableColumnFilters.value = { ...(filters.column || {}) }
    tableColumnFilterOperators.value = { ...(filters.operator || {}) }
    tableDateRangeFilters.value = { ...(filters.dateRange || {}) }
    tableWhereClause.value = filters.where || ''

    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
    filterDebounceTimer = setTimeout(async () => {
      const cb = customReload || onReload
      if (cb) {
        await cb(filters)
      }
    }, debounceMs)
  }

  /**
   * Set single filter value dengan operator
   * @param columnKey - Column key dari column definition
   * @param value - Filter value
   * @param operator - Filter operator (default: '~*' untuk ILIKE pattern match)
   */
  const setFilter = (columnKey: string, value: string, operator: string = '~*') => {
    tableColumnFilters.value[columnKey] = value
    tableColumnFilterOperators.value[columnKey] = operator
  }

  /**
   * Set multiple filters sekaligus
   * @param filters - Object dengan { [columnKey]: value }
   * @param operators - Object dengan { [columnKey]: operator } (opsional)
   * @param where - WHERE clause string untuk complex filtering (opsional)
   */
  const setFilters = (
    filters: Record<string, string>,
    operators?: Record<string, string>,
    where?: string
  ) => {
    tableColumnFilters.value = filters
    tableColumnFilterOperators.value = operators || {}
    tableWhereClause.value = where || ''
  }

  /**
   * Clear filter untuk column tertentu
   * @param columnKey - Column key untuk di-clear
   */
  const clearFilter = (columnKey: string) => {
    delete tableColumnFilters.value[columnKey]
    delete tableColumnFilterOperators.value[columnKey]
  }

  /**
   * Clear semua filters
   */
  const clearAllFilters = () => {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
    tableColumnFilters.value = {}
    tableColumnFilterOperators.value = {}
    tableDateRangeFilters.value = {}
    tableWhereClause.value = ''
  }

  const resetFilters = clearAllFilters

  /**
   * Set WHERE clause untuk complex filtering
   * @param where - WHERE clause string (e.g., 'tgl_po>=2025-11-01|tgl_po<2026-01-01')
   */
  const setWhereClause = (where: string) => {
    tableWhereClause.value = where
  }

  /**
   * Get current filter state
   */
  const getFilters = () => ({
    column: { ...tableColumnFilters.value },
    operator: { ...tableColumnFilterOperators.value },
    dateRange: { ...tableDateRangeFilters.value },
    where: tableWhereClause.value
  })

  /**
   * Check apakah ada active filters
   */
  const hasActiveFilters = () => {
    return (
      Object.keys(tableColumnFilters.value).length > 0 ||
      Object.keys(tableDateRangeFilters.value).filter(
        key => {
          const filter = tableDateRangeFilters.value[key]
          return filter && (filter.from || filter.to)
        }
      ).length > 0 ||
      tableWhereClause.value.length > 0
    )
  }

  /**
   * Append filter params ke URLSearchParams atau plain object
   */
  const appendFilterParams = (target: URLSearchParams | Record<string, any>) => {
    applyFilterQueryParams(
      target,
      tableColumnFilters.value,
      tableColumnFilterOperators.value,
      tableWhereClause.value
    )
  }

  return {
    // State
    tableColumnFilters,
    tableColumnFilterOperators,
    tableDateRangeFilters,
    tableWhereClause,
    whereClause,
    // Methods
    handleTableFilterChange,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    resetFilters,
    setWhereClause,
    getFilters,
    hasActiveFilters,
    appendFilterParams
  }
}

/**
 * Utility helper untuk apply filter parameters ke URLSearchParams atau object query params
 */
export function applyFilterQueryParams(
  target: URLSearchParams | Record<string, any>,
  filters?: Record<string, any>,
  filterOperators?: Record<string, any>,
  where?: string
) {
  if (target instanceof URLSearchParams) {
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          target.append(`filter_column_${key}`, String(val).trim())
        }
      })
    }
    if (filterOperators) {
      Object.entries(filterOperators).forEach(([key, val]) => {
        if (val) {
          target.append(`filter_operator_${key}`, String(val).trim())
        }
      })
    }
    if (where && where.trim()) {
      target.append('where', where.trim())
    }
  } else if (typeof target === 'object' && target !== null) {
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          target[`filter_column_${key}`] = String(val).trim()
        }
      })
    }
    if (filterOperators) {
      Object.entries(filterOperators).forEach(([key, val]) => {
        if (val) {
          target[`filter_operator_${key}`] = String(val).trim()
        }
      })
    }
    if (where && where.trim()) {
      target['where'] = where.trim()
    }
  }
}

/**
 * Predefined filter operators untuk convenience
 */
export const FILTER_OPERATORS = {
  // Text operators
  ILIKE: '~*',          // Case-insensitive pattern match
  EXACT: '=',           // Exact match
  NOT_EQUAL: '<>',      // Not equal
  
  // Numeric operators
  GREATER: '>',
  LESS: '<',
  GREATER_EQUAL: '>=',
  LESS_EQUAL: '<=',
  
  // Boolean operators
  IN: 'in',             // Match any value in array
  NOT_IN: 'not in'      // Exclude values in array
}
