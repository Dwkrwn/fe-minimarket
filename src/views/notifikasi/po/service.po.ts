import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PONotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_purchase_order_id?: string
  sender_id: string
  approval_level: number
  status: boolean
  status_name?: string
  createdAt: string
  updatedAt: string
  user_default?: {
    id: string
    name: string
  }
  tpo_sender?: {
    id: string
    name: string
  }
  tpo_approval?: {
    id: string
    name: string
  } | null
  t_purchase_order?: {
    id: string
    is_import: boolean
    no_po: string
    tgl_po: string
    m_supplier_id: string
    top_id: string
    pph_id: string
    ppn_id: string
    catatan: string
    created_by: string
    updated_by: string | null
    status: string
    kategori_item: string
    m_unit_bisnis_id: string
    total: string
    total_diskon: string
    total_ppn: string
    total_pph: string
    grand_total: string
    status_transaksi: string
    m_currency_d_id: string
    m_currency_id: string
    createdAt: string
    updatedAt: string
    top_po?: {
      id: string
      group: string
      key1: string
      code: string
      value1: string
      value2: string | null
      is_active: boolean
    }
    m_supplier?: {
      id: string
      kode_supplier: string
      is_active: boolean
      nama_supp: string
      tipe_supp_id: string
      is_tax: boolean
      top_id: string
      npwp_supp: string | null
      alamat_supp: string
      m_currency_id: string
      negara_supp: string
      provinsi_supp: string
      kota_supp: string
      kecamatan_supp: string
      kodepos: string | null
      website: string
      email: string
      no_telp: string
      no_fax: string
      cp1: string
      no_cp1: string
      cp2: string | null
      no_cp2: string | null
      catatan: string
    }
    po_ctr?: {
      id: string
      name: string
    }
    po_updt?: {
      id: string
      name: string
    } | null
    uang_po?: {
      id: string
      kode_currency: string
      nama_currency: string
      simbol_id: string
      is_active: boolean
      createdAt: string
      updatedAt: string
      money?: {
        id: string
        group: string
        key1: string
        code: string
        value1: string
        value2: string
        value3: string
        value4: string
        value5: string
        is_active: boolean
      }
    }
    det_uang_po?: {
      id: string
      m_currency_id: string
      tgl_mulai: string
      rate: string
      is_active: boolean
      tgl_selesai: string | null
      catatan: string
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
  notification_type?: 'purchase_order'
}

export interface PONotificationResponse {
  data: PONotification[]
  status: string
  approval?: PONotification[]
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
 * @param path - The menu path to match (e.g., '/purchasing/transaksi/t_purchase_order')
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

// Purchase Order path constant
const PO_PATH = '/purchasing/transaksi/t_purchase_order'

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Purchase Order Notifications for approval
 */
export async function getPurchaseOrderNotifications(page = 1, limit = 10): Promise<PONotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_order_notifikasi/getUserApprovalPurchaseOrder?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: PONotification) => ({
    ...item,
    notification_type: 'purchase_order' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get PO Pending Approval Notifications for the sender (user who created the PO)
 * This shows notifications when their PO is waiting for approval (IN APPROVAL status)
 */
export async function getPOPendingApprovalNotifications(page = 1, limit = 10): Promise<PONotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_order_notifikasi?where=status%3Dfalse&include=t_purchase_order:id|no_po,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: PONotification) => ({
    ...item,
    notification_type: 'purchase_order' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}
/**
 * Mark PO notification as read
 */
export async function markPONotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_purchase_order_notifikasi`,
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
 * Approve Purchase Order - POST to /fn/t_purchase_order/approve
 * Updates both PO status and notification
 */
export async function approvePurchaseOrder(
  purchase_order_id: string,
  purchase_order_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PO_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Order')
  }

  // 1. Call custom endpoint
  const result = await apiCall(
    `/fn/t_purchase_order/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_order_id,
        purchase_order_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  // 2. PUT to update PO status
  await apiCall(
    `/dynamic/t_purchase_order/${purchase_order_id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        status: 'APPROVED'
      }),
    }
  )

  return result
}

/**
 * Revise Purchase Order - POST to /fn/t_purchase_order/revisi
 * Updates both PO status and notification
 */
export async function revisePurchaseOrder(
  purchase_order_id: string,
  purchase_order_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PO_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Order')
  }

  // 1. Call custom endpoint
  const result = await apiCall(
    `/fn/t_purchase_order/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_order_id,
        purchase_order_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  // 2. PUT to update PO status
  await apiCall(
    `/dynamic/t_purchase_order/${purchase_order_id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        status: 'REVISI'
      }),
    }
  )

  return result
}

/**
 * Reject Purchase Order - POST to /fn/t_purchase_order/reject
 * Updates both PO status and notification
 */
export async function rejectPurchaseOrder(
  purchase_order_id: string,
  purchase_order_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PO_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Order')
  }

  // 1. Call custom endpoint
  const result = await apiCall(
    `/fn/t_purchase_order/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_order_id,
        purchase_order_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  // 2. PUT to update PO status
  await apiCall(
    `/dynamic/t_purchase_order/${purchase_order_id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        status: 'REJECT'
      }),
    }
  )

  return result
}

/**
 * Get PO Revisi Notifications for the sender (user who created the PO)
 * This shows notifications when their PO was revised by approver
 */
export async function getPORevisiNotifications(page = 1, limit = 10): Promise<PONotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_order_notifikasi?where=status%3Dfalse&include=t_purchase_order:id|no_po,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: PONotification) => ({
    ...item,
    notification_type: 'purchase_order' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Purchase Order (Pending + Revisi)
 * Used in main notification view to show all sender-related notifications
 */
export async function getPOCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: PONotification[]
  revisi: PONotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPOPendingApprovalNotifications(page, limit).catch(() => ({ data: [] })),
    getPORevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}
