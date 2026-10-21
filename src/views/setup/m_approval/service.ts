import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ApprovalDItem {
  level?: number  // 0=submitter, 1-100=approver
  m_unit_bisnis_id?: string
  // Reserved for DB schema compat, not actively used in UI
  // max_disc_value?: number
  is_full?: boolean
  user_default_id?: string
  tipe_approval_id?: string
  is_active?: boolean
  tipe_approval?: 'USER' | 'RESPO'  // baru: tipe approver
  respo_id?: string                  // baru: FK ke m_respo jika tipe = RESPO
  approval_role?: 'GUDANG_TUJUAN' | 'GUDANG_ASAL' | null  // baru: peran dalam double approval
  // Relations for display
  unit_bisnis?: { id: string; nama_comp?: string }
  user?: { id: string; name?: string }
  tipe?: { id: string; value1?: string }
  respo?: { id: string; nama?: string }  // baru: relasi ke m_respo
}

export interface ApprovalItem {
  id: string
  kode_approval: string
  nama_approval: string
  m_menu_id?: string
  catatan?: string
  is_use_limit?: boolean
  min_val?: number
  max_val?: number
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Relations
  menu?: { id: string; menu_label?: string }
  // Detail items (m_approval_ds)
  m_approval_ds?: ApprovalDItem[]
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

export interface ApprovalListResponse {
  status: string
  data: ApprovalItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_approval data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_approval list
 */
export async function getApprovalList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<ApprovalListResponse> {
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
  
  return apiCall<ApprovalListResponse>(`/dynamic/m_approval?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Approval by ID
 * @param id - Approval ID
 * @returns Promise with m_approval detail
 */
export async function getApprovalById(id: string): Promise<{ status: string; data: ApprovalItem }> {
  // Backend expects include using m_approval_d (singular) relation keys
  const queryParams = new URLSearchParams({
    include: 'm_approval_d>user_default,m_approval_d>m_general,m_approval_d>m_unit_bisnis'
  })
  
  return apiCall(`/dynamic/m_approval/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Approval
 * @param data - m_approval data
 * @returns Promise with created Approval
 */
export async function createApproval(data: Partial<ApprovalItem>): Promise<{ status: string; data: ApprovalItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_approval_ds && data.m_approval_ds.length > 0)
  const endpoint = hasDetails ? '/dynamic/m_approval/with-details' : '/dynamic/m_approval'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Approval
 * @param id - Approval ID
 * @param data - m_approval data to update
 * @returns Promise with updated Approval
 */
export async function updateApproval(id: string, data: Partial<ApprovalItem>): Promise<{ status: string; data: ApprovalItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_approval_ds && data.m_approval_ds.length > 0)
  const endpoint = hasDetails ? `/dynamic/m_approval/with-details/${id}` : `/dynamic/m_approval/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Approval
 * @param id - Approval ID
 * @returns Promise with delete confirmation
 */
export async function deleteApproval(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_approval/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_approval data without pagination (for sidebar)
 * @returns Promise with m_approval list
 */
export async function getApprovalListNoPagination(): Promise<ApprovalListResponse> {
  return apiCall<ApprovalListResponse>('/dynamic/m_approval?no_pagination=true', {
    method: 'GET'
  })
}
