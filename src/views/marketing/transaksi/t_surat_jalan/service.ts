import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SuratJalanItem {
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
  t_surat_jalan_details?: any[]
  t_surat_jalan_details2?: any[]
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

export interface SuratJalanListResponse {
  status: string
  data: SuratJalanItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_surat_jalan data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_surat_jalan list
 */
export async function getSuratJalanList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<SuratJalanListResponse> {
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
  
  return apiCall<SuratJalanListResponse>(`/dynamic/t_surat_jalan?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SuratJalan by ID
 * @param id - SuratJalan ID
 * @returns Promise with t_surat_jalan detail
 */
export async function getSuratJalanById(id: string): Promise<{ status: string; data: SuratJalanItem }> {
  return apiCall(`/dynamic/t_surat_jalan/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new SuratJalan
 * @param data - t_surat_jalan data
 * @returns Promise with created SuratJalan
 */
export async function createSuratJalan(data: Partial<SuratJalanItem>): Promise<{ status: string; data: SuratJalanItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_surat_jalan_details || data.t_surat_jalan_details2)
  const endpoint = hasDetails ? '/dynamic/t_surat_jalan/with-details' : '/dynamic/t_surat_jalan'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SuratJalan
 * @param id - SuratJalan ID
 * @param data - t_surat_jalan data to update
 * @returns Promise with updated SuratJalan
 */
export async function updateSuratJalan(id: string, data: Partial<SuratJalanItem>): Promise<{ status: string; data: SuratJalanItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_surat_jalan_details || data.t_surat_jalan_details2)
  const endpoint = hasDetails ? `/dynamic/t_surat_jalan/with-details/${id}` : `/dynamic/t_surat_jalan/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SuratJalan
 * @param id - SuratJalan ID
 * @returns Promise with delete confirmation
 */
export async function deleteSuratJalan(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_surat_jalan/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_surat_jalan data without pagination (for sidebar)
 * @returns Promise with t_surat_jalan list
 */
export async function getSuratJalanListNoPagination(): Promise<SuratJalanListResponse> {
  return apiCall<SuratJalanListResponse>('/dynamic/t_surat_jalan?no_pagination=true', {
    method: 'GET'
  })
}
