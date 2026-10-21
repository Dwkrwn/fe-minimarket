import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface BaItem {
  id: string
  m_unit_bisnis_id: string
  no: string
  date: string
  type: string
  t_wo_id: string
  t_wo_d_item_id: string
  t_wo_sd_routing_id: string
  warehouse_id: string
  reason_id: string
  notes?: string
  status: 'DRAFT' | 'POST' | 'CONFIRM'
  confirmed_by?: string
  confirmed_at?: string
  createdAt?: string
  updatedAt?: string
  t_ba_d?: BaDetailItem[]
  t_ba_details?: BaDetailItem[] // Alias support
  m_unit_bisni?: any
  m_gudang?: any
  reason?: any
}

export interface BaDetailItem {
  id?: string
  t_ba_id?: string
  sequence: number
  t_wo_sd_material_id: string | null
  m_item_id: string | null
  qty: number | string // Qty BA
  unit_id: string | null
  qty_confirm?: number | string
  notes?: string
  
  // Relational & calculation display fields
  qty_wo?: number | string
  qty_stock?: number | string
  uom?: string
  material_wo_label?: string
  m_item?: any
  t_wo_sd_material?: any
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

export interface BaListResponse {
  status: string
  data: BaItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_ba data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_ba list
 */
export async function getBaList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<BaListResponse> {
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
  
  return apiCall<BaListResponse>(`/dynamic/t_ba?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Ba by ID
 * @param id - Ba ID
 * @returns Promise with t_ba detail
 */
export async function getBaById(id: string): Promise<{ status: string; data: BaItem }> {
  const include = 't_ba_d>m_items,t_ba_d>m_general,m_unit_bisnis,t_wo,t_wo_d_item>m_items,t_wo_sd_routing>m_routing,t_wo_sd_routing>m_items,m_gudang,m_general'
  return apiCall(`/dynamic/t_ba/${id}?join=true&include=${encodeURIComponent(include)}`, {
    method: 'GET'
  })
}

/**
 * Create new Ba
 * @param data - t_ba data
 * @returns Promise with created Ba
 */
export async function createBa(data: Partial<BaItem>): Promise<{ status: string; data: BaItem }> {
  // Ensure correct key name for cascade saving
  const hasDetails = !!(data.t_ba_d || data.t_ba_details)
  const endpoint = hasDetails ? '/dynamic/t_ba/with-details' : '/dynamic/t_ba'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Ba
 * @param id - Ba ID
 * @param data - t_ba data to update
 * @returns Promise with updated Ba
 */
export async function updateBa(id: string, data: Partial<BaItem>): Promise<{ status: string; data: BaItem }> {
  const hasDetails = !!(data.t_ba_d || data.t_ba_details)
  const endpoint = hasDetails ? `/dynamic/t_ba/with-details/${id}` : `/dynamic/t_ba/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Ba
 * @param id - Ba ID
 * @returns Promise with delete confirmation
 */
export async function deleteBa(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_ba/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_ba data without pagination (for sidebar)
 * @returns Promise with t_ba list
 */
export async function getBaListNoPagination(): Promise<BaListResponse> {
  return apiCall<BaListResponse>('/dynamic/t_ba?no_pagination=true', {
    method: 'GET'
  })
}

export async function postBa(
  id: string,
): Promise<{ status: string; data?: any }> {
  return apiCall(`/dynamic/t_ba/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST" }),
  });
}
