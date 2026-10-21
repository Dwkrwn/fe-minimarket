import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface WilayahItem {
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
  m_wilayah_details?: any[]
  m_wilayah_details2?: any[]
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

export interface WilayahListResponse {
  status: string
  data: WilayahItem[]
  pagination: Pagination
}

export interface WilayahCustomerCountItem {
  wilayah: string
  total: number
}

export interface WilayahCustomerCountResponse {
  status: string
  meta: {
    group_by: 'provinsi' | 'kota' | 'kecamatan'
    m_unit_bisnis_id: string | null
    total_customers: number
    total_wilayah: number
  }
  data: WilayahCustomerCountItem[]
  unit_bisnis_options?: Array<{
    id: string
    nama_comp: string
    total_customers: number
  }>
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_wilayah data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_wilayah list
 */
export async function getWilayahList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<WilayahListResponse> {
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
  
  return apiCall<WilayahListResponse>(`/dynamic/m_wilayah?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Wilayah by ID
 * @param id - Wilayah ID
 * @returns Promise with m_wilayah detail
 */
export async function getWilayahById(id: string): Promise<{ status: string; data: WilayahItem }> {
  return apiCall(`/dynamic/m_wilayah/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new Wilayah
 * @param data - m_wilayah data
 * @returns Promise with created Wilayah
 */
export async function createWilayah(data: Partial<WilayahItem>): Promise<{ status: string; data: WilayahItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_wilayah_details || data.m_wilayah_details2)
  const endpoint = hasDetails ? '/dynamic/m_wilayah/with-details' : '/dynamic/m_wilayah'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Wilayah
 * @param id - Wilayah ID
 * @param data - m_wilayah data to update
 * @returns Promise with updated Wilayah
 */
export async function updateWilayah(id: string, data: Partial<WilayahItem>): Promise<{ status: string; data: WilayahItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_wilayah_details || data.m_wilayah_details2)
  const endpoint = hasDetails ? `/dynamic/m_wilayah/with-details/${id}` : `/dynamic/m_wilayah/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Wilayah
 * @param id - Wilayah ID
 * @returns Promise with delete confirmation
 */
export async function deleteWilayah(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_wilayah/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_wilayah data without pagination (for sidebar)
 * @returns Promise with m_wilayah list
 */
export async function getWilayahListNoPagination(): Promise<WilayahListResponse> {
  return apiCall<WilayahListResponse>('/dynamic/m_wilayah?no_pagination=true', {
    method: 'GET'
  })
}

/**
 * Get jumlah customer per wilayah (dari m_customer)
 * @param groupBy - level grouping wilayah
 */
export async function getWilayahCustomerCounts(
  groupBy: 'provinsi' | 'kota' | 'kecamatan' = 'kota',
  unitBisnisId?: string
): Promise<WilayahCustomerCountResponse> {
  const queryParams = new URLSearchParams({ group_by: groupBy })
  if (unitBisnisId && unitBisnisId.trim()) {
    queryParams.append('m_unit_bisnis_id', unitBisnisId.trim())
  }

  return apiCall<WilayahCustomerCountResponse>(`/fn/m_customer/getWilayahCustomerCounts?${queryParams.toString()}`, {
    method: 'GET'
  })
}
