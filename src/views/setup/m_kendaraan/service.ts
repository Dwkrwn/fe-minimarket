import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface KendaraanItem {
  id: string
  kode_kendaraan?: string | null
  jenis_kendaraan_id: string
  nama_kendaraan: string
  no_polisi: string
  no_stnk?: string | null
  no_mesin?: string | null
  no_kir?: string | null
  tgl_exp_stnk?: string | null
  tgl_exp_kir?: string | null
  aset_kendaraan?: number | null
  m_unit_bisnis_id?: string | null
  is_active?: boolean
  catatan?: string | null
  createdAt: string
  updatedAt: string
  jenis_kendaraan?: {
    id: string
    value1: string
  }
  m_unit_bisni?: {
    id: string
    nama_comp: string
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

export interface KendaraanListResponse {
  status: string
  data: KendaraanItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_kendaraan data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_kendaraan list
 */
export async function getKendaraanList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  companyId?: string
): Promise<KendaraanListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_general@jenis_kendaraan:value1|id,m_unit_bisnis:nama_comp|id' // Include jenis_kendaraan and unit_bisnis
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
  
  return apiCall<KendaraanListResponse>(`/dynamic/m_kendaraan?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Kendaraan by ID
 * @param id - Kendaraan ID
 * @returns Promise with m_kendaraan detail
 */
export async function getKendaraanById(id: string): Promise<{ status: string; data: KendaraanItem }> {
  const queryParams = new URLSearchParams({
    include: 'm_general@jenis_kendaraan:value1|id'
  })
  return apiCall(`/dynamic/m_kendaraan/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Kendaraan
 * @param data - m_kendaraan data
 * @returns Promise with created Kendaraan
 */
export async function createKendaraan(data: Partial<KendaraanItem>): Promise<{ status: string; data: KendaraanItem }> {
  return apiCall('/dynamic/m_kendaraan', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update existing Kendaraan
 * @param id - Kendaraan ID
 * @param data - Updated m_kendaraan data
 * @returns Promise with updated Kendaraan
 */
export async function updateKendaraan(id: string, data: Partial<KendaraanItem>): Promise<{ status: string; data: KendaraanItem }> {
  return apiCall(`/dynamic/m_kendaraan/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Kendaraan
 * @param id - Kendaraan ID
 * @returns Promise with delete result
 */
export async function deleteKendaraan(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_kendaraan/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all Kendaraan without pagination
 * @returns Promise with all m_kendaraan
 */
export async function getKendaraanListNoPagination(): Promise<KendaraanListResponse> {
  const queryParams = new URLSearchParams({
    no_pagination: 'true',
    include: 'm_general@jenis_kendaraan:value1|id'
  })
  return apiCall<KendaraanListResponse>(`/dynamic/m_kendaraan?${queryParams}`, {
    method: 'GET'
  })
}
