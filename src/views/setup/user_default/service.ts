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
  password?: string
  role_id?: string
  role?: { id: string; nama_role: string; system_key: string | null }
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
export async function getUserDefaultList(page=1, paginate=10, order_by='createdAt', order_type: 'ASC' | 'DESC'='DESC', search?: string, searchfield?: string, _companyId?: string): Promise<UserDefaultListResponse> {
 const params = new URLSearchParams({ page:String(page), paginate:String(paginate), order_by, order_type, search:search || '' })
 return apiCall('/dynamic/user_default?' + params)
}
export async function getUserDefaultById(id: string): Promise<{status: string; data: UserDefaultItem}> {
 const result = await apiCall<{status:string;data:UserDefaultItem}>('/dynamic/user_default/' + id)
 const role = result.data.role
 return { ...result, data: { ...result.data, user_details: role ? [{m_respo_id: role.id, is_primary:true, is_active:true, m_respo:{id:role.id,name:role.nama_role}}] : [] } }
}
export function userPayload(data: Partial<UserDefaultItem>) {
 const role_id = data.role_id || data.user_details?.[0]?.m_respo_id
 if (!role_id || (data.user_details && (data.user_details.length !== 1 || data.user_details[0]?.is_active === false))) throw new Error('Pilih satu role aktif untuk akun ini')
 return { name:data.name || data.username, username:data.username, role_id, is_active:data.is_active !== false, catatan:data.catatan || null, ...(data.password ? {password:data.password} : {}) }
}
export const createUserDefault = (data:Partial<UserDefaultItem>, _hasDetails=false) => apiCall<{status:string;data:UserDefaultItem}>('/dynamic/user_default',{method:'POST',body:JSON.stringify(userPayload(data))})
export const updateUserDefault = (id:string,data:Partial<UserDefaultItem>, _hasDetails=false) => apiCall<{status:string;data:UserDefaultItem}>('/dynamic/user_default/'+id,{method:'PUT',body:JSON.stringify(userPayload(data))})
export const deleteUserDefault = (id:string) => apiCall<{status:string;message:string}>('/dynamic/user_default/'+id,{method:'DELETE'})
export const getUserDefaultListNoPagination = () => apiCall<UserDefaultListResponse>('/dynamic/user_default?no_pagination=true')
