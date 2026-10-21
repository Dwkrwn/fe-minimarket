import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface GudangItem {
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
  m_gudang_details?: any[]
  m_gudang_details2?: any[]
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

export interface GudangListResponse {
  status: string
  data: GudangItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_gudang data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_gudang list
 */
export async function getGudangList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<GudangListResponse> {
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
  
  return apiCall<GudangListResponse>(`/dynamic/m_gudang?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Gudang by ID
 * @param id - Gudang ID
 * @returns Promise with m_gudang detail
 */
export async function getGudangById(id: string): Promise<{ status: string; data: GudangItem }> {
  return apiCall(`/dynamic/m_gudang/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new Gudang
 * @param data - m_gudang data
 * @returns Promise with created Gudang
 */
export async function createGudang(data: Partial<GudangItem>): Promise<{ status: string; data: GudangItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_gudang_details || data.m_gudang_details2)
  const endpoint = hasDetails ? '/dynamic/m_gudang/with-details' : '/dynamic/m_gudang'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Gudang
 * @param id - Gudang ID
 * @param data - m_gudang data to update
 * @returns Promise with updated Gudang
 */
export async function updateGudang(id: string, data: Partial<GudangItem>): Promise<{ status: string; data: GudangItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_gudang_details || data.m_gudang_details2)
  const endpoint = hasDetails ? `/dynamic/m_gudang/with-details/${id}` : `/dynamic/m_gudang/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Gudang
 * @param id - Gudang ID
 * @returns Promise with delete confirmation
 */
export async function deleteGudang(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_gudang/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_gudang data without pagination (for sidebar)
 * @returns Promise with m_gudang list
 */
export async function getGudangListNoPagination(): Promise<GudangListResponse> {
  return apiCall<GudangListResponse>('/dynamic/m_gudang?no_pagination=true', {
    method: 'GET'
  })
}
