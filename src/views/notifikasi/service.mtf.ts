import { apiCall } from '@/lib/api'
import type { MtfItem } from '@/views/production/transaksi/t_mtf/service'

// ============================================================================
// INTERFACES
// ============================================================================

export interface MtfNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_mtf_id?: string
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
  tmtf_sender?: {
    id: string
    name: string
  }
  // Alias untuk approver (dari relasi)
  tpr_approval?: {
    id: string
    name: string
  }
  tmtf_approval?: {
    id: string
    name: string
  }
  t_mtf?: MtfItem
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
  notification_type?: 'mtf'
}

export interface MtfNotificationResponse {
  data: MtfNotification[]
  status: string
  approval?: MtfNotification[]
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
 * Get Mtf Notifications for approval
 */
export async function getMtfNotifications(page = 1, limit = 10): Promise<MtfNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_material_transfer_notifikasi/getUserApprovalMtf?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: MtfNotification) => ({
    ...item,
    notification_type: 'mtf' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Mark Mtf notification as read
 */
export async function markMtfNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_material_transfer_notifikasi`,
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
 * Approve Mtf - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approveMtf(
  t_mtf_id: string,
  t_mtf_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
  details?: { id: string; qty_confirm: number; reason_confirm: string }[]
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_mtf')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_mtf/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_mtf_id,
        t_mtf_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: approvalData.sender_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
        details,
      }),
    }
  )

  return result
}

/**
 * Revise Mtf - POST to custom endpoint
 */
export async function reviseMtf(
  t_mtf_id: string, 
  t_mtf_notifikasi_id: string, 
  approval_level: number, 
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_mtf')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_mtf/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_mtf_id,
        t_mtf_notifikasi_id,
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
 * Reject Mtf - POST to custom endpoint
 */
export async function rejectMtf(
  t_mtf_id: string,
  t_mtf_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_mtf')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_mtf/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_mtf_id,
        t_mtf_notifikasi_id,
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
 * Get Revisi notifications for Mtf (where sender_id = current user, status_name = REVISI)
 */
export async function getMtfRevisiNotifications(page = 1, limit = 10): Promise<MtfNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_material_transfer_notifikasi?where=status%3Dfalse&include=t_mtf:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: MtfNotification) => ({
    ...item,
    notification_type: 'mtf' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Pending Approval notifications for Mtf (where sender_id = current user, status_name = IN APPROVAL)
 */
export async function getPendingMtfNotifications(page = 1, limit = 10): Promise<MtfNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_material_transfer_notifikasi?where=status%3Dfalse&include=t_mtf:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: MtfNotification) => ({
    ...item,
    notification_type: 'mtf' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Mtf (Pending + Revisi)
 */
export async function getMtfCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: MtfNotification[]
  revisi: MtfNotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingMtfNotifications(page, limit).catch(() => ({ data: [] })),
    getMtfRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}

/**
 * Get single Mtf Notification by ID
 */
export async function getMtfNotificationById(id: string): Promise<{ status: string; data: MtfNotification }> {
  const userId = getUserId()
  return apiCall<{ status: string; data: MtfNotification }>(
    `/fn/t_material_transfer_notifikasi/getMtfNotificationById?id=${id}&userId=${userId}`,
    { method: 'GET' }
  )
}
