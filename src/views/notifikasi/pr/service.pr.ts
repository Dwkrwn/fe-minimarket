import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PRNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_purchase_request_id?: string
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

  t_purchase_request?: {
    id: string
    no_pr: string
    tgl_pr: string
    tgl_butuh: string
    catatan: string
    status: string
    req_type_user: string
    req_user_by: string
    m_unit_bisnis_id?: string | null
    prioritas_id?: string
    ref_so_id?: string | null
    created_by?: string
    updated_by?: string
    createdAt?: string
    updatedAt?: string
    m_general?: {
      id: string
      group?: string
      key1?: string
      code?: string
      value1: string // Prioritas
      value2?: string | null
      is_active?: boolean
    }
  m_unit_bisni?: {
    id: string
    nama_comp: string
  }
  m_gudang?: {
    id: string
    nama_gudang: string
  }
    prq_ctr?: {
      id: string
      name: string
    }
    prq_update?: {
      id: string
      name: string
    }
    t_purchase_request_ds?: Array<{
      id: string
      t_purchase_request_id: string
      m_items_id: string
      qty_pr: number
      alasan: string
      catatan: string
      created_by: string
      updated_by: string
      createdAt: string
      updatedAt: string
      m_item?: {
        id: string
        kode_item: string
        nama_item: string
        nama_singkat: string
        is_active: boolean
        status: string
        spesifikasi?: string
        tipe_barang?: string
        min_stock?: string
        max_stock?: string
        satuan_id?: string
        catatan?: string
        optimum_stock?: string
        mi_uom?: {
          id: string
          value1: string
        }
        m_items_images?: Array<{
          id: string
          gambar: string
        }>
      }
    }>
    t_purchase_request_lampirans?: Array<{
      id: string
      t_purchase_requ?: string
      lampiran: string
      created_by: string
      updated_by: string
      createdAt: string
      updatedAt: string
    }>
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
  notification_type?: 'purchase_request'
}

export interface PRNotificationResponse {
  data: PRNotification[]
  status: string
  approval?: PRNotification[]
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
 * @param path - The menu path to match (e.g., '/purchasing/transaksi/t_purchase_request')
 * @returns Approval data object with id and sender_id, or null if not found
 */
function getApprovalByPath(path: string): { id: string; sender_id: string; level: number } | null {
  const approvalList = localStorage.getItem('approval_list')
  if (approvalList) {
    try {
      const parsed = JSON.parse(approvalList)
      const approval = parsed.find((a: any) =>
        a.path === path &&
        a.tipe_approve?.toUpperCase() === 'MENYETUJUI'
      )
      if (approval) {
        return {
          id: approval.id,
          sender_id: approval.sender_id,
          level: approval.level
        }
      }
    } catch (e) {
      console.error('Failed to parse approval_list:', e)
    }
  }
  return null
}

// Purchase Request path constant
const PR_PATH = '/purchasing/transaksi/t_purchase_request'

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Purchase Request Notifications for approval
 */
export async function getPurchaseRequestNotifications(page = 1, limit = 10): Promise<PRNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_request_notifikasi/getUserApprovalPurchaseRequest?id=${userId}`,
    { method: 'GET' }
  )

  const data = (response.approval || []).map((item: PRNotification) => ({
    ...item,
    notification_type: 'purchase_request' as const
  }))

  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get PR Pending Approval Notifications for the sender (user who created the PR)
 * This shows notifications when their PR is waiting for approval (IN APPROVAL status)
 */
export async function getPRPendingApprovalNotifications(page = 1, limit = 10): Promise<PRNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_request_notifikasi?where=status%3Dfalse&include=t_purchase_request:id|no_pr,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )

  const data = (response.data || []).map((item: PRNotification) => ({
    ...item,
    notification_type: 'purchase_request' as const
  }))

  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}
/**
 * Mark PR notification as read
 */
export async function markPRNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_purchase_request_notifikasi`,
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
 * Approve Purchase Request - POST to /fn/t_purchase_request/approve
 * Updates both PR status and notification
 */
export async function approvePurchaseRequest(
  purchase_request_id: string,
  purchase_request_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PR_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Request')
  }

  // Call custom endpoint - backend handles status update based on approval level
  const result = await apiCall(
    `/fn/t_purchase_request/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_request_id,
        purchase_request_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  // NOTE: Tidak perlu PUT manual ke t_purchase_request
  // Backend sudah handle update status berdasarkan:
  // - Jika level terakhir atau is_full = true → status = APPROVED
  // - Jika masih ada level berikutnya → status = IN APPROVAL

  return result
}

/**
 * Revise Purchase Request - POST to /fn/t_purchase_request/revisi
 * Updates both PR status and notification
 */
export async function revisePurchaseRequest(
  purchase_request_id: string,
  purchase_request_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PR_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Request')
  }

  // Call custom endpoint - backend handles status update
  const result = await apiCall(
    `/fn/t_purchase_request/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_request_id,
        purchase_request_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  // NOTE: Tidak perlu PUT manual - backend sudah handle update status ke REVISI

  return result
}

/**
 * Reject Purchase Request - POST to /fn/t_purchase_request/reject
 * Updates both PR status and notification
 */
export async function rejectPurchaseRequest(
  purchase_request_id: string,
  purchase_request_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PR_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Request')
  }

  // Call custom endpoint - backend handles status update
  const result = await apiCall(
    `/fn/t_purchase_request/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_request_id,
        purchase_request_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  // NOTE: Tidak perlu PUT manual - backend sudah handle update status ke REJECT

  return result
}

/**
 * Get PR Revisi Notifications for the sender (user who created the PR)
 * This shows notifications when their PR was revised by approver
 */
export async function getPRRevisiNotifications(page = 1, limit = 10): Promise<PRNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_request_notifikasi?where=status%3Dfalse&include=t_purchase_request:id|no_pr,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )

  const data = (response.data || []).map((item: PRNotification) => ({
    ...item,
    notification_type: 'purchase_request' as const
  }))

  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Purchase Request (Pending + Revisi)
 * Used in main notification view to show all sender-related notifications
 */
export async function getPRCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: PRNotification[]
  revisi: PRNotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPRPendingApprovalNotifications(page, limit).catch(() => ({ data: [] })),
    getPRRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])

  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}
