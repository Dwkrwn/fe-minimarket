import { apiCall } from '@/lib/api'
import type { RcItem } from '@/views/production/transaksi/t_rc/service'

// ============================================================================
// INTERFACES
// ============================================================================

export interface RcNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_rc_id?: string
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
  }
  trc_sender?: {
    id: string
    name: string
  }
  trc_approval?: {
    id: string
    name: string
  }
  t_rc?: RcItem
  menu_info?: {
    approval_detail_id?: string
    level: number
    approval_id?: string
    approval_name: string
    menu_id?: string
    menu_name: string
    menu_path: string
  }
  notification_type?: 'rc'
}

export interface RcNotificationResponse {
  data: RcNotification[]
  status: string
  approval?: RcNotification[]
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
 * Get Rc Notifications for approval
 */
export async function getRcNotifications(page = 1, limit = 10): Promise<RcNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_result_confirm_notifikasi/getUserApprovalRc?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: RcNotification) => ({
    ...item,
    notification_type: 'rc' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get single notification detail
 */
export async function getRcNotificationById(id: string, userId: string): Promise<any> {
  return apiCall(`/fn/t_result_confirm_notifikasi/getRcNotificationById?id=${id}&userId=${userId}`, {
    method: 'GET'
  })
}

/**
 * Receive Result Confirmation - POST to custom endpoint
 */
export async function receiveRc(
  t_rc_id: string,
  t_rc_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
  details: { id: string; qty_received: number; notes: string }[]
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_rc') || getApprovalByPath('/production/transaksi/t_rc_wip')
  const userId = approvalData?.sender_id || getUserId()
  const approvalId = approvalData?.id || null

  const result = await apiCall(
    `/fn/t_result_confirm_notifikasi/receive`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_rc_id,
        t_rc_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: userId,
        sender_id: userId,
        m_approval_id: approvalId,
        details,
      }),
    }
  )

  return result
}

/**
 * Revise Result Confirmation
 */
export async function reviseRc(
  t_rc_id: string,
  t_rc_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_rc') || getApprovalByPath('/production/transaksi/t_rc_wip')
  const userId = approvalData?.sender_id || getUserId()

  return apiCall(
    `/fn/t_result_confirm_notifikasi/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_rc_id,
        t_rc_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: userId,
      }),
    }
  )
}

/**
 * Reject Result Confirmation
 */
export async function rejectRc(
  t_rc_id: string,
  t_rc_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_rc') || getApprovalByPath('/production/transaksi/t_rc_wip')
  const userId = approvalData?.sender_id || getUserId()

  return apiCall(
    `/fn/t_result_confirm_notifikasi/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_rc_id,
        t_rc_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id: userId,
      }),
    }
  )
}
