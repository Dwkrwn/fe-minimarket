import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface CoaItem {
  id: string
  m_unit_bisnis_id?: string | null
  kategori_id: string
  has_parent?: boolean
  kode: string
  level: number
  nominal: number
  status: boolean
  tanggal: string
  parent_id: string | null
  nama: string
  tipe_id: string
  catatan: string | null
  createdAt: string
  updatedAt: string
  created_by?: string | null
  updated_by?: string | null
  user_created_by?: {
    id: string
    name?: string
    username?: string
  } | null
  user_updated_by?: {
    id: string
    name?: string
    username?: string
  } | null
  // Nested objects from API (with actual names from JSON response)
  coa_kategori?: {
    id: string
    group: string
    key1: string
    code: string
    value1: string
    is_active: boolean
  }
  coa_tipe?: {
    id: string
    group: string
    key1: string
    code: string
    value1: string
    is_active: boolean
  }
  coa_parent?: {
    id: string
    nama: string
    kode: string
  } | null
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

export interface CoaListResponse {
  status: string
  data: CoaItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_coa data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_coa list
 */
export async function getCoaList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<CoaListResponse> {
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
  
  return apiCall<CoaListResponse>(`/dynamic/m_coa?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Coa by ID
 * @param id - Coa ID
 * @returns Promise with m_coa detail
 */
export async function getCoaById(id: string): Promise<{ status: string; data: CoaItem }> {
  return apiCall(`/dynamic/m_coa/${id}?join=true`, {
    method: 'GET'
  })
}

/**
 * Create new Coa
 * @param data - m_coa data
 * @returns Promise with created Coa
 */
export async function createCoa(data: Partial<CoaItem>): Promise<{ status: string; data: CoaItem }> {
  return apiCall('/dynamic/m_coa', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Coa
 * @param id - Coa ID
 * @param data - m_coa data to update
 * @returns Promise with updated Coa
 */
export async function updateCoa(id: string, data: Partial<CoaItem>): Promise<{ status: string; data: CoaItem }> {
  return apiCall(`/dynamic/m_coa/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Coa
 * @param id - Coa ID
 * @returns Promise with delete confirmation
 */
export async function deleteCoa(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_coa/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_coa data without pagination (for sidebar)
 * @returns Promise with m_coa list
 */
export async function getCoaListNoPagination(): Promise<CoaListResponse> {
  return apiCall<CoaListResponse>('/dynamic/m_coa?no_pagination=true', {
    method: 'GET'
  })
}
