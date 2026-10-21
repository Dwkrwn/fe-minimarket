import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface UnitBisnisItem {
  id: string
  company_id?: string | null
  kode_unit_bisnis: string | null
  nama_comp: string
  provinsi: string
  kota: string
  kecamatan: string | null
  kodepos: number | null
  alamat_detail?: string | null
  email: string | null
  pic: string | null
  no_telp_pic: string | null
  catatan: string | null
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_company?: {
    id: string
    nama: string
    kode?: string | null
  } | null
  // Detail items (optional - only if module has details)
  m_unit_bisnis_details?: any[]
  m_unit_bisnis_details2?: any[]
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

export interface UnitBisnisListResponse {
  status: string
  data: UnitBisnisItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_unit_bisnis data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_unit_bisnis list
 */
export async function getUnitBisnisList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<UnitBisnisListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true'
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  return apiCall<UnitBisnisListResponse>(`/dynamic/m_unit_bisnis?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get UnitBisnis by ID
 * @param id - UnitBisnis ID
 * @returns Promise with m_unit_bisnis detail
 */
export async function getUnitBisnisById(id: string): Promise<{ status: string; data: UnitBisnisItem }> {
  return apiCall(`/dynamic/m_unit_bisnis/${id}?join=true`, {
    method: 'GET'
  })
}

/**
 * Create new UnitBisnis
 * @param data - m_unit_bisnis data
 * @returns Promise with created UnitBisnis
 */
export async function createUnitBisnis(data: Partial<UnitBisnisItem>): Promise<{ status: string; data: UnitBisnisItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_unit_bisnis_details || data.m_unit_bisnis_details2)
  const endpoint = hasDetails ? '/dynamic/m_unit_bisnis/with-details' : '/dynamic/m_unit_bisnis'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update UnitBisnis
 * @param id - UnitBisnis ID
 * @param data - m_unit_bisnis data to update
 * @returns Promise with updated UnitBisnis
 */
export async function updateUnitBisnis(id: string, data: Partial<UnitBisnisItem>): Promise<{ status: string; data: UnitBisnisItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_unit_bisnis_details || data.m_unit_bisnis_details2)
  const endpoint = hasDetails ? `/dynamic/m_unit_bisnis/with-details/${id}` : `/dynamic/m_unit_bisnis/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete UnitBisnis
 * @param id - UnitBisnis ID
 * @returns Promise with delete confirmation
 */
export async function deleteUnitBisnis(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_unit_bisnis/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_unit_bisnis data without pagination (for sidebar)
 * @returns Promise with m_unit_bisnis list
 */
export async function getUnitBisnisListNoPagination(): Promise<UnitBisnisListResponse> {
  return apiCall<UnitBisnisListResponse>('/dynamic/m_unit_bisnis?no_pagination=true&join=true', {
    method: 'GET'
  })
}
