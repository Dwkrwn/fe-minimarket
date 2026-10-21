import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProspekItem {
  id: string
  m_unit_bisnis_id: string | null
  sales_id: string | null
  catatan: string | null
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Relations
  m_unit_bisni?: any // Note: API returns m_unit_bisni (typo in backend)
  sales?: any // m_kary relation
  // Detail items
  m_prospek_ds?: any[]
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

export interface ProspekListResponse {
  status: string
  data: ProspekItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_prospek data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_prospek list
 */
export async function getProspekList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<ProspekListResponse> {
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
  
  // Include relations for unit bisnis and sales
  queryParams.append('include', 'm_unit_bisnis:id|nama_comp,m_kary:id|nama_kary')
  
  return apiCall<ProspekListResponse>(`/dynamic/m_prospek?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Prospek by ID with relations
 * @param id - Prospek ID
 * @returns Promise with m_prospek detail including relations
 */
export async function getProspekById(id: string): Promise<{ status: string; data: ProspekItem }> {
  const includeParams = [
    'm_unit_bisnis:id|nama_comp',
    'm_kary:id|nama_kary',
    'm_prospek_d>m_customer:id|kode_customer|nama_customer|no_ktp|alamat'
  ].join(',')
  
  return apiCall(`/dynamic/m_prospek/${id}?include=${includeParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Prospek
 * @param data - m_prospek data
 * @returns Promise with created Prospek
 */
export async function createProspek(data: Partial<ProspekItem>): Promise<{ status: string; data: ProspekItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_prospek_ds && data.m_prospek_ds.length > 0)
  const endpoint = hasDetails ? '/dynamic/m_prospek/with-details' : '/dynamic/m_prospek'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Prospek
 * @param id - Prospek ID
 * @param data - m_prospek data to update
 * @returns Promise with updated Prospek
 */
export async function updateProspek(id: string, data: Partial<ProspekItem>): Promise<{ status: string; data: ProspekItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_prospek_ds && data.m_prospek_ds.length > 0)
  const endpoint = hasDetails ? `/dynamic/m_prospek/with-details/${id}` : `/dynamic/m_prospek/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Prospek
 * @param id - Prospek ID
 * @returns Promise with delete confirmation
 */
export async function deleteProspek(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_prospek/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_prospek data without pagination (for sidebar)
 * @returns Promise with m_prospek list
 */
export async function getProspekListNoPagination(): Promise<ProspekListResponse> {
  return apiCall<ProspekListResponse>('/dynamic/m_prospek?no_pagination=true', {
    method: 'GET'
  })
}
