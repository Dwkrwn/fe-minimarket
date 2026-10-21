import { apiCall } from '@/lib/api'

export interface UserDetailItem {
  is_primary?: boolean
  is_active?: boolean
  user_default_id?: string
  m_respo_id?: string
  m_respo?: {
    id: string
    name?: string
  }
}

export interface UserDefaultItem {
  id: string
  // COMMENTED [tipe_user_id]: start
  // tipe_user_id?: string
  // COMMENTED [tipe_user_id]: end
  m_kary_id?: string
  is_active?: boolean
  name?: string
  username: string
  password: string
  catatan?: string
  createdAt: string
  updatedAt: string
  // COMMENTED [tipe_user_id]: start
  // tipe?: {
  //   id: string
  //   value1: string
  // }
  // COMMENTED [tipe_user_id]: end
  // Karyawan dengan relasi ke unit bisnis (company)
  karyawan?: {
    id: string
    nama_kary: string
    m_unit_bisnis_id?: string
    m_unit_bisni?: {
      id: string
      nama_comp: string
    }
  }
  user_details?: UserDetailItem[]
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

export interface UserDefaultListResponse {
  status: string
  data: UserDefaultItem[]
  pagination: Pagination
}

/**
 * Get all user_default data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Order by column (default: 'createdAt')
 * @param order_type - Order type ASC or DESC (default: 'DESC')
 * @param search - Search query (optional)
 * @param searchfield - Fields to search in (optional)
 * @param companyId - Filter by company/unit bisnis ID (optional, for non-super admin)
 * @returns Promise with user_default list
 */
export async function getUserDefaultList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  companyId?: string
): Promise<UserDefaultListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    // COMMENTED [tipe_user_id]: m_general@tipe removed from include
    include: 'm_kary@karyawan:nama_kary|id|m_unit_bisnis_id,m_kary>m_unit_bisnis:nama_comp|id', // Include m_kary only
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  // Filter by company if provided (for non-super admin)
  // Filter berdasarkan m_unit_bisnis_id dari relasi m_kary
  if (companyId) {
    queryParams.append('filter_column_m_kary.m_unit_bisnis_id', companyId)
  }
  
  return apiCall<UserDefaultListResponse>(`/dynamic/user_default?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get UserDefault by ID
 * @param id - UserDefault ID
 * @returns Promise with user_default detail
 */
export async function getUserDefaultById(id: string): Promise<{ status: string; data: UserDefaultItem }> {
  const queryParams = new URLSearchParams({
    include: 'user_detail>m_respo' // Include user_detail with m_respo relation
  })
  return apiCall(`/dynamic/user_default/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new UserDefault
 * @param data - user_default data
 * @param hasDetails - Whether data includes user_details
 * @returns Promise with created UserDefault
 */
export async function createUserDefault(
  data: Partial<UserDefaultItem>, 
  hasDetails: boolean = false
): Promise<{ status: string; data: UserDefaultItem }> {
  const endpoint = hasDetails ? '/dynamic/user_default/with-details' : '/dynamic/user_default'
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update UserDefault
 * @param id - UserDefault ID
 * @param data - user_default data to update
 * @param hasDetails - Whether data includes user_details
 * @returns Promise with updated UserDefault
 */
export async function updateUserDefault(
  id: string, 
  data: Partial<UserDefaultItem>,
  hasDetails: boolean = false
): Promise<{ status: string; data: UserDefaultItem }> {
  const endpoint = hasDetails ? `/dynamic/user_default/with-details/${id}` : `/dynamic/user_default/${id}`
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete UserDefault
 * @param id - UserDefault ID
 * @returns Promise with delete confirmation
 */
export async function deleteUserDefault(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/user_default/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all user_default data without pagination (for sidebar)
 * @returns Promise with user_default list
 */
export async function getUserDefaultListNoPagination(): Promise<UserDefaultListResponse> {
  return apiCall<UserDefaultListResponse>('/dynamic/user_default?no_pagination=true', {
    method: 'GET'
  })
}
