import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SalesOrderItem {
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
  detail_items?: any[]
  field_name?: string
  field_code?: string
  field1?: string
  nested?: { value1?: string }
  // Detail items (optional - only if module has details)
  t_sales_order_details?: any[]
  t_sales_order_details2?: any[]
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

export interface SalesOrderListResponse {
  status: string
  data: SalesOrderItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sales_order data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sales_order list
 */
export async function getSalesOrderList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<SalesOrderListResponse> {
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
  
  return apiCall<SalesOrderListResponse>(`/dynamic/t_sales_order?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SalesOrder by ID
 * @param id - SalesOrder ID
 * @returns Promise with t_sales_order detail
 */
export async function getSalesOrderById(id: string): Promise<{ status: string; data: SalesOrderItem }> {
  return apiCall(`/dynamic/t_sales_order/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new SalesOrder
 * @param data - t_sales_order data
 * @returns Promise with created SalesOrder
 */
export async function createSalesOrder(data: Partial<SalesOrderItem>): Promise<{ status: string; data: SalesOrderItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_order_details || data.t_sales_order_details2)
  const endpoint = hasDetails ? '/dynamic/t_sales_order/with-details' : '/dynamic/t_sales_order'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SalesOrder
 * @param id - SalesOrder ID
 * @param data - t_sales_order data to update
 * @returns Promise with updated SalesOrder
 */
export async function updateSalesOrder(id: string, data: Partial<SalesOrderItem>): Promise<{ status: string; data: SalesOrderItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_order_details || data.t_sales_order_details2)
  const endpoint = hasDetails ? `/dynamic/t_sales_order/with-details/${id}` : `/dynamic/t_sales_order/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SalesOrder
 * @param id - SalesOrder ID
 * @returns Promise with delete confirmation
 */
export async function deleteSalesOrder(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_sales_order/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_sales_order data without pagination (for sidebar)
 * @returns Promise with t_sales_order list
 */
export async function getSalesOrderListNoPagination(): Promise<SalesOrderListResponse> {
  return apiCall<SalesOrderListResponse>('/dynamic/t_sales_order?no_pagination=true', {
    method: 'GET'
  })
}
