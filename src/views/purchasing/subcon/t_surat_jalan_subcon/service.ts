import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SuratJalanSubconItem {
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
  status: string
  is_ekspedisi?: boolean
  ekspedisi_id?: string | null
  tgl_sj_subcon?: string
  no_sj_subcon?: string
  catatan?: string
  m_unit_bisni?: { nama_comp?: string | null; m_company?: { nama?: string | null } | null } | null
  m_unit_bisnis?: { nama?: string | null; nama_comp?: string | null; m_company?: { nama?: string | null } | null } | null
  m_supplier?: { nama_supp?: string | null; nama?: string | null } | null
  supplier?: { nama_supp?: string | null } | null
  m_ekspedisi?: { nama?: string | null } | null
  supir?: string | null
  unit_bisnis?: string | null
  // Detail items (optional - only if module has details)
  t_sj_subcon_ds?: any[]
  t_sj_subcon_ds2?: any[]
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

export interface SuratJalanSubconListResponse {
  status: string
  data: SuratJalanSubconItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sj_subcon data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sj_subcon list
 */
export async function getSuratJalanSubconList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  createdBy?: string,
  where?: string
): Promise<SuratJalanSubconListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: true.toString() // Always join related tables for listing
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  if (createdBy) {
    queryParams.append('filter_column_created_by', createdBy)
  }

  if (where) {
    queryParams.append('where', where)
  }
  
  return apiCall<SuratJalanSubconListResponse>(`/dynamic/t_sj_subcon?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SuratJalanSubcon by ID
 * @param id - SuratJalanSubcon ID
 * @returns Promise with t_sj_subcon detail
 */
export async function getSuratJalanSubconById(id: string): Promise<{ status: string; data: SuratJalanSubconItem }> {
  const include = [
    'm_supplier',
    'm_unit_bisnis',
    'm_unit_bisnis>m_company',
    'm_kendaraan',
    'm_ekspedisi',
    't_sj_subcon_d>m_items',
     't_sj_subcon_d>m_items>m_general',
    't_sj_subcon_d>t_purchase_order_subcon',
    't_sj_subcon_d>t_purchase_order_subcon>m_supplier',
    't_sj_subcon_d>t_purchase_order_subcon_bahan',
    't_sj_subcon_d>stock_gudang',
    't_sj_subcon_d>m_general',
    't_sj_subcon_d>stock_gudang>m_rak_d',
    't_sj_subcon_d>stock_gudang>m_rak_d>m_rak',
  ].join(',')

  return apiCall(`/dynamic/t_sj_subcon/${id}?join=true&include=${encodeURIComponent(include)}`, {
    method: 'GET'
  })
}

/**
 * Create new SuratJalanSubcon
 * @param data - t_sj_subcon data
 * @returns Promise with created SuratJalanSubcon
 */
export async function createSuratJalanSubcon(data: Partial<SuratJalanSubconItem>): Promise<{ status: string; data: SuratJalanSubconItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sj_subcon_ds || data.t_sj_subcon_ds2)
  const endpoint = hasDetails ? '/dynamic/t_sj_subcon/with-details' : '/dynamic/t_sj_subcon'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SuratJalanSubcon
 * @param id - SuratJalanSubcon ID
 * @param data - t_sj_subcon data to update
 * @returns Promise with updated SuratJalanSubcon
 */
export async function updateSuratJalanSubcon(id: string, data: Partial<SuratJalanSubconItem>): Promise<{ status: string; data: SuratJalanSubconItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sj_subcon_ds || data.t_sj_subcon_ds2)
  const endpoint = hasDetails ? `/dynamic/t_sj_subcon/with-details/${id}` : `/dynamic/t_sj_subcon/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SuratJalanSubcon
 * @param id - SuratJalanSubcon ID
 * @returns Promise with delete confirmation
 */
export async function deleteSuratJalanSubcon(id: string): Promise<{ status: string; message: string }> {
  try {
    // Always try with-details first
    return await apiCall(`/dynamic/t_sj_subcon/with-details/${id}`, {
      method: 'DELETE'
    })
  } catch (_error) {
    // fallback jika relasi detail gagal di-resolve
    return apiCall(`/dynamic/t_sj_subcon/${id}`, {
      method: 'DELETE'
    })
  }
}

/**
 * Get all t_sj_subcon data without pagination (for sidebar)
 * @returns Promise with t_sj_subcon list
 */
export async function getSuratJalanSubconListNoPagination(): Promise<SuratJalanSubconListResponse> {
  return apiCall<SuratJalanSubconListResponse>('/dynamic/t_sj_subcon?no_pagination=true', {
    method: 'GET'
  })
}

/**
 * Post SuratJalanSubcon
 */
export async function postSuratJalanSubcon(id: string): Promise<{ status?: string; message?: string; error?: string; reason?: string; data?: any }> {
  return apiCall(`/fn/t_sj_subcon/PostData`, {
    method: 'POST',
    body: JSON.stringify({ t_sj_subcon_id: id })
  })
}

/**
 * Set status SuratJalanSubcon menjadi WAITING_BIAYA_KIRIM
 */
export async function waitingShippingCostSuratJalanSubcon(id: string): Promise<{ status?: string; message?: string; error?: string; reason?: string; data?: any }> {
  return updateSuratJalanSubcon(id, {
    status: 'WAITING_BIAYA_KIRIM'
  })
}
