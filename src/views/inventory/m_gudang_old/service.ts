import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface GudangItem {
  id?: string
  kode_gudang?: string
  nama_gudang: string
  alamat_gudang: string
  provinsi: string
  kota: string
  kecamatan: string
  kode_pos?: string
  m_unit_bisnis_id?: string
  foto_gudang?: string
  catatan?: string
  is_active?: boolean
  createdAt?: string
  updatedAt?: string
  // Relations (note: API returns m_unit_bisni without 's')
  m_unit_bisni?: {
    id: string
    kode_unit_bisnis?: string
    nama_comp?: string
  }
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
  searchfield?: string,
  companyId?: string
): Promise<GudangListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_unit_bisnis:id|kode_unit_bisnis|nama_comp'
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  // Filter by company if provided (for non-super admin)
  if (companyId) {
    queryParams.append('filter_column_m_unit_bisnis_id', companyId)
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
  return apiCall(`/dynamic/m_gudang/${id}?include=m_unit_bisnis:id|kode_unit_bisnis|nama_comp`, {
    method: 'GET'
  })
}

/**
 * Create new Gudang
 * @param data - m_gudang data
 * @returns Promise with created Gudang
 */
export async function createGudang(data: Partial<GudangItem>): Promise<{ status: string; data: GudangItem }> {
  return apiCall('/dynamic/m_gudang', {
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
  return apiCall(`/dynamic/m_gudang/${id}`, {
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
  return apiCall(`/dynamic/m_gudang/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_gudang data without pagination (for dropdowns)
 * @returns Promise with m_gudang list
 */
export async function getGudangListNoPagination(): Promise<GudangListResponse> {
  return apiCall<GudangListResponse>('/dynamic/m_gudang?no_pagination=true', {
    method: 'GET'
  })
}
