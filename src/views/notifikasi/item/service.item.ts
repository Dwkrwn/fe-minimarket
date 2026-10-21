import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ItemNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  m_items_id?: string
  sender_id: string
  approval_level: number
  status: boolean
  status_name?: string
  createdAt: string
  updatedAt: string
  user_default?: {
    id: string
    name: string
    username?: string
    catatan?: string
    tipe_user_id?: string
    is_active?: boolean
    m_kary_id?: string | null
    createdAt?: string
    updatedAt?: string
  }
  m_item?: {
    id: string
    kode_item: string | null
    nama_item: string
    nama_singkat: string
    is_active: boolean
    status: string
    spesifikasi: string
    tipe_barang: string
    min_stock: string
    max_stock: string
    m_group_jenis_id: string
    m_group_tipe_id: string
    m_group_merek_id: string
    m_group_ukuran_id: string
    m_group_batch_id: string
    satuan_id: string
    gambar: string
    catatan: string
    created_by: string
    updated_by: string
    is_skip: boolean
    createdAt: string
    updatedAt: string
    m_items_images?: Array<{
      id: string
      m_items_id: string
      gambar: string
      note: string | null
      createdAt: string
      updatedAt: string
    }>
    user_default?: {
      id: string
      name: string
    }
    uom?: {
      id: string
      value1: string
    }
    m_group_jeni?: {
      id: string
      nama_jenis: string
      is_active: boolean
      catatan: string
      createdAt: string
      updatedAt: string
    }
    m_group_merek?: {
      id: string
      nama_merek: string
      is_active: boolean
      catatan: string
      m_group_jenis_id: string
      createdAt: string
      updatedAt: string
    }
    m_group_tipe?: {
      id: string
      nama_tipe: string
      is_active: boolean
      catatan: string
      m_group_merek_id: string
      createdAt: string
      updatedAt: string
    }
    m_group_ukuran?: {
      id: string
      nama_ukuran: string
      is_active: boolean
      catatan: string | null
      m_group_tipe_id: string
      createdAt: string
      updatedAt: string
    }
    m_group_batch?: {
      id: string
      nama_batch: string
      is_active: boolean
      catatan: string | null
      m_group_ukuran_id: string
      createdAt: string
      updatedAt: string
    }
  }
  menu_info?: {
    approval_detail_id: string
    level: number
    approval_id: string
    approval_name: string
    menu_id: string
    menu_name: string
    menu_path: string
    syarat?: any[]
  }
  notification_type?: 'items'
}

export interface ItemNotificationResponse {
  data: ItemNotification[]
  status: string
  approval?: ItemNotification[]
  pagination?: {
    total: number
    page: number
    totalPages: number
    limit: number
    currentRowsCount: number
    next_page: number | null
    prev_page: number | null
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getUserId(): string {
  const authData = localStorage.getItem('auth_bb')
  if (authData) {
    try {
      const parsed = JSON.parse(authData)
      return parsed.user?.id || ''
    } catch (e) {
      console.error('Failed to parse auth data:', e)
    }
  }
  return ''
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Item Notifications for approval
 */
export async function getItemsNotifications(page = 1, limit = 10): Promise<ItemNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/m_items_notifikasi/getUserApprovalData?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: ItemNotification) => ({
    ...item,
    notification_type: 'items' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Revisi notifications for Items (where sender_id = current user)
 */
export async function getRevisiNotifications(page = 1, limit = 10): Promise<ItemNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/m_items_notifikasi?where=status_name=REVISI&include=m_items&filter_column_sender_id=${userId}&filter_column_status=false&page=${page}&paginate=${limit}`,
    { method: 'GET' }
  )
  
  return {
    status: response.status,
    data: response.data || [],
    pagination: response.pagination
  }
}

/**
 * Mark notification as read
 */
export async function markItemNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/m_items_notifikasi`,
    {
      method: 'POST',
      body: JSON.stringify({
        id,
        status: true,
      }),
    }
  )
}

/**
 * Approve Item notification
 */
export async function approveItemNotification(id: string, approval_level: number, approval_catatan: string): Promise<any> {
  return apiCall(
    `/dynamic/m_items_notifikasi/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        approval_level,
        approval_catatan,
      }),
    }
  )
}

/**
 * Revise Item - POST to /fn/m_items/revisi
 */
export async function reviseItem(
  m_items_id: string, 
  m_items_notifikasi_id: string, 
  approval_level: number, 
  approval_catatan: string
): Promise<any> {
  return apiCall(
    `/fn/m_items/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        m_items_id,
        m_items_notifikasi_id,
        approval_level,
        approval_catatan,
      }),
    }
  )
}

/**
 * Update Item status to APPROVED
 */
export async function updateItemStatus(itemId: string, status: 'APPROVED'): Promise<any> {
  return apiCall(
    `/dynamic/m_items/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        status,
      }),
    }
  )
}
