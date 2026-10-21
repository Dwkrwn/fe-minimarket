import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface RcItem {
  id: string
  // Field actual dari API
  no?: string
  date?: string
  flag?: string
  notes?: string
  m_warehouse_id?: string
  to_warehouse_id?: string
  m_unit_bisnis_id?: string
  // Field legacy / generic
  group?: string
  key1?: string
  code: string
  value1?: string
  value2?: string
  value3?: string
  value4?: string
  value5?: string
  status: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Detail items
  t_rc_details?: any[]
  t_rc_details2?: any[]
  t_rc_d?: any[]
  t_rc_ds?: any[]
  // Gudang relations
  m_gudang_prod?: {
    id: string
    nama_gudang: string
  }
  m_gudang_confirm?: {
    id: string
    nama_gudang: string
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

export interface RcListResponse {
  status: string
  data: RcItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_rc data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_rc list
 */
export async function getRcList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<RcListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    filter_column_flag: 'FG',
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
  
  return apiCall<RcListResponse>(`/dynamic/t_rc?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Rc by ID
 * @param id - Rc ID
 * @returns Promise with t_rc detail
 */
export async function getRcById(id: string): Promise<{ status: string; data: RcItem }> {
  return apiCall(`/dynamic/t_rc/${id}?join=all,sub&include=t_rc_d@t_rc_ds>t_pres@t_pre>t_wo,t_rc_d@t_rc_ds>m_items@m_item,t_rc_d@t_rc_ds>t_pres_d_item@t_pres_d_item>m_general@type_item_pres,t_rc_d@t_rc_ds>t_pres_d_item@t_pres_d_item>m_general@unit_id_pres,t_rc_d@t_rc_ds>t_pres_d_item@t_pres_d_item>m_items@m_item`, {
    method: 'GET'
  })
}

/**
 * Create new Rc
 * @param data - t_rc data
 * @returns Promise with created Rc
 */
export async function createRc(data: Partial<RcItem>): Promise<{ status: string; data: RcItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_rc_details || data.t_rc_details2 || data.t_rc_d || data.t_rc_ds)
  const endpoint = hasDetails ? '/dynamic/t_rc/with-details' : '/dynamic/t_rc'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Rc
 * @param id - Rc ID
 * @param data - t_rc data to update
 * @returns Promise with updated Rc
 */
export async function updateRc(id: string, data: Partial<RcItem>): Promise<{ status: string; data: RcItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_rc_details || data.t_rc_details2 || data.t_rc_d || data.t_rc_ds)
  const endpoint = hasDetails ? `/dynamic/t_rc/with-details/${id}` : `/dynamic/t_rc/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Rc
 * @param id - Rc ID
 * @returns Promise with delete confirmation
 */
export async function deleteRc(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_rc/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Post Rc — ubah status menjadi POST
 * @param id - Rc ID
 * @returns Promise with updated Rc
 */
export async function postRc(id: string): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_rc/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST', is_active: true })
  })
}

/**
 * Get all t_rc data without pagination (for sidebar)
 * @returns Promise with t_rc list
 */
export async function getRcListNoPagination(): Promise<RcListResponse> {
  return apiCall<RcListResponse>('/dynamic/t_rc?no_pagination=true&filter_column_flag=FG', {
    method: 'GET'
  })
}
