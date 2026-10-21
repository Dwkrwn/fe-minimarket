import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PINotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_purchase_invoice_id: string
  sender_id: string
  approval_level: number
  status: boolean
  status_name?: string
  user_approved_id: string | null
  createdAt: string
  updatedAt: string
  tpi_sender?: {
    id: string
    name: string
    username?: string
  }
  tpi_approval?: {
    id: string
    name: string
  } | null
  t_purchase_invoice?: {
    id: string
    m_unit_bisnis_id: string
    status: string
    no_pi: string
    tgl_pi: string
    seri_pajak: number|null
    m_supplier_id: string
    t_purchase_order_id: string
    t_penerimaan_barang_id: string
    tgl_jatuh_tempo: string
    exchange_rate: string
    total: string
    total_diskon: string
    total_ppn: string
    total_pph: string | null
    dpp_lainnya:number|null
    grand_total: string
    m_currency_d_id: string
    m_currency_id: string
    catatan: string | null
    createdAt: string
    updatedAt: string
    // Nested relations
    m_supplier?: {
      id: string
      kode_supplier: string
      nama_supp: string
      alamat_supp?: string
      email?: string
      cp1?: string
      no_cp1?: string
      is_tax?: boolean
    }
    m_currency?: {
      id: string
      kode_currency?: string
      nama_currency: string
      simbol_id?: string
    }
    m_currency_d?: {
      id: string
      rate: string
      tgl_mulai: string
      m_currency?: {
        nama_currency: string
      }
    }
    m_unit_bisnis?: {
      id: string
      nama_comp: string
    }
    t_purchase_order?: {
      id: string
      no_po: string
      tgl_po?: string
      status?: string
      status_transaksi?: string
      m_supplier?: {
        nama_supp: string
      }
    }
    t_purchase_invoice_ds?: Array<{
      id: string
      t_purchase_invoice_id: string
      t_purchase_order_d_id: string
      t_penerimaan_barang_id: string
      t_penerimaan_barang_d_id: string
      qty_retur:number|null
      qty_pi:number
      qty_diterima:number
      harga:number
      r_disc1:number|null
      r_disc2:number|null
      disc_amt:number|null
      subtotal:number
      ppn_amt:number
      pph_amt:number
      grand_total:number
      catatan?: string
      m_items_id: string
      m_items?: {
        id: string
        kode_item: string
        nama_item: string
        nama_singkat?: string
        spesifikasi?: string
        m_general?: {
          id: string
          value1: string
        }
        mi_uom?:{
          id:string
          value1:string
        }
        m_group_jenis?: {
          nama_jenis: string
        }
        m_group_merek?: {
          nama_merek: string
        }
      }
      pi_d_uom?:{
        id:string
        value1:string
      }
      pi_d_ppn: {
        id:string
        value1:string
      }
      tpenerimaan_barangs?:{
        id: string,
        no_penerimaan:string,
      }    
      t_purchase_order?:{
        id:string,
        no_po:string
      }  
      t_penerimaan_barang_d?: {
        id: string
        qty_diterima: number
        catatan?: string
      }
      t_purchase_order_d?: {
        id: string
        qty_po: number
        harga: string
        disc_1: string
        disc_2: string
        amt_disc: string
        catatan?: string
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
    syarat?: {
      level: number
      m_unit_bisnis_id: string
      min_val: string
      max_val: string
      max_disc: string
      max_disc_value: string
      is_full: boolean
      m_approval_id: string
      user_default_id: string
      top_id: string | null
      tipe_approval_id: string
      jenis_approval: string
      is_active: boolean
    }[]
  }
  notification_type?: 'purchase_invoice'
}

export interface PINotificationResponse {
  data: PINotification[]
  status: string
  approval?: PINotification[]
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
 * @param path - The menu path to match (e.g., '/purchasing/transaksi/t_purchase_invoice')
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

// Purchase Invoice path constant
const PI_PATH = '/purchasing/transaksi/t_purchase_invoice'

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Purchase Invoice Notifications for approval
 */
export async function getPurchaseInvoiceNotifications(page = 1, limit = 10): Promise<PINotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_invoice_notifikasi/getUserApprovalPurchaseInvoice?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: PINotification) => ({
    ...item,
    notification_type: 'purchase_invoice' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get PI Pending Approval Notifications for the sender (user who created the PI)
 * This shows notifications when their PI is waiting for approval (IN APPROVAL status)
 */
export async function getPIPendingApprovalNotifications(page = 1, limit = 10): Promise<PINotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_invoice_notifikasi?where=status%3Dfalse&include=t_purchase_invoice:id|no_pi,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: PINotification) => ({
    ...item,
    notification_type: 'purchase_invoice' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Mark PI notification as read
 */
export async function markPINotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_purchase_invoice_notifikasi`,
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
 * Approve Purchase Invoice - POST to /fn/t_purchase_invoice/approve
 * Updates both PI status and notification
 */
export async function approvePurchaseInvoice(
  purchase_invoice_id: string,
  purchase_invoice_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PI_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Invoice')
  }

  // Call custom endpoint
  const result = await apiCall(
    `/fn/t_purchase_invoice/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_invoice_id,
        purchase_invoice_notifikasi_id,
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
 * Revise Purchase Invoice - POST to /fn/t_purchase_invoice/revisi
 * Updates both PI status and notification
 */
export async function revisePurchaseInvoice(
  purchase_invoice_id: string,
  purchase_invoice_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PI_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Invoice')
  }

  // Call custom endpoint
  const result = await apiCall(
    `/fn/t_purchase_invoice/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_invoice_id,
        purchase_invoice_notifikasi_id,
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
 * Reject Purchase Invoice - POST to /fn/t_purchase_invoice/reject
 * Updates both PI status and notification
 */
export async function rejectPurchaseInvoice(
  purchase_invoice_id: string,
  purchase_invoice_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PI_PATH)
  if (!approvalData) {
    throw new Error('Approval data not found for Purchase Invoice')
  }

  // Call custom endpoint
  const result = await apiCall(
    `/fn/t_purchase_invoice/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        purchase_invoice_id,
        purchase_invoice_notifikasi_id,
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
 * Get PI Revisi Notifications for the sender (user who created the PI)
 * This shows notifications when their PI was revised by approver
 */
export async function getPIRevisiNotifications(page = 1, limit = 10): Promise<PINotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_invoice_notifikasi?where=status%3Dfalse&include=t_purchase_invoice:id|no_pi,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: PINotification) => ({
    ...item,
    notification_type: 'purchase_invoice' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get combined sender notifications for Purchase Invoice (Pending + Revisi)
 * Used in main notification view to show all sender-related notifications
 */
export async function getPICombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: PINotification[]
  revisi: PINotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPIPendingApprovalNotifications(page, limit).catch(() => ({ data: [] })),
    getPIRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}
