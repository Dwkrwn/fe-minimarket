import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface RespoDetail {
  m_role_id: string
  m_role?: any // Relation to m_role
  is_active?: boolean
}

export interface RespoItem {
  id: string
  nama: string
  catatan?: string
  m_unit_bisnis_id: string
  unit_bisnis?: {
    id: string
    nama_comp: string
    kode_unit_bisnis?: string
  }
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Detail items - Backend returns pluralized
  m_respo_ds?: RespoDetail[]
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

export interface RespoListResponse {
  status: string
  data: RespoItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_respo data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_respo list
 */
export async function getRespoList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: Record<string, string>,
  where?: string
): Promise<RespoListResponse> {
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
  
  if (where) {
    queryParams.append('where', where)
  }

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value)
      }
    })
  }
  
  // Include relations to get detail counts
  queryParams.append('include', 'm_respo_d>m_role,m_unit_bisnis')
  
  return apiCall<RespoListResponse>(`/dynamic/m_respo?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Respo by ID with details
 * @param id - Respo ID
 * @returns Promise with m_respo detail
 */
export async function getRespoById(id: string): Promise<{ status: string; data: RespoItem }> {
  return apiCall(`/dynamic/m_respo/${id}?include=m_respo_d%3Em_role,m_unit_bisnis`, {
    method: 'GET'
  })
}

/**
 * Create new Respo with details
 * @param data - m_respo data with m_respo_d details
 * @returns Promise with created Respo
 */
export async function createRespo(data: Partial<RespoItem>): Promise<{ status: string; data: RespoItem }> {
  return apiCall('/dynamic/m_respo/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Respo with details
 * @param id - Respo ID
 * @param data - m_respo data with m_respo_d details
 * @returns Promise with updated Respo
 */
export async function updateRespo(id: string, data: Partial<RespoItem>): Promise<{ status: string; data: RespoItem }> {
  return apiCall(`/dynamic/m_respo/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Respo
 * @param id - Respo ID
 * @returns Promise with delete confirmation
 */
export async function deleteRespo(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_respo/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_respo data without pagination (for sidebar)
 * @returns Promise with m_respo list
 */
export async function getRespoListNoPagination(): Promise<RespoListResponse> {
  return apiCall<RespoListResponse>('/dynamic/m_respo?no_pagination=true', {
    method: 'GET'
  })
}
