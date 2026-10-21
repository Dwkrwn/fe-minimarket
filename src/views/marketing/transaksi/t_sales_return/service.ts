import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SalesReturnItem {
  id: string
  group: string
  key1: string
  code: string
  value1: string
  value2: string
  value3: string
  value4: string
  value5: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Detail items (optional - only if module has details)
  t_sales_return_details?: any[]
  t_sales_return_details2?: any[]
}

export interface Pagination {
  total: number
  page: number
  totalPages: number
  limit: number
  currentRowsCount: number
  next_page: number | null
  prev_page: number | null
}

export interface SalesReturnListResponse {
  status: string
  data: SalesReturnItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sales_return data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sales_return list
 */
export async function getSalesReturnList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string
): Promise<SalesReturnListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  // Add column filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value)
      }
    })
  }

  // Add filter operators
  if (filterOperators) {
    Object.entries(filterOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value)
      }
    })
  }

  // Add where clause for date range filters
  if (where) {
    queryParams.append('where', where)
  }
  
  return apiCall<SalesReturnListResponse>(`/dynamic/t_sales_return?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SalesReturn by ID
 * @param id - SalesReturn ID
 * @returns Promise with t_sales_return detail
 */
export async function getSalesReturnById(id: string): Promise<{ status: string; data: SalesReturnItem }> {
  return apiCall(`/dynamic/t_sales_return/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new SalesReturn
 * @param data - t_sales_return data
 * @returns Promise with created SalesReturn
 */
export async function createSalesReturn(data: Partial<SalesReturnItem>): Promise<{ status: string; data: SalesReturnItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_return_details || data.t_sales_return_details2)
  const endpoint = hasDetails ? '/dynamic/t_sales_return/with-details' : '/dynamic/t_sales_return'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SalesReturn
 * @param id - SalesReturn ID
 * @param data - t_sales_return data to update
 * @returns Promise with updated SalesReturn
 */
export async function updateSalesReturn(id: string, data: Partial<SalesReturnItem>): Promise<{ status: string; data: SalesReturnItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_return_details || data.t_sales_return_details2)
  const endpoint = hasDetails ? `/dynamic/t_sales_return/with-details/${id}` : `/dynamic/t_sales_return/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SalesReturn
 * @param id - SalesReturn ID
 * @returns Promise with delete confirmation
 */
export async function deleteSalesReturn(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_sales_return/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_sales_return data without pagination (for sidebar)
 * @returns Promise with t_sales_return list
 */
export async function getSalesReturnListNoPagination(): Promise<SalesReturnListResponse> {
  return apiCall<SalesReturnListResponse>('/dynamic/t_sales_return?no_pagination=true', {
    method: 'GET'
  })
}
