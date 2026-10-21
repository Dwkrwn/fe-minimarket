import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PackingPlanItem {
  id: string
  no_packing_list?: string
  m_unit_bisnis_id?: string | null
  m_gudang_id?: string | null
  tgl_packing_list?: string | null
  pic_id?: string | null
  catatan?: string | null
  status?: string | null
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_unit_bisni?: any
  m_unit_bisnis?: any
  m_gudang?: any
  m_kary?: any
  pic?: any
  user_default?: any
  unit_bisnis?: string
  gudang?: string
  pic_name?: string
  t_packing_plan_details?: any[]
  t_packing_plan_details2?: any[]
  t_packing_plan_d?: any[] | any
  t_packing_plan_ds?: any[]
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

export interface PackingPlanListResponse {
  status: string
  data: PackingPlanItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_packing_plan data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_packing_plan list
 */
export async function getPackingPlanList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<PackingPlanListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: [
      'm_unit_bisnis:id|nama_comp',
      'm_gudang:id|nama_gudang',
      'm_kary:id|nama_kary',
    ].join(',')
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  return apiCall<PackingPlanListResponse>(`/dynamic/t_packing_plan?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get PackingPlan by ID
 * @param id - PackingPlan ID
 * @returns Promise with t_packing_plan detail
 */
export async function getPackingPlanById(id: string): Promise<{ status: string; data: PackingPlanItem }> {
  const includes = [
    'm_unit_bisnis:id|nama_comp',
    'm_gudang:id|nama_gudang',
    'm_kary:id|nama_kary',
    't_packing_plan_d>t_so_d>t_so>m_customer',
    't_packing_plan_d>t_so_d>m_item>uom',
    't_packing_plan_d>t_so_d>m_items>uom',
    't_packing_plan_d>m_item>uom',
    't_packing_plan_d>m_items>uom',
    't_packing_plan_d>m_rak_d',
  ].join(',')

  return apiCall(`/dynamic/t_packing_plan/${id}?include=${includes}`, {
    method: 'GET'
  })
}

/**
 * Create new PackingPlan
 * @param data - t_packing_plan data
 * @returns Promise with created PackingPlan
 */
export async function createPackingPlan(data: Partial<PackingPlanItem>): Promise<{ status: string; data: PackingPlanItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_packing_plan_details || data.t_packing_plan_details2)
  const endpoint = hasDetails ? '/dynamic/t_packing_plan/with-details' : '/dynamic/t_packing_plan'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update PackingPlan
 * @param id - PackingPlan ID
 * @param data - t_packing_plan data to update
 * @returns Promise with updated PackingPlan
 */
export async function updatePackingPlan(id: string, data: Partial<PackingPlanItem>): Promise<{ status: string; data: PackingPlanItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_packing_plan_details || data.t_packing_plan_details2)
  const endpoint = hasDetails ? `/dynamic/t_packing_plan/with-details/${id}` : `/dynamic/t_packing_plan/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete PackingPlan
 * @param id - PackingPlan ID
 * @returns Promise with delete confirmation
 */
export async function deletePackingPlan(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_packing_plan/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_packing_plan data without pagination (for sidebar)
 * @returns Promise with t_packing_plan list
 */
export async function getPackingPlanListNoPagination(): Promise<PackingPlanListResponse> {
  const queryParams = new URLSearchParams({
    no_pagination: 'true',
    include: [
      'm_unit_bisnis:id|nama_comp',
      'm_gudang:id|nama_gudang',
      'm_kary:id|nama_kary',
    ].join(',')
  })

  return apiCall<PackingPlanListResponse>(`/dynamic/t_packing_plan?${queryParams}`, {
    method: 'GET'
  })
}
