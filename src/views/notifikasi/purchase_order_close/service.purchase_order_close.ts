import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseOrderCloseNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_purchase_order_close_id?: string
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
  // Alias untuk sender (dari relasi)
  tpoc_sender?: {
    id: string
    name: string
  }
  // Alias untuk approver (dari relasi)
  tpoc_approval?: {
    id: string
    name: string
  }
  t_purchase_order_close?: {
    id: string
    no_po_close: string
    tgl_po_close: string
    t_purchase_order_id: string
    m_unit_bisnis_id: string
    alasan?: string
    status: string
    catatan?: string
    createdAt?: string
    updatedAt?: string
    m_unit_bisni?: {
      id: string
      nama_comp: string
    }
    t_purchase_order?: {
      id: string
      no_po: string
      tgl_po: string
      m_supplier?: {
        id: string
        nama_supp: string
      }
    }
    t_purchase_order_close_ds?: Array<{
      no: number
      id: string
      t_purchase_order_close_id: string
      m_items_id: string
      t_penerimaan_barangs_id?: string
      qty_close: number
      catatan?: string
      // Flattened fields from m_item
      kode_item: string
      nama_item: string
      // Flattened field from satuan
      nama_satuan: string
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
  notification_type?: 'purchase_order_close'
}

export interface TPurchaseOrderCloseNotificationResponse {
  data: TPurchaseOrderCloseNotification[]
  status: string
  approval?: TPurchaseOrderCloseNotification[]
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
 * Get Purchase Order Close Notifications for approval
 */
export async function getTPurchaseOrderCloseNotifications(page = 1, limit = 10): Promise<TPurchaseOrderCloseNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_order_close_notifikasi/getUserApprovalPurchaseOrderClose?id=${userId}&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: TPurchaseOrderCloseNotification) => ({
    ...item,
    notification_type: 'purchase_order_close' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Mark Purchase Order Close notification as read
 */
export async function markTPurchaseOrderCloseNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_purchase_order_close_notifikasi`,
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
 * Approve Purchase Order Close - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approveTPurchaseOrderClose(
  t_purchase_order_close_id: string,
  t_purchase_order_close_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/purchasing/transaksi/t_purchase_order_close')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_purchase_order_close/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_purchase_order_close_id,
        t_purchase_order_close_notifikasi_id,
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
 * Revise Purchase Order Close - POST to custom endpoint
 */
export async function reviseTPurchaseOrderClose(
  t_purchase_order_close_id: string, 
  t_purchase_order_close_notifikasi_id: string, 
  approval_level: number, 
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/purchasing/transaksi/t_purchase_order_close')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_purchase_order_close/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_purchase_order_close_id,
        t_purchase_order_close_notifikasi_id,
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
 * Reject Purchase Order Close - POST to custom endpoint
 */
export async function rejectTPurchaseOrderClose(
  t_purchase_order_close_id: string,
  t_purchase_order_close_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const approvalData = getApprovalByPath('/purchasing/transaksi/t_purchase_order_close')
  if (!approvalData) {
    throw new Error('Approval data not found')
  }

  const result = await apiCall(
    `/fn/t_purchase_order_close/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        t_purchase_order_close_id,
        t_purchase_order_close_notifikasi_id,
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
 * Get Revisi notifications for Purchase Order Close (where sender_id = current user, status_name = REVISI)
 */
export async function getTPurchaseOrderCloseRevisiNotifications(page = 1, limit = 10): Promise<TPurchaseOrderCloseNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_order_close_notifikasi?where=status%3Dfalse&include=t_purchase_order_close:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: TPurchaseOrderCloseNotification) => ({
    ...item,
    notification_type: 'purchase_order_close' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Pending Approval notifications for Purchase Order Close (where sender_id = current user, status_name = IN APPROVAL)
 */
export async function getPendingTPurchaseOrderCloseNotifications(page = 1, limit = 10): Promise<TPurchaseOrderCloseNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_order_close_notifikasi?where=status%3Dfalse&include=t_purchase_order_close:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: TPurchaseOrderCloseNotification) => ({
    ...item,
    notification_type: 'purchase_order_close' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Purchase Order Close (Pending + Revisi)
 */
export async function getTPurchaseOrderCloseCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: TPurchaseOrderCloseNotification[]
  revisi: TPurchaseOrderCloseNotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingTPurchaseOrderCloseNotifications(page, limit).catch(() => ({ data: [] })),
    getTPurchaseOrderCloseRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}
