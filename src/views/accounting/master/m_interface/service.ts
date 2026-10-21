import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface InterfaceDetailItem {
  id?: string
  m_interface_id?: string
  sequence?: number
  m_coa_id?: string
  notes?: string
  m_coa?: {
    id?: string
    kode?: string
    nama?: string
    level?: number
    status?: boolean
  }
  kode_coa?: string
  nama_coa?: string
}

export interface InterfaceItem {
  id: string
  m_unit_bisnis_id?: string | null
  var_id?: string | null
  type?: string | null
  catatan?: string | null
  status?: boolean
  is_active?: boolean
  created_by?: string | null
  updated_by?: string | null
  createdAt?: string
  updatedAt?: string
  m_unit_bisnis?: any
  m_unit_bisni?: any
  var_interface?: any
  type_interface?: any
  m_interface_ds?: InterfaceDetailItem[]
  details?: InterfaceDetailItem[]
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

export interface InterfaceListResponse {
  status: string
  data: InterfaceItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_interface data
 */
export async function getInterfaceList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<InterfaceListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_unit_bisnis>m_company,m_general'
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  return apiCall<InterfaceListResponse>(`/dynamic/m_interface?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Interface by ID
 */
export async function getInterfaceById(id: string): Promise<{ status: string; data: InterfaceItem }> {
  return apiCall(`/dynamic/m_interface/${id}?include=m_unit_bisnis>m_company,m_interface_d>m_coa,m_general`, {
    method: 'GET'
  })
}

/**
 * Create new Interface with details
 */
export async function createInterface(data: Partial<InterfaceItem>): Promise<{ status: string; data: InterfaceItem }> {
  const hasDetails = !!(data.details || data.m_interface_ds)
  const endpoint = hasDetails ? '/dynamic/m_interface/with-details' : '/dynamic/m_interface'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Interface with details
 */
export async function updateInterface(id: string, data: Partial<InterfaceItem>): Promise<{ status: string; data: InterfaceItem }> {
  const hasDetails = !!(data.details || data.m_interface_ds)
  const endpoint = hasDetails ? `/dynamic/m_interface/with-details/${id}` : `/dynamic/m_interface/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Interface
 */
export async function deleteInterface(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_interface/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_interface data without pagination
 */
export async function getInterfaceListNoPagination(): Promise<InterfaceListResponse> {
  return apiCall<InterfaceListResponse>('/dynamic/m_interface?no_pagination=true&include=m_unit_bisnis,m_general', {
    method: 'GET'
  })
}

// Re-export helper methods for GetDataCOA and Leaf COA
export { getDataCoaByInterface, getLeafCoaList, useCoaInterface } from '@/services/interfaceCoaService'

