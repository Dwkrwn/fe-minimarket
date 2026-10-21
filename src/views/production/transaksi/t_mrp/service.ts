import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface MrpDetailItem {
  id?: string
  t_mrp_id?: string
  seq: number
  source_type: string // 'SO' | 'IO'
  source_id: string
  m_item_id: string
  m_bom_id?: string
  qty_so_io: number
  qty_wo: number
  qty_stok: number
  qty_req: number
  unit_id: string | number
  note?: string
  // UI Display helper fields
  source_no?: string
  t_io_id?: string
  t_so_id?: string
  m_item?: any
  m_bom?: any
  unit_name?: string
  item_code?: string
  item_name?: string
}

export interface MrpDetailMtr {
  id?: string
  t_mrp_id?: string
  seq: number
  item_type_id: string | number
  m_item_id: string
  qty_req: number
  qty_stok: number
  qty_mreq: number
  qty_pp: number
  qty_po: number
  qty_suggest: number
  unit_id: string | number
  note?: string
  // UI Display helper fields
  m_item?: any
  material_code?: string
  material_name?: string
  item_type_name?: string
  unit_name?: string
  is_generated?: boolean
}

export interface MrpItem {
  id: string
  m_unit_bisnis_id: string
  no: string
  date: string
  note: string
  status: string
  createdAt?: string
  updatedAt?: string
  m_unit_bisnis?: any
  m_unit_bisni?: any
  t_mrp_d_item?: MrpDetailItem[]
  t_mrp_d_items?: MrpDetailItem[]
  t_mrp_d_mtr?: MrpDetailMtr[]
  t_mrp_d_mtrs?: MrpDetailMtr[]
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

export interface MrpListResponse {
  status: string
  data: MrpItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_mrp data
 */
export async function getMrpList(
  page: number = 1,
  paginate: number = 20,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  extraParams?: Record<string, string>
): Promise<MrpListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true',
    include: 'm_unit_bisnis',
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParams.append(key, val)
      }
    })
  }
  
  return apiCall<MrpListResponse>(`/dynamic/t_mrp?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Mrp by ID
 */
export async function getMrpById(id: string): Promise<{ status: string; data: MrpItem }> {
  const include = 'm_unit_bisnis,t_mrp_d_item>m_items,t_mrp_d_item>m_bom,t_mrp_d_item>m_general,t_mrp_d_mtr>m_items,t_mrp_d_mtr>m_general'
  return apiCall(`/dynamic/t_mrp/${id}?join=true&include=${encodeURIComponent(include)}`, {
    method: 'GET'
  })
}

/**
 * Create new Mrp
 */
export async function createMrp(data: Partial<MrpItem> & Record<string, any>): Promise<{ status: string; data: MrpItem }> {
  const hasDetails = !!(
    (data.t_mrp_d_item && data.t_mrp_d_item.length > 0) || 
    (data.t_mrp_d_mtr && data.t_mrp_d_mtr.length > 0)
  )
  const endpoint = hasDetails ? '/dynamic/t_mrp/with-details' : '/dynamic/t_mrp'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Mrp
 */
export async function updateMrp(id: string, data: Partial<MrpItem> & Record<string, any>): Promise<{ status: string; data: MrpItem }> {
  const hasDetails = !!(
    (data.t_mrp_d_item && data.t_mrp_d_item.length > 0) || 
    (data.t_mrp_d_mtr && data.t_mrp_d_mtr.length > 0)
  )
  const endpoint = hasDetails ? `/dynamic/t_mrp/with-details/${id}` : `/dynamic/t_mrp/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Mrp
 */
export async function deleteMrp(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_mrp/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Post Mrp (change status to POST)
 */
export async function postMrp(id: string): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_mrp/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST' })
  })
}

/**
 * Get all t_mrp data without pagination
 */
export async function getMrpListNoPagination(): Promise<MrpListResponse> {
  return apiCall<MrpListResponse>('/dynamic/t_mrp?no_pagination=true', {
    method: 'GET'
  })
}
