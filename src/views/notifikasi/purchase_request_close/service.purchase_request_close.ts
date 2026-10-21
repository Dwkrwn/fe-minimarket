import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseRequestCloseNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_purchase_request_close_id?: string
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
  // Alias untuk sender (dari relasi tprc_sender)
  tprc_sender?: {
    id: string
    name: string
  }
  // Alias untuk approver (dari relasi tprc_approval)
  tprc_approval?: {
    id: string
    name: string
  }
  t_purchase_request_close?: {
    id: string
    m_unit_bisnis_id?: string
    no_preq_close: string
    t_purchase_request_id: string
    tgl_close: string
    alasan?: string
    catatan?: string
    status: string
    created_by?: string
    updated_by?: string
    createdAt?: string
    updatedAt?: string
    m_unit_bisni?: {
      id: string
      kode_unit_bisnis?: string
      is_active?: boolean
      nama_comp: string
      provinsi?: string
      kota?: string
      kecamatan?: string
      kodepos?: number
      email?: string
      pic?: string
      no_telp_pic?: string
      catatan?: string
    }
    prqc_ctr?: {
      id: string
      name: string
    }
    prqc_update?: {
      id: string
      name: string
    }
    t_purchase_request?: {
      id: string
      no_pr: string
      tgl_pr: string
      req_user_by?: string
    }
    t_purchase_request_close_ds?: Array<{
      id: string
      t_purchase_request_close_id: string
      t_purchase_order_d_id?: string
      m_items_id: string
      qty_prc: number
      qty_close?: number
      catatan?: string
      created_by: string
      updated_by?: string
      createdAt: string
      updatedAt: string
      // Flat fields dari m_item
      kode_item?: string
      nama_item?: string
      nama_singkat?: string
      is_active?: boolean
      status?: string
      spesifikasi?: string
      tipe_barang?: string
      min_stock?: string
      max_stock?: string
      catatan_item?: string
      satuan?: string
      satuan_id?: string
      // Legacy nested support (optional)
      m_item?: {
        id: string
        kode_item: string
        nama_item: string
        nama_singkat?: string
        is_active?: boolean
        status?: string
        spesifikasi?: string
        tipe_barang?: string
        satuan_id?: string
      }
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
  notification_type?: 'purchase_request_close'
}

export interface TPurchaseRequestCloseNotificationResponse {
  data: TPurchaseRequestCloseNotification[]
  status: string
  approval?: TPurchaseRequestCloseNotification[]
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

// Purchase Request Close path constant
const PRC_PATH = '/purchasing/transaksi/t_purchase_request_close'

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Purchase Request Close Notifications for approval
 */
export async function getTPurchaseRequestCloseNotifications(page = 1, limit = 10): Promise<TPurchaseRequestCloseNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_request_close_notifikasi/getUserApprovalPurchaseRequestClose?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: TPurchaseRequestCloseNotification) => ({
    ...item,
    notification_type: 'purchase_request_close' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Mark Purchase Request Close notification as read
 */
export async function markTPurchaseRequestCloseNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_purchase_request_close_notifikasi`,
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
 * Approve Purchase Request Close - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approveTPurchaseRequestClose(
  t_purchase_request_close_id: string,
  t_purchase_request_close_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  const approvalData = getApprovalByPath(PRC_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Request Close')
  }

  const result = await apiCall(
    `/fn/t_purchase_request_close/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_request_close_id: t_purchase_request_close_id,
        purchase_request_close_notifikasi_id: t_purchase_request_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}

/**
 * Revise Purchase Request Close - POST to custom endpoint
 */
export async function reviseTPurchaseRequestClose(
  t_purchase_request_close_id: string, 
  t_purchase_request_close_notifikasi_id: string, 
  approval_level: number, 
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  const approvalData = getApprovalByPath(PRC_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Request Close')
  }

  const result = await apiCall(
    `/fn/t_purchase_request_close/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_request_close_id: t_purchase_request_close_id,
        purchase_request_close_notifikasi_id: t_purchase_request_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}

/**
 * Reject Purchase Request Close - POST to custom endpoint
 */
export async function rejectTPurchaseRequestClose(
  t_purchase_request_close_id: string,
  t_purchase_request_close_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  const approvalData = getApprovalByPath(PRC_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Request Close')
  }

  const result = await apiCall(
    `/fn/t_purchase_request_close/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_request_close_id: t_purchase_request_close_id,
        purchase_request_close_notifikasi_id: t_purchase_request_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id: approvalData.sender_id,
        m_approval_id: approvalData.id,
      }),
    }
  )

  return result
}

/**
 * Get Revisi notifications for Purchase Request Close (where sender_id = current user, status_name = REVISI)
 */
export async function getTPurchaseRequestCloseRevisiNotifications(page = 1, limit = 10): Promise<TPurchaseRequestCloseNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_request_close_notifikasi?where=status%3Dfalse&include=t_purchase_request_close:id|no_preq_close,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: TPurchaseRequestCloseNotification) => ({
    ...item,
    notification_type: 'purchase_request_close' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Pending Approval notifications for Purchase Request Close (where sender_id = current user, status_name = IN APPROVAL)
 */
export async function getPendingTPurchaseRequestCloseNotifications(page = 1, limit = 10): Promise<TPurchaseRequestCloseNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_request_close_notifikasi?where=status%3Dfalse&include=t_purchase_request_close:id|no_preq_close,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: TPurchaseRequestCloseNotification) => ({
    ...item,
    notification_type: 'purchase_request_close' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Purchase Request Close (Pending + Revisi)
 */
export async function getTPurchaseRequestCloseCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: TPurchaseRequestCloseNotification[]
  revisi: TPurchaseRequestCloseNotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingTPurchaseRequestCloseNotifications(page, limit).catch(() => ({ data: [] })),
    getTPurchaseRequestCloseRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}
