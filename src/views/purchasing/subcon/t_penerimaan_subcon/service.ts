import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PenerimaanSubconItem {
  id: string
  no_penerimaan: string
  tgl_penerimaan: string
  m_unit_bisnis_id?: string
  m_unit_bisni?: any
  m_unit_bisnis?: any
  m_supplier_id?: string
  m_supplier?: any
  m_gudang_id?: string
  gudang_id?: string
  m_gudang?: any
  t_sj_id?: string
  edited_by?: string
  created_by?: string
  supir?: string
  catatan?: string
  status?: string
  createdAt: string
  updatedAt: string
  t_penerimaan_barang_subcon_jadis?: any[]
  t_penerimaan_barang_subcon_jasas?: any[]
}

export interface PoOutstandingItem {
  t_po_subcon_jadi_id?: string
  t_purchase_order_subcon_jadi_id?: string
  qty_po?: number | string | null
  qty_diterima?: number | string | null
  qty_sisa?: number | string | null
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

export interface PenerimaanSubconListResponse {
  status: string
  data: PenerimaanSubconItem[]
  pagination: Pagination
}

export interface PenerimaanSubconFilter {
  key: string
  value: string
  operator?: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_penerimaan_barang_subcon data
 */
export async function getPenerimaanSubconList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filter_created_by?: string,
  filters?: PenerimaanSubconFilter[] | Record<string, string>,
  where?: string
): Promise<PenerimaanSubconListResponse> {
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

  if (filter_created_by) {
    queryParams.append('filter_column_created_by', filter_created_by)
  }

  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
      if (filter.value && filter.value.trim()) {
        queryParams.append(`filter_column_${filter.key}`, filter.value.trim())
        if (filter.operator) {
          queryParams.append(`filter_operator_${filter.key}`, filter.operator)
        }
      }
    })
  } else if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim())
      }
    })
  }

  if (where && where.trim()) {
    queryParams.append('where', where.trim())
  }
  
  queryParams.append('join', 'true')

  return apiCall<PenerimaanSubconListResponse>(`/dynamic/t_penerimaan_barang_subcon?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get PenerimaanSubcon by ID
 */
export async function getPenerimaanSubconById(id: string): Promise<{ status: string; data: PenerimaanSubconItem }> {
  const include = [
    't_penerimaan_barang_subcon_jadi',
    't_penerimaan_barang_subcon_jasa',
    't_penerimaan_barang_subcon_jadi>m_items',
    't_penerimaan_barang_subcon_jadi>m_general',
    't_penerimaan_barang_subcon_jadi>m_rak_d>m_rak',
    't_penerimaan_barang_subcon_jadi>t_purchase_order_subcon_jadi',
    't_penerimaan_barang_subcon_jadi>t_purchase_order_subcon',
    't_penerimaan_barang_subcon_jasa>m_items',
    't_penerimaan_barang_subcon_jasa>m_general',
    't_penerimaan_barang_subcon_jasa>t_purchase_order_subcon_jasa',
    't_penerimaan_barang_subcon_jasa>t_purchase_order_subcon',
    'm_supplier',
    'm_gudang',
    'm_unit_bisnis'
  ].join(',')

  try {
    return await apiCall(`/dynamic/t_penerimaan_barang_subcon/${id}?join=true&include=${encodeURIComponent(include)}`, {
      method: 'GET'
    })
  } catch (_error) {
    return apiCall(`/dynamic/t_penerimaan_barang_subcon/${id}?join=true`, {
      method: 'GET'
    })
  }
}

/**
 * Create new PenerimaanSubcon
 */
export async function createPenerimaanSubcon(data: Partial<PenerimaanSubconItem>): Promise<{ status: string; data: PenerimaanSubconItem }> {
  const hasDetails = !!(
    (data.t_penerimaan_barang_subcon_jadis && data.t_penerimaan_barang_subcon_jadis.length > 0) ||
    (data.t_penerimaan_barang_subcon_jasas && data.t_penerimaan_barang_subcon_jasas.length > 0)
  )
  const endpoint = hasDetails
    ? '/dynamic/t_penerimaan_barang_subcon/with-details'
    : '/dynamic/t_penerimaan_barang_subcon'

  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update PenerimaanSubcon
 */
export async function updatePenerimaanSubcon(id: string, data: Partial<PenerimaanSubconItem>): Promise<{ status: string; data: PenerimaanSubconItem }> {
  const hasDetails = !!(
    (data.t_penerimaan_barang_subcon_jadis && data.t_penerimaan_barang_subcon_jadis.length > 0) ||
    (data.t_penerimaan_barang_subcon_jasas && data.t_penerimaan_barang_subcon_jasas.length > 0)
  )
  const endpoint = hasDetails
    ? `/dynamic/t_penerimaan_barang_subcon/with-details/${id}`
    : `/dynamic/t_penerimaan_barang_subcon/${id}`

  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete PenerimaanSubcon
 */
export async function deletePenerimaanSubcon(id: string): Promise<{ status: string; message: string }> {
  try {
    return await apiCall(`/dynamic/t_penerimaan_barang_subcon/with-details/${id}`, {
      method: 'DELETE'
    })
  } catch (_error) {
    // fallback untuk kasus relasi detail tidak terbaca oleh endpoint with-details
    return apiCall(`/dynamic/t_penerimaan_barang_subcon/${id}`, {
      method: 'DELETE'
    })
  }
}

/**
 * Get all t_penerimaan_barang_subcon data without pagination (for sidebar)
 */
export async function getPenerimaanSubconListNoPagination(): Promise<PenerimaanSubconListResponse> {
  return apiCall<PenerimaanSubconListResponse>('/dynamic/t_penerimaan_barang_subcon?no_pagination=true&join=true', {
    method: 'GET'
  })
}

/**
 * Post Penerimaan Subcon - Change status to POST and create stock_gudang entries
 */
export async function postPenerimaanSubcon(
  id: string
): Promise<{ status: string; message?: string; data?: any }> {
  return apiCall('/fn/t_penerimaan_barang_subcon/postPenerimaanSubcon', {
    method: 'POST',
    body: JSON.stringify({ penerimaan_subcon_id: id })
  })
}
