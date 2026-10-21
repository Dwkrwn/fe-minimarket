import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PrecostNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_precost_id?: string
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
  t_precost?: {
    id: string
    status: string
    catatan?: string
    created_by?: string
    updated_by?: string
    createdAt?: string
    updatedAt?: string
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
  notification_type?: 'precost'
}

export interface PrecostNotificationResponse {
  data: PrecostNotification[]
  status: string
  approval?: PrecostNotification[]
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
 * Get Precost Notifications for approval
 */
export async function getPrecostNotifications(page = 1, limit = 10): Promise<PrecostNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_precosting_notifikasi/getUserApprovalPrecost?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: PrecostNotification) => ({
    ...item,
    notification_type: 'precost' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get single Precost Notification by ID
 */
export async function getPrecostNotificationById(notificationId: string): Promise<PrecostNotification> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_precosting_notifikasi/getPrecostNotificationById?id=${notificationId}&userId=${userId}`,
    { method: 'GET' }
  )
  
  if (response.status === 'success' && response.data) {
    return {
      ...response.data,
      notification_type: 'precost' as const
    }
  }
  
  throw new Error(response.message || 'Failed to fetch notification')
}

/**
 * Mark Precost notification as read
 */
export async function markPrecostNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_precosting_notifikasi`,
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
 * Approve Precost - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approvePrecost(
  t_precost_id: string,
  t_precosting_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_precost')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const effectiveLevel = approvalData.level ?? approval_level

  const result = await apiCall(
    `/fn/t_precost/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_precost_id,
        t_precosting_notifikasi_id,
        approval_level: effectiveLevel,
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
 * Revise Precost - POST to custom endpoint
 */
export async function revisePrecost(
  t_precost_id: string, 
  t_precosting_notifikasi_id: string, 
  approval_level: number, 
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_precost')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const effectiveLevel = approvalData.level ?? approval_level

  const result = await apiCall(
    `/fn/t_precost/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_precost_id,
        t_precosting_notifikasi_id,
        approval_level: effectiveLevel,
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
 * Reject Precost - POST to custom endpoint
 */
export async function rejectPrecost(
  t_precost_id: string,
  t_precosting_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/production/transaksi/t_precost')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const effectiveLevel = approvalData.level ?? approval_level

  const result = await apiCall(
    `/fn/t_precost/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_precost_id,
        t_precosting_notifikasi_id,
        approval_level: effectiveLevel,
        approval_catatan,
        user_approved_id: approvalData.sender_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}
