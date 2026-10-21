import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TreqItem {
  id: string
  // Header fields
  no?: string
  date?: string
  m_unit_bisnis_id?: string
  t_wo_id?: string
  t_wo_d_item_id?: string
  m_warehouse_id?: string
  to_t_wo_id?: string
  to_t_wo_d_item_id?: string
  to_warehouse_id?: string
  notes?: string
  status: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Relations (joined) — menggunakan alias sesuai struktur DB
  m_unit_bisnis?: any
  // WO Asal → alias as_wo_asal
  as_wo_asal?: any
  // Item Asal → alias as_wo_item_awal
  as_wo_item_awal?: any
  // Warehouse Asal → alias as_wo_gudang_asal
  as_wo_gudang_asal?: any
  // WO Tujuan → alias as_wo_tujuan
  as_wo_tujuan?: any
  // Item Tujuan → alias as_wo_item_tujuan
  as_wo_item_tujuan?: any
  // Warehouse Tujuan → alias as_wo_gudang_tujuan
  as_wo_gudang_tujuan?: any
  // fallback tanpa alias (join=true sederhana)
  t_wo?: any
  t_wo_d_item?: any
  m_gudang?: any
  to_t_wo?: any
  to_t_wo_d_item?: any
  to_m_gudang?: any
  // Detail items
  t_treq_d?: any[]
  t_treq_ds?: any[]
  // Computed/aggregated from detail — ada MTF yang referenced
  has_mtf_reference?: boolean
}

export interface TreqDItem {
  id?: string
  t_treq_id?: string
  sequence?: number
  t_mtf_d_id?: string
  m_item_id?: string
  qty?: number
  qty_transfer?: number
  qty_confirm?: number
  unit_id?: string
  notes?: string
  // Computed/display fields (not sent to backend)
  no_mtf?: string
  item_type?: string
  item_name?: string
  kode_item?: string
  nama_item?: string
  uom?: string
  qty_transfer_confirm?: number
  qty_usage?: number
  qty_oper?: number
  qty_return?: number
  qty_available?: number
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

export interface TreqListResponse {
  status: string
  data: TreqItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_treq data
 */
export async function getTreqList(
  page: number = 1,
  paginate: number = 20,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<TreqListResponse> {
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

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });
  }

  if (where) {
    queryParams.append('where', where);
  }

  if (filterCreatedBy) {
    queryParams.append('filter_column_created_by', filterCreatedBy)
  }

  return apiCall<TreqListResponse>(`/dynamic/t_treq?${queryParams}`, { method: 'GET' })
}

/**
 * Get Treq by ID with full join and detail include
 */
export async function getTreqById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(
    `/dynamic/t_treq/${id}?join=all,sub&include=t_treq_d`,
    { method: 'GET' }
  )
}

/**
 * Create new Treq — selalu pakai with-details untuk simpan detail material
 */
export async function createTreq(data: Partial<TreqItem>): Promise<{ status: string; data: TreqItem }> {
  return apiCall('/dynamic/t_treq/with-details', { method: 'POST', body: JSON.stringify(data) })
}

/**
 * Update Treq — selalu pakai with-details untuk update detail material
 */
export async function updateTreq(id: string, data: Partial<TreqItem>): Promise<{ status: string; data: TreqItem }> {
  return apiCall(`/dynamic/t_treq/with-details/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

/**
 * Delete Treq (cascade with details)
 */
export async function deleteTreq(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_treq/with-details/${id}`, { method: 'DELETE' })
}

/**
 * Post Treq — ubah status menjadi POST
 */
export async function postTreq(id: string): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_treq/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST', is_active: true })
  })
}

/**
 * Ambil daftar No WO Asal yang memiliki MTF ber-status POST/CONFIRM dengan Qty Available > 0
 */
export async function getAvailableWoAsal(unitBisnisId?: string, search?: string): Promise<{ status: string; data: any[] }> {
  const params = new URLSearchParams()
  if (unitBisnisId) params.append('m_unit_bisnis_id', unitBisnisId)
  if (search && search.trim()) params.append('search', search.trim())
  return apiCall(`/fn/t_treq/getAvailableWoAsal?${params.toString()}`, { method: 'GET' })
}

/**
 * Ambil daftar Material dari MTF milik No WO Asal dengan Qty Available > 0
 */
export async function getAvailableMaterials(woId: string, warehouseId?: string, search?: string): Promise<{ status: string; data: any[] }> {
  const params = new URLSearchParams({ t_wo_id: woId })
  if (warehouseId) params.append('m_warehouse_id', warehouseId)
  if (search && search.trim()) params.append('search', search.trim())
  return apiCall(`/fn/t_treq/getAvailableMaterials?${params.toString()}`, { method: 'GET' })
}
