import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================


export interface WoWipItemMaterial {
  id?: string
  t_wo_wip_id?: string
  t_wo_wip_sd_routing_id?: string
  t_wo_sd_routing_id?: string
  t_wo_id?: string
  sequence?: number
  m_item_id?: string
  qty?: number
  unit_id?: string
  notes?: string
  item_type_id?: string
  weight?: number
  waste_qty?: number
  waste_pct?: number
  m_item?: any
  as_type_sd_wo?: any
  m_general?: any
  is_main?: boolean
  qty_request?: number
  qty_stock?: number
}

export interface WoWipItemRouting {
  id?: string
  t_wo_id?: string
  t_wo_wo_d_item_id?: string
  t_wo_d_item_id?: string
  sequence?: number
  m_routing_id?: string
  to_routing_id?: string
  is_final?: boolean
  m_machine_id?: string
  speed?: number
  output_type?: string
  m_item_id?: string
  qty?: number
  unit_id?: string
  is_bom?: boolean
  time?: number
  plan_start?: string
  plan_finish?: string
  real_start?: string
  real_finish?: string
  qty_result?: number
  notes?: string
  m_routing?: any
  to_routing?: any
  m_mesin?: any
  m_machine?: any
  m_general?: any
  m_item?: any
  t_wo_wip_sd_materials?: WoWipItemMaterial[]
  t_wo_sd_materials?: WoWipItemMaterial[]
}

export interface WoWipItemDetail {
  id?: string
  t_wo_wip_id?: string
  t_wo_id?: string
  sequence?: number
  ref_type?: string
  ref_so_id?: string
  ref_io_id?: string
  m_item_id?: string
  m_bom_id?: string
  qty?: number
  unit_id?: string
  notes?: string
  m_item?: any
  m_bom?: any
  m_general_unit?: any
  t_wo_wip_sd_routings?: WoWipItemRouting[]
  t_wo_sd_routings?: WoWipItemRouting[]
  item_type_id?: string
  finish_date?: string
  qty_accum?: number
}

export interface WoWipItem {
  id: string
  m_unit_bisnis_id?: string
  no?: string
  no_t_wo_wip?: string
  date?: string
  tgl_t_wo_wip?: string
  flag?: string
  wo_ref_id?: string
  ref_type?: string
  ref_so_id?: string
  ref_io_id?: string
  m_customer_id?: string
  notes?: string
  catatan?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  t_wo_wip_d_items?: WoWipItemDetail[]
  t_wo_wip_details?: any[]
  t_wo_wip_details2?: any[]
  wo_ref?: any
  t_wo?: any
  ref_so?: any
  ref_io?: any
  t_sales_order?: any
  t_io?: any
  m_customer?: any
  m_unit_bisni?: any
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

export interface WoWipListResponse {
  status: string
  data: WoWipItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_wo_wip data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param created_by - User ID who created the record
 * @returns Promise with t_wo_wip list
 */
export async function getWoWipList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  created_by?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<WoWipListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true',
    filter_column_flag: 'WIP'
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

  if (created_by) {
    queryParams.append('created_by', created_by)
  }
  
  return apiCall<WoWipListResponse>(`/fn/t_wo/getWoListWithRefs?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get WoWip by ID
 * @param id - WoWip ID
 * @returns Promise with t_wo_wip detail
 */
export async function getWoWipById(id: string): Promise<{ status: string; data: WoWipItem }> {
  return apiCall(`/fn/t_wo/getWoDetail?id=${id}`, {
    method: 'GET'
  })
}

/**
 * Create new WoWip
 * @param data - t_wo_wip data
 * @returns Promise with created WoWip
 */
export async function createWoWip(data: Partial<WoWipItem>): Promise<{ status: string; data: WoWipItem }> {
  return apiCall('/fn/t_wo/saveWo', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update WoWip
 * @param id - WoWip ID
 * @param data - t_wo_wip data to update
 * @returns Promise with updated WoWip
 */
export async function updateWoWip(id: string, data: Partial<WoWipItem>): Promise<{ status: string; data: WoWipItem }> {
  return apiCall('/fn/t_wo/saveWo', {
    method: 'POST',
    body: JSON.stringify({ ...data, id })
  })
}

/**
 * Delete WoWip
 * @param id - WoWip ID
 * @returns Promise with delete confirmation
 */
export async function deleteWoWip(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_wo/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_wo_wip data without pagination (for sidebar)
 * @returns Promise with t_wo_wip list
 */
export async function getWoWipListNoPagination(): Promise<WoWipListResponse> {
  return apiCall<WoWipListResponse>('/dynamic/t_wo?no_pagination=true&filter_column_flag=WIP', {
    method: 'GET'
  })
}
