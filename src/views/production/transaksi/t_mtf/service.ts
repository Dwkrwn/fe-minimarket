import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface MtfItem {
  id: string
  m_unit_bisnis_id: string
  no: string
  date: string
  ref_table: 't_mrq' | 't_ba'
  ref_id: string
  t_wo_id: string
  t_wo_d_item_id: string
  t_wo_sd_routing_id: string
  m_warehouse_id: string
  to_warehouse_id: string
  notes?: string
  status: 'DRAFT' | 'POST' | 'CONFIRM'
  confirmed_by?: string
  confirmed_at?: string
  created_by?: string | null
  updated_by?: string | null
  createdAt?: string
  updatedAt?: string
  t_mtf_details?: MtfDetailItem[]
  t_mtf_d?: any[]
  t_mtf_ds?: any[]
  t_mtf_details2?: any[]
  m_unit_bisni?: any
  m_gudang?: any
}

export interface MtfDetailItem {
  id?: string
  t_mtf_id?: string
  sequence: number
  ref_table: 't_mrq_d' | 't_ba_d'
  ref_id: string
  m_item_id: string
  batch?: string
  is_batch?: boolean
  qty_transfer: number
  uom_id: string
  notes?: string
  qty_confirm?: number
  reason_confirm?: string
  qty_usage?: number
  qty_return?: number
  
  // Virtual / relational display fields
  m_item?: any
  qty_req_available?: number
  qty_stock?: number
  uom?: any
  m_general?: any
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

export interface MtfListResponse {
  status: string
  data: MtfItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_mtf data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_mtf list
 */
export async function getMtfList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<MtfListResponse> {
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
  
  return apiCall<MtfListResponse>(`/dynamic/t_mtf?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Mtf by ID
 * @param id - Mtf ID
 * @returns Promise with t_mtf detail
 */
export async function getMtfById(id: string): Promise<{ status: string; data: MtfItem }> {
  const include = 't_mtf_d>m_items>m_general@mi_uom,t_mtf_d>m_general,m_unit_bisnis,t_wo,t_wo_d_item>m_items>m_general@mi_uom,t_wo_sd_routing,m_gudang'
  return apiCall(`/dynamic/t_mtf/${id}?join=true&include=${encodeURIComponent(include)}`, {
    method: 'GET'
  })
}

/**
 * Create new Mtf
 * @param data - t_mtf data
 * @returns Promise with created Mtf
 */
export async function createMtf(data: Partial<MtfItem>): Promise<{ status: string; data: MtfItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_mtf_d || data.t_mtf_details || data.t_mtf_details2)
  const endpoint = hasDetails ? '/dynamic/t_mtf/with-details' : '/dynamic/t_mtf'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Mtf
 * @param id - Mtf ID
 * @param data - t_mtf data to update
 * @returns Promise with updated Mtf
 */
export async function updateMtf(id: string, data: Partial<MtfItem>): Promise<{ status: string; data: MtfItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_mtf_d || data.t_mtf_details || data.t_mtf_details2)
  const endpoint = hasDetails ? `/dynamic/t_mtf/with-details/${id}` : `/dynamic/t_mtf/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Mtf
 * @param id - Mtf ID
 * @returns Promise with delete confirmation
 */
export async function deleteMtf(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_mtf/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_mtf data without pagination (for sidebar)
 * @returns Promise with t_mtf list
 */
export async function getMtfListNoPagination(): Promise<MtfListResponse> {
  return apiCall<MtfListResponse>('/dynamic/t_mtf?no_pagination=true', {
    method: 'GET'
  })
}

export async function postMtf(
  id: string,
): Promise<{ status: string; data?: any }> {
  let updated_by: string | undefined
  try {
    const authData = localStorage.getItem('auth_bb')
    if (authData) {
      const parsed = JSON.parse(authData)
      updated_by = parsed.user?.id
    }
  } catch {
    // ignore
  }

  return apiCall(`/dynamic/t_mtf/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST", ...(updated_by ? { updated_by } : {}) }),
  });
}
