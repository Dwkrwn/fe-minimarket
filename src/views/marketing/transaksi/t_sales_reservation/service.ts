import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SalesReservationItem {
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
  field_name?: string
  field_code?: string
  field1?: string
  nested?: { value1?: string }
  // Detail items (optional - only if module has details)
  t_sales_reservation_details?: any[]
  t_sales_reservation_details2?: any[]
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

export interface SalesReservationListResponse {
  status: string
  data: SalesReservationItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sales_reservation data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sales_reservation list
 */
export async function getSalesReservationList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<SalesReservationListResponse> {
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
  
  return apiCall<SalesReservationListResponse>(`/dynamic/t_sales_reservation?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SalesReservation by ID
 * @param id - SalesReservation ID
 * @returns Promise with t_sales_reservation detail
 */
export async function getSalesReservationById(id: string): Promise<{ status: string; data: SalesReservationItem }> {
  return apiCall(`/dynamic/t_sales_reservation/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new SalesReservation
 * @param data - t_sales_reservation data
 * @returns Promise with created SalesReservation
 */
export async function createSalesReservation(data: Partial<SalesReservationItem>): Promise<{ status: string; data: SalesReservationItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_reservation_details || data.t_sales_reservation_details2)
  const endpoint = hasDetails ? '/dynamic/t_sales_reservation/with-details' : '/dynamic/t_sales_reservation'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SalesReservation
 * @param id - SalesReservation ID
 * @param data - t_sales_reservation data to update
 * @returns Promise with updated SalesReservation
 */
export async function updateSalesReservation(id: string, data: Partial<SalesReservationItem>): Promise<{ status: string; data: SalesReservationItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_reservation_details || data.t_sales_reservation_details2)
  const endpoint = hasDetails ? `/dynamic/t_sales_reservation/with-details/${id}` : `/dynamic/t_sales_reservation/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SalesReservation
 * @param id - SalesReservation ID
 * @returns Promise with delete confirmation
 */
export async function deleteSalesReservation(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_sales_reservation/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_sales_reservation data without pagination (for sidebar)
 * @returns Promise with t_sales_reservation list
 */
export async function getSalesReservationListNoPagination(): Promise<SalesReservationListResponse> {
  return apiCall<SalesReservationListResponse>('/dynamic/t_sales_reservation?no_pagination=true', {
    method: 'GET'
  })
}
