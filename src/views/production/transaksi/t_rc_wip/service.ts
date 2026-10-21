import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES (t_rc & t_rc_d)
// ============================================================================

export interface RcDItem {
  id?: string
  t_rc_id?: string
  sequence?: number
  no_wo?: string
  no_pres?: string
  date_pres?: string
  t_pres_id?: string
  t_pres_d_item_id?: string
  item_type_id?: string
  item_type?: string
  m_item_id?: string
  item_name?: string
  batch?: string
  qty_result?: number | string
  qty_confirm?: number | string
  qty_received?: number | string
  qty_available?: number | string
  unit_id?: string
  uom?: string
  notes?: string
  catatan?: string
  t_pres?: any
  t_pres_d_item?: any
  m_item?: any
  m_general_item_type?: any
  m_general_unit?: any
}

export interface RcWipItem {
  id: string
  no?: string
  group?: string
  date?: string
  key1?: string
  m_unit_bisnis_id?: string
  code?: string
  flag?: string
  m_warehouse_id?: string
  value1?: string
  to_warehouse_id?: string
  value2?: string
  notes?: string
  value3?: string
  status?: string
  is_active?: boolean
  m_unit_bisnis?: any
  m_warehouse?: any
  to_warehouse?: any
  t_rc_d?: RcDItem[]
  t_rc_ds?: RcDItem[]
  t_rc_details?: RcDItem[]
  t_rcwip_details?: any[]
  ref_type?: string
  ref_so?: any
  ref_io?: any
  t_sales_order?: any
  t_io?: any
  m_customer?: any
  createdAt?: string
  updatedAt?: string
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

export interface RcWipListResponse {
  status: string
  data: RcWipItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_rc (flag = WIP) data
 */
export async function getRcWipList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<RcWipListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    filter_column_flag: 'WIP',
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

  return apiCall<RcWipListResponse>(`/dynamic/t_rc?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get RcWip by ID
 */
export async function getRcWipById(id: string): Promise<{ status: string; data: RcWipItem }> {
  return apiCall<{ status: string; data: RcWipItem }>(`/dynamic/t_rc/${id}?join=all,sub&include=t_rc_d@t_rc_ds>t_pres@t_pre>t_wo,t_rc_d@t_rc_ds>t_pres@t_pre>t_wo_d_item@t_wo_d_item>m_items@m_item,t_rc_d@t_rc_ds>t_pres@t_pre>t_wo_d_item@t_wo_d_item>m_general@as_item_type_wod,t_rc_d@t_rc_ds>t_pres@t_pre>t_wo_d_item@t_wo_d_item>m_general@as_unit_wod,t_rc_d@t_rc_ds>m_items@m_item,t_rc_d@t_rc_ds>t_pres_d_item@t_pres_d_item>m_general@type_item_pres,t_rc_d@t_rc_ds>t_pres_d_item@t_pres_d_item>m_general@unit_id_pres,t_rc_d@t_rc_ds>t_pres_d_item@t_pres_d_item>m_items@m_item`, {
    method: 'GET'
  })
}

/**
 * Create new RcWip (t_rc & t_rc_d)
 */
export async function createRcWip(data: Partial<RcWipItem>): Promise<{ status: string; data: RcWipItem }> {
  const hasDetails = !!(data.t_rc_ds?.length || data.t_rc_d?.length || data.t_rc_details?.length || data.t_rcwip_details?.length)
  const endpoint = hasDetails ? '/dynamic/t_rc/with-details' : '/dynamic/t_rc'
  
  return apiCall<{ status: string; data: RcWipItem }>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update RcWip (t_rc & t_rc_d)
 */
export async function updateRcWip(id: string, data: Partial<RcWipItem>): Promise<{ status: string; data: RcWipItem }> {
  const hasDetails = !!(data.t_rc_ds?.length || data.t_rc_d?.length || data.t_rc_details?.length || data.t_rcwip_details?.length)
  const endpoint = hasDetails ? `/dynamic/t_rc/with-details/${id}` : `/dynamic/t_rc/${id}`
  
  return apiCall<{ status: string; data: RcWipItem }>(endpoint, {
    method: 'PUT',
    body: JSON.stringify({ ...data, id })
  })
}

/**
 * Delete RcWip
 */
export async function deleteRcWip(id: string): Promise<{ status: string; message: string }> {
  return apiCall<{ status: string; message: string }>(`/dynamic/t_rc/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Post RcWip — ubah status menjadi POST
 */
export async function postRcWip(id: string): Promise<{ status: string; data?: any }> {
  return apiCall<{ status: string; data?: any }>(`/dynamic/t_rc/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST', is_active: true })
  })
}

/**
 * Get all available Production Results (t_pres) & Sub Detail Items for Modal Add To List
 */
export async function getAvailableProductionResults(): Promise<any[]> {
  try {
    const res = await apiCall<any>('/dynamic/t_pres_wip?join=all,sub&no_pagination=true')
    if (res.status === 'success') {
      const list = Array.isArray(res.data) ? res.data : (res.data?.rows || [])
      if (list.length > 0) return list
    }
    throw new Error(res.message || 't_pres_wip failed')
  } catch (err) {
    // Try t_pres
    try {
      const res2 = await apiCall<any>('/dynamic/t_pres?join=all,sub&no_pagination=true')
      if (res2.status === 'success') {
        return Array.isArray(res2.data) ? res2.data : (res2.data?.rows || [])
      }
    } catch (err2) {
      console.warn('Failed to fetch available production results:', err2)
    }
  }
  return []
}

/**
 * Get all t_rcwip data without pagination
 */
export async function getRcWipListNoPagination(): Promise<RcWipListResponse> {
  return apiCall<RcWipListResponse>('/dynamic/t_rc?no_pagination=true&filter_column_flag=WIP&join=true', {
    method: 'GET'
  })
}

