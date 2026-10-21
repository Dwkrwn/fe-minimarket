import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SalesCloseItem {
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
  status?: string
  details?: SalesCloseDetailItem[]
  field_name?: string
  field_code?: string
  field1?: string
  nested?: { value1?: string }
  // Detail items (optional - only if module has details)
  t_sales_close_details?: any[]
  t_sales_close_details2?: any[]
}

export interface SalesCloseDetailItem {
  id?: string
  [key: string]: unknown
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

export interface SalesCloseListResponse {
  status: string
  data: SalesCloseItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sales_close data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sales_close list
 */
export async function getSalesCloseList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<SalesCloseListResponse> {
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
  
  return apiCall<SalesCloseListResponse>(`/dynamic/t_sales_close?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SalesClose by ID
 * @param id - SalesClose ID
 * @returns Promise with t_sales_close detail
 */
export async function getSalesCloseById(id: string): Promise<{ status: string; data: SalesCloseItem }> {
  return apiCall(`/dynamic/t_sales_close/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new SalesClose
 * @param data - t_sales_close data
 * @returns Promise with created SalesClose
 */
export async function createSalesClose(data: Partial<SalesCloseItem>): Promise<{ status: string; data: SalesCloseItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_close_details || data.t_sales_close_details2)
  const endpoint = hasDetails ? '/dynamic/t_sales_close/with-details' : '/dynamic/t_sales_close'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SalesClose
 * @param id - SalesClose ID
 * @param data - t_sales_close data to update
 * @returns Promise with updated SalesClose
 */
export async function updateSalesClose(id: string, data: Partial<SalesCloseItem>): Promise<{ status: string; data: SalesCloseItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_close_details || data.t_sales_close_details2)
  const endpoint = hasDetails ? `/dynamic/t_sales_close/with-details/${id}` : `/dynamic/t_sales_close/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SalesClose
 * @param id - SalesClose ID
 * @returns Promise with delete confirmation
 */
export async function deleteSalesClose(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_sales_close/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_sales_close data without pagination (for sidebar)
 * @returns Promise with t_sales_close list
 */
export async function getSalesCloseListNoPagination(): Promise<SalesCloseListResponse> {
  return apiCall<SalesCloseListResponse>('/dynamic/t_sales_close?no_pagination=true', {
    method: 'GET'
  })
}
