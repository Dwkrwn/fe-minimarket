import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TransformItemNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_transform_item_id?: string
  sender_id: string
  user_approved_id?: string
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
  // Alias untuk sender (dari relasi)
  tpr_sender?: {
    id: string
    name: string
  }
  // Alias untuk approver (dari relasi)
  tpr_approval?: {
    id: string
    name: string
  }
  t_transform_item?: {
    id: string
    status: string
    catatan?: string
    created_by?: string
    updated_by?: string
    createdAt?: string
    updatedAt?: string
    // Add more fields based on your data structure
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
  notification_type?: 'transform_item'
}

export interface TransformItemNotificationResponse {
  data: TransformItemNotification[]
  status: string
  approval?: TransformItemNotification[]
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

/**
 * Get approval data from localStorage by path
 */
function getApprovalByPath(path: string): { level: number; sender_id: string; id: string | null } | null {
  const approvalListStr = localStorage.getItem('approval_list')
  const authData = localStorage.getItem('auth_bb')
  
  if (!approvalListStr || !authData) return null
  
  try {
    const approvalList = JSON.parse(approvalListStr)
    const auth = JSON.parse(authData)
    
    const approval = approvalList.find((a: any) => 
      a.path === path && 
      a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
    )
    
    if (!approval) return null
    
    return {
      level: approval.level,
      sender_id: auth.user?.id || '',
      id: approval.id || null
    }
  } catch (e) {
    console.error('Failed to parse approval data:', e)
    return null
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Transform Item Notifications for approval
 */
export async function getTransformItemNotifications(page = 1, limit = 10): Promise<TransformItemNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_transform_item_notifikasi/getUserApprovalTransformItem?id=${userId}&include=t_transform_item.m_unit_bisni,t_transform_item.jenis_transform_general,t_transform_item.warehouse_transform,t_transform_item.item,t_transform_item.satuan,t_transform_item.stock_gudang.m_rak,t_transform_item.pic,t_transform_item.t_transform_item_ds,user_default,tti_sender`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: TransformItemNotification) => ({
    ...item,
    notification_type: 'transform_item' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Mark Transform Item notification as read
 */
export async function markTransformItemNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_transform_item_notifikasi`,
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
 * Approve Transform Item - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approveTransformItem(
  t_transform_item_id: string,
  t_transform_item_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/inventory/transaksi/t_transform_item')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_transform_item/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_transform_item_id,
        t_transform_item_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: approvalData.sender_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}

/**
 * Revise Transform Item - POST to custom endpoint
 */
export async function reviseTransformItem(
  t_transform_item_id: string, 
  t_transform_item_notifikasi_id: string, 
  approval_level: number, 
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/inventory/transaksi/t_transform_item')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_transform_item/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_transform_item_id,
        t_transform_item_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: approvalData.sender_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}

/**
 * Reject Transform Item - POST to custom endpoint
 */
export async function rejectTransformItem(
  t_transform_item_id: string,
  t_transform_item_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/inventory/transaksi/t_transform_item')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_transform_item/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_transform_item_id,
        t_transform_item_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: approvalData.sender_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}

/**
 * Get Revisi notifications for Transform Item (where sender_id = current user, status_name = REVISI)
 */
export async function getTransformItemRevisiNotifications(page = 1, limit = 10): Promise<TransformItemNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_transform_item_notifikasi?where=status%3Dfalse&include=t_transform_item:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: TransformItemNotification) => ({
    ...item,
    notification_type: 'transform_item' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Pending Approval notifications for Transform Item (where sender_id = current user, status_name = IN APPROVAL)
 */
export async function getPendingTransformItemNotifications(page = 1, limit = 10): Promise<TransformItemNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_transform_item_notifikasi?where=status%3Dfalse&include=t_transform_item:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: TransformItemNotification) => ({
    ...item,
    notification_type: 'transform_item' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Transform Item (Pending + Revisi)
 */
export async function getTransformItemCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: TransformItemNotification[]
  revisi: TransformItemNotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingTransformItemNotifications(page, limit).catch(() => ({ data: [] })),
    getTransformItemRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}
