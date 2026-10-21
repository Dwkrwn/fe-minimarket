import { apiCall } from '@/lib/api'

export interface MenuItem {
  id: string
  name: string
  desc: string
  sub_modul: string
  icon: string
  is_active: boolean
  seq: string
  modul: string
  path: string
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

export interface MenuListResponse {
  status: string
  data: MenuItem[]
  pagination: Pagination
}

/**
 * Get all menu data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with menu list
 */
export async function getMenuList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<MenuListResponse> {
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

  return apiCall<MenuListResponse>(`/dynamic/m_menu?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get menu by ID
 * @param id - Menu ID
 * @returns Promise with menu detail
 */
export async function getMenuById(id: string): Promise<{ status: string; data: MenuItem }> {
  return apiCall(`/dynamic/m_menu/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new menu
 * @param data - Menu data
 * @returns Promise with created menu
 */
export async function createMenu(data: Partial<MenuItem>): Promise<{ status: string; data: MenuItem }> {
  return apiCall('/dynamic/m_menu', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update menu
 * @param id - Menu ID
 * @param data - Menu data to update
 * @returns Promise with updated menu
 */
export async function updateMenu(id: string, data: Partial<MenuItem>): Promise<{ status: string; data: MenuItem }> {
  return apiCall(`/dynamic/m_menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete menu
 * @param id - Menu ID
 * @returns Promise with delete confirmation
 */
export async function deleteMenu(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_menu/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all menu data without pagination (for sidebar)
 * @returns Promise with menu list
 */
export async function getMenuListNoPagination(): Promise<MenuListResponse> {
  return apiCall<MenuListResponse>('/dynamic/m_menu?no_pagination=true&order_by_raw=seq%20ASC', {
    method: 'GET'
  })
}
