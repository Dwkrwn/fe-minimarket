import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PrecostItem {
  id: string
  no?: string
  flag?: string
  type?: 'GENERAL' | 'CHEMICAL' | 'SPESIFIK' | string
  date?: string
  notes?: string
  status?: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_unit_bisnis_id?: string
  m_cust_id?: string
  shipto_id?: string
  name?: string
  address?: string
  m_item_id?: string
  qty?: number
  unit_id?: string
  mtr_amt?: number
  ohd_pct?: number
  ohd_amt?: number
  dl_pct?: number
  dl_amt?: number
  tot_cogm?: number
  mkt_pct?: number
  mkt_amt?: number
  adm_pct?: number
  adm_amt?: number
  tot_unit_cost?: number
  pack_amt?: number
  dlv_amt?: number
  tot_other_cost?: number
  tot_brutto?: number
  profit_pct?: number
  profit_amt?: number
  tot_netto?: number
  price?: number
  batch_weight?: number
  base_resin?: number
  total_volume?: number
  sg_compound?: number
  total_biaya_material?: number
  harga_per_kg_compound?: number
  t_precost_ds?: any[]
  t_precost_d_speks?: any[]
  t_precost_d_spek?: any[]
  t_precost_details?: any[]
  t_precost_details2?: any[]
  m_unit_bisni?: any
  m_customer?: any
  m_item?: any
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

export interface PrecostListResponse {
  status: string
  data: PrecostItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_precost data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_precost list
 */
export async function getPrecostList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<PrecostListResponse> {
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
  
  return apiCall<PrecostListResponse>(`/dynamic/t_precost?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Precost by ID
 * @param id - Precost ID
 * @returns Promise with t_precost detail
 */
export async function getPrecostById(id: string): Promise<{ status: string; data: PrecostItem }> {
  return apiCall(`/dynamic/t_precost/${id}?join=all,sub`, {
    method: 'GET'
  })
}

export async function createPrecost(data: Partial<PrecostItem>): Promise<{ status: string; data: PrecostItem }> {
  return apiCall('/dynamic/t_precost/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updatePrecost(id: string, data: Partial<PrecostItem>): Promise<{ status: string; data: PrecostItem }> {
  return apiCall(`/dynamic/t_precost/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Precost
 * @param id - Precost ID
 * @returns Promise with delete confirmation
 */
export async function deletePrecost(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_precost/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_precost data without pagination (for sidebar)
 * @returns Promise with t_precost list
 */
export async function getPrecostListNoPagination(): Promise<PrecostListResponse> {
  return apiCall<PrecostListResponse>('/dynamic/t_precost?no_pagination=true', {
    method: 'GET'
  })
}
