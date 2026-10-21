import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface MretItem {
  id: string
  m_unit_bisnis_id: string
  no: string
  date: string
  t_wo_id: string
  t_wo_d_item_id?: string
  t_mtf_id?: string
  t_wo_sd_routing_id: string
  m_warehouse_id: string
  to_warehouse_id: string
  notes?: string
  status: 'DRAFT' | 'POST' | 'CONFIRM'
  confirmed_by?: string
  confirmed_at?: string
  createdAt?: string
  updatedAt?: string
  t_mret_details?: MretDetailItem[]
  t_mret_d?: any[]
  t_mret_details2?: any[]
  mret_wh_from?: any
  mret_wh_to?: any
  m_unit_bisni?: any
}

export interface MretDetailItem {
  id?: string
  t_mret_id?: string
  sequence: number
  t_mtf_d_id?: string
  m_item_id: string
  batch?: string
  is_batch?: boolean
  qty_return: number
  unit_id: string
  notes?: string

  // Virtual / relational display fields
  m_item?: any
  uom?: any
  tipe_material?: string
  item_code?: string
  item_name?: string
  uom_name?: string
  qty_transfer_confirm?: number
  qty_usage?: number
  qty_already_returned?: number
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

export interface MretListResponse {
  status: string
  data: MretItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_mret data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_mret list
 */
export async function getMretList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<MretListResponse> {
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
  
  return apiCall<MretListResponse>(`/dynamic/t_mret?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Mret by ID
 * @param id - Mret ID
 * @returns Promise with t_mret detail
 */
export async function getMretById(id: string): Promise<{ status: string; data: MretItem }> {
  const include = 't_mret_d>m_items,m_unit_bisnis,t_wo,t_wo_d_item>m_items,t_wo_sd_routing>m_routing,t_wo_sd_routing>m_items,m_gudang,t_mtf,t_mret_d>t_mtf_d,t_mret_d>m_general'
  return apiCall(`/dynamic/t_mret/${id}?join=true&include=${encodeURIComponent(include)}`, {
    method: 'GET'
  })
}

/**
 * Create new Mret
 * @param data - t_mret data
 * @returns Promise with created Mret
 */
export async function createMret(data: Partial<MretItem>): Promise<{ status: string; data: MretItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_mret_d || data.t_mret_details || data.t_mret_details2)
  const endpoint = hasDetails ? '/dynamic/t_mret/with-details' : '/dynamic/t_mret'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Mret
 * @param id - Mret ID
 * @param data - t_mret data to update
 * @returns Promise with updated Mret
 */
export async function updateMret(id: string, data: Partial<MretItem>): Promise<{ status: string; data: MretItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_mret_d || data.t_mret_details || data.t_mret_details2)
  const endpoint = hasDetails ? `/dynamic/t_mret/with-details/${id}` : `/dynamic/t_mret/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Mret
 * @param id - Mret ID
 * @returns Promise with delete confirmation
 */
export async function deleteMret(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_mret/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_mret data without pagination (for sidebar)
 * @returns Promise with t_mret list
 */
export async function getMretListNoPagination(): Promise<MretListResponse> {
  return apiCall<MretListResponse>('/dynamic/t_mret?no_pagination=true', {
    method: 'GET'
  })
}

export async function postMret(
  id: string,
): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_mret/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST" }),
  });
}

/**
 * Get available details of a Material Transfer for return
 * @param t_mtf_id - Material Transfer ID
 * @param search - Optional search query
 * @returns Promise with available detail lines
 */
export async function getMtfDetailsForReturn(
  t_mtf_id: string,
  search?: string
): Promise<{ status: string; data: MretDetailItem[] }> {
  const queryParams = new URLSearchParams({ t_mtf_id })
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  return apiCall(`/fn/t_mret/getMtfDetailsForReturn?${queryParams}`, {
    method: 'GET'
  })
}
