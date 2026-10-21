import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface RoleDetail {
  id?: string
  m_role_id?: string
  m_menu_id: string
  is_read?: boolean
  is_create?: boolean
  is_update?: boolean
  is_delete?: boolean
  is_print?: boolean
  m_menu?: {
    id: string
    name: string
    label: string
    path: string
  }
}

export interface RoleItem {
  id: string
  nama_role: string
  kode_role?: string
  catatan?: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  m_role_ds?: RoleDetail[]  // Backend returns m_role_ds (pluralized)
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

export interface RoleListResponse {
  status: string
  data: RoleItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_role data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_role list
 */
export async function getRoleList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<RoleListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  return apiCall<RoleListResponse>(`/dynamic/m_role?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Role by ID with details
 * @param id - Role ID
 * @returns Promise with m_role detail
 */
export async function getRoleById(id: string): Promise<{ status: string; data: RoleItem }> {
  return apiCall(`/dynamic/m_role/${id}?include=m_role_d%3Em_menu`, {
    method: 'GET'
  })
}

/**
 * Create new Role with details
 * @param data - m_role data
 * @returns Promise with created Role
 */
export async function createRole(data: Partial<RoleItem>): Promise<{ status: string; data: RoleItem }> {
  return apiCall('/dynamic/m_role/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Role with details
 * @param id - Role ID
 * @param data - m_role data to update
 * @returns Promise with updated Role
 */
export async function updateRole(id: string, data: Partial<RoleItem>): Promise<{ status: string; data: RoleItem }> {
  return apiCall(`/dynamic/m_role/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Role
 * @param id - Role ID
 * @returns Promise with delete confirmation
 */
export async function deleteRole(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_role/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_role data without pagination (for sidebar)
 * @returns Promise with m_role list
 */
export async function getRoleListNoPagination(): Promise<RoleListResponse> {
  return apiCall<RoleListResponse>('/dynamic/m_role?no_pagination=true', {
    method: 'GET'
  })
}
