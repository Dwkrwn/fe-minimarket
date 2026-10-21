import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface GCategoryItem {
  id: string
  update_by?: string | null
  updated_by?: string | null
  /** Status pencatatan: 'DRAFT' atau 'POST'. Auto-set saat create berdasarkan role pembuat. */
  status?: string
  /** Status aktif/nonaktif (boolean, 1/0) */
  is_active?: boolean
  created_by?: string | null
  code?: string | null
  name?: string | null
  catatan?: string | null
  createdAt: string
  updatedAt: string
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

export interface GCategoryListResponse {
  status: string
  data: GCategoryItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_g_category data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_g_category list
 */
export async function getGCategoryList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<GCategoryListResponse> {
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
  
  return apiCall<GCategoryListResponse>(`/dynamic/m_g_category?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get GCategory by ID
 * @param id - GCategory ID
 * @returns Promise with m_g_category detail
 */
export async function getGCategoryById(id: string): Promise<{ status: string; data: GCategoryItem }> {
  return apiCall(`/dynamic/m_g_category/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new GCategory
 * @param data - m_g_category data
 * @returns Promise with created GCategory
 */
export async function createGCategory(data: Partial<GCategoryItem>): Promise<{ status: string; data: GCategoryItem }> {
  return apiCall('/dynamic/m_g_category', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update GCategory
 * @param id - GCategory ID
 * @param data - m_g_category data to update
 * @returns Promise with updated GCategory
 */
export async function updateGCategory(id: string, data: Partial<GCategoryItem>): Promise<{ status: string; data: GCategoryItem; message?: string }> {
  return apiCall(`/dynamic/m_g_category/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete GCategory
 * @param id - GCategory ID
 * @returns Promise with delete confirmation
 */
export async function deleteGCategory(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g_category/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_g_category data without pagination (for sidebar)
 * @returns Promise with m_g_category list
 */
export async function getGCategoryListNoPagination(): Promise<GCategoryListResponse> {
  return apiCall<GCategoryListResponse>('/dynamic/m_g_category?no_pagination=true', {
    method: 'GET'
  })
}
