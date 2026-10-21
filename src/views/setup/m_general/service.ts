import { apiCall } from '@/lib/api'

export interface GeneralItem {
  id: string
  group: string
  key1: string
  code: string
  value1: string
  value2: string
  value3: string
  value4: string
  value5: string
  is_active: boolean
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

export interface GeneralListResponse {
  status: string
  data: GeneralItem[]
  pagination: Pagination
}

/**
 * Get all m_general data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Order by column (default: 'createdAt')
 * @param order_type - Order type ASC or DESC (default: 'DESC')
 * @param search - Search query (optional)
 * @param searchfield - Fields to search in (optional)
 * @returns Promise with m_general list
 */
export async function getGeneralList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<GeneralListResponse> {
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
  
  return apiCall<GeneralListResponse>(`/dynamic/m_general?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get General by ID
 * @param id - General ID
 * @returns Promise with m_general detail
 */
export async function getGeneralById(id: string): Promise<{ status: string; data: GeneralItem }> {
  return apiCall(`/dynamic/m_general/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new General
 * @param data - m_general data
 * @returns Promise with created General
 */
export async function createGeneral(data: Partial<GeneralItem>): Promise<{ status: string; data: GeneralItem }> {
  return apiCall('/dynamic/m_general', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update General
 * @param id - General ID
 * @param data - m_general data to update
 * @returns Promise with updated General
 */
export async function updateGeneral(id: string, data: Partial<GeneralItem>): Promise<{ status: string; data: GeneralItem }> {
  return apiCall(`/dynamic/m_general/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete General
 * @param id - General ID
 * @returns Promise with delete confirmation
 */
export async function deleteGeneral(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic  /m_general/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_general data without pagination (for sidebar)
 * @returns Promise with m_general list
 */
export async function getGeneralListNoPagination(): Promise<GeneralListResponse> {
  return apiCall<GeneralListResponse>('/dynamic/m_general?no_pagination=true', {
    method: 'GET'
  })
}
