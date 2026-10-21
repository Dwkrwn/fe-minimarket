import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface KaryItem {
  id: string
  nama_kary: string
  kode_kary?: string
  tgl_lhr?: string
  tempat_lhr?: string
  jenis_kelamin?: string
  status_kawin?: string
  no_ktp?: string
  no_tlp?: string
  email?: string
  company_id?: string
  jabatan_id?: string
  m_unit_bisnis_id?: string
  foto_ktp?: string
  catatan?: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  posisi?: {
    id: string
    value1: string
  }
  m_unit_bisni?: {
    id: string
    nama_comp: string
  }
  m_company?: {
    id: string
    nama: string
    kode?: string
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

export interface KaryListResponse {
  status: string
  data: KaryItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_kary data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param unitBisnisId - Filter by unit bisnis ID
 * @returns Promise with m_kary list
 */
export async function getKaryList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  unitBisnisId?: string
): Promise<KaryListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true',
    include: 'm_general@posisi:value1|id,m_unit_bisnis:nama_comp|id,m_company:nama|kode|id'
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  // Filter by unit bisnis if provided (for non-super admin)
  if (unitBisnisId) {
    queryParams.append('filter_column_m_unit_bisnis_id', unitBisnisId)
  }
  
  return apiCall<KaryListResponse>(`/dynamic/m_kary?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Kary by ID
 * @param id - Kary ID
 * @returns Promise with m_kary detail
 */
export async function getKaryById(id: string): Promise<{ status: string; data: KaryItem }> {
  const queryParams = new URLSearchParams({
    join: 'true',
    include: 'm_general@posisi:value1|id,m_unit_bisnis:nama_comp|id,m_company:nama|kode|id'
  })

  return apiCall(`/dynamic/m_kary/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Kary
 * @param data - m_kary data
 * @returns Promise with created Kary
 */
export async function createKary(data: Partial<KaryItem>): Promise<{ status: string; data: KaryItem }> {
  return apiCall('/dynamic/m_kary', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Kary
 * @param id - Kary ID
 * @param data - m_kary data to update
 * @returns Promise with updated Kary
 */
export async function updateKary(id: string, data: Partial<KaryItem>): Promise<{ status: string; data: KaryItem }> {
  return apiCall(`/dynamic/m_kary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Kary
 * @param id - Kary ID
 * @returns Promise with delete confirmation
 */
export async function deleteKary(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_kary/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_kary data without pagination (for sidebar)
 * @returns Promise with m_kary list
 */
export async function getKaryListNoPagination(): Promise<KaryListResponse> {
  return apiCall<KaryListResponse>('/dynamic/m_kary?no_pagination=true', {
    method: 'GET'
  })
}
