import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface G1TypeItem {
  id: string
  category_id?: string | null
  code?: string | null
  name?: string | null
  status?: string
  is_active?: boolean
  catatan?: string | null
  created_by?: string | null
  update_by?: string | null
  updated_by?: string | null
  createdAt: string
  updatedAt: string
  m_g_category?: {
    id: string
    code?: string | null
    name?: string | null
    status?: string
    is_active?: boolean
    catatan?: string | null
  } | null
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

export interface G1TypeListResponse {
  status: string
  data: G1TypeItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_g1_type data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_g1_type list
 */
export async function getG1TypeList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<G1TypeListResponse> {
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

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim())
      }
    })
  }

  queryParams.append('join', 'true')
  
  return apiCall<G1TypeListResponse>(`/dynamic/m_g1_type?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get G1Type by ID
 * @param id - G1Type ID
 * @returns Promise with m_g1_type detail
 */
export async function getG1TypeById(id: string): Promise<{ status: string; data: G1TypeItem }> {
  const queryParams = new URLSearchParams({
    join: 'true'
  })

  return apiCall(`/dynamic/m_g1_type/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new G1Type
 * @param data - m_g1_type data
 * @returns Promise with created G1Type
 */
export async function createG1Type(data: Partial<G1TypeItem>): Promise<{ status: string; data: G1TypeItem }> {
  return apiCall('/dynamic/m_g1_type', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update G1Type
 * @param id - G1Type ID
 * @param data - m_g1_type data to update
 * @returns Promise with updated G1Type
 */
export async function updateG1Type(id: string, data: Partial<G1TypeItem>): Promise<{ status: string; data: G1TypeItem; message?: string }> {
  return apiCall(`/dynamic/m_g1_type/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete G1Type
 * @param id - G1Type ID
 * @returns Promise with delete confirmation
 */
export async function deleteG1Type(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g1_type/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_g1_type data without pagination (for sidebar)
 * @returns Promise with m_g1_type list
 */
export async function getG1TypeListNoPagination(): Promise<G1TypeListResponse> {
  return apiCall<G1TypeListResponse>('/dynamic/m_g1_type?no_pagination=true', {
    method: 'GET'
  })
}
