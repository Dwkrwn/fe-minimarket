import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface WoItemMaterial {
  id?: string
  t_wo_id?: string
  t_wo_sd_routing_id?: string
  sequence?: number
  item_type_id?: string
  m_item_id?: string
  is_main?: boolean
  qty?: number | string
  unit_id?: string
  weight?: number | string
  waste_pct?: number | string
  waste_qty?: number | string
  qty_request?: number | string
  qty_stock?: number
  notes?: string
  to_routing_id?: string
  item_type_label?: string
  m_item?: any
  m_general_unit?: any
  as_type_sd_wo?: any
}

export interface WoItemRouting {
  id?: string
  t_wo_id?: string
  t_wo_d_item_id?: string
  sequence?: number
  m_routing_id?: string
  to_routing_id?: string
  is_final?: boolean
  m_machine_id?: string
  speed?: number | string
  output_type?: string
  m_item_id?: string
  qty?: number | string
  unit_id?: string
  is_bom?: boolean
  time?: number
  plan_start?: string
  plan_finish?: string
  real_start?: string
  real_finish?: string
  qty_result?: number | string
  notes?: string
  m_routing?: any
  to_routing?: any
  m_machine?: any
  m_item?: any
  m_general_output?: any
  m_general_unit?: any
  t_wo_sd_materials?: WoItemMaterial[]
}

export interface WoItemDetail {
  id?: string
  t_wo_id?: string
  sequence?: number
  ref_type?: string
  ref_so_id?: string
  ref_io_id?: string
  item_type_id?: string
  m_item_id?: string
  m_bom_id?: string
  qty?: number | string
  unit_id?: string
  qty_accum?: number | string
  qty_ots?: number | string
  finish_date?: string
  notes?: string
  m_item?: any
  m_bom?: any
  m_general_item_type?: any
  m_general_unit?: any
  t_wo_sd_routings?: WoItemRouting[]
}

export interface WoItem {
  id: string
  no?: string
  date?: string
  flag?: string
  wo_ref_id?: string
  ref_type?: string
  ref_so_id?: string
  ref_io_id?: string
  m_customer_id?: string
  notes?: string
  status?: string
  t_wo_d_items?: WoItemDetail[]
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

export interface WoListResponse {
  status: string
  data: WoItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_wo data
 */
export async function getWoList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<WoListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true',
    filter_column_flag: 'FG'
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

  return apiCall<WoListResponse>(`/fn/t_wo/getWoListWithRefs?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Wo by ID
 */
export async function getWoById(id: string): Promise<{ status: string; data: WoItem }> {
  return apiCall(`/fn/t_wo/getWoDetail?id=${id}`, {
    method: 'GET'
  })
}

/**
 * Create new Wo
 */
export async function createWo(data: Partial<WoItem>): Promise<{ status: string; data: WoItem }> {
  return apiCall('/fn/t_wo/saveWo', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Wo
 */
export async function updateWo(id: string, data: Partial<WoItem>): Promise<{ status: string; data: WoItem }> {
  return apiCall('/fn/t_wo/saveWo', {
    method: 'POST',
    body: JSON.stringify({ ...data, id })
  })
}

/**
 * Delete Wo
 */
export async function deleteWo(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_wo/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_wo data without pagination
 */
export async function getWoListNoPagination(): Promise<WoListResponse> {
  return apiCall<WoListResponse>('/dynamic/t_wo?no_pagination=true&filter_column_flag=FG', {
    method: 'GET'
  })
}
