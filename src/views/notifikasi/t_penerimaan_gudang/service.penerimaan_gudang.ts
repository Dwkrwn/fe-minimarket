import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PenerimaanGudangNotification {
  id: string
  title: string
  approval_message: string
  approval_catatan: string | null
  t_penerimaan_gudang_id?: string
  sender_id: string
  approval_level: number
  status: boolean
  status_name?: string
  user_approved_id?: string | null
  createdAt: string
  updatedAt: string
  tpen_gudang_send?: {
    id: string
    name: string
  }
  tpen_gudang_approval?: {
    id: string
    name: string
  } | null
  t_penerimaan_gudang?: {
    id: string
    m_unit_bisnis_id: string
    status: string
    no_penerimaan_gudang: string
    tgl_penerimaan_gudang: string
    pic_penerima_id: string
    catatan: string | null
    t_sj_gudang_id: string
    warehouse_asal_id?: string
    warehouse_terima_id?: string
    createdAt: string
    updatedAt: string
    m_unit_bisni?: {
      id: string
      kode_unit_bisnis: string
      is_active: boolean
      nama_comp: string
      provinsi: string
      kota: string
      kecamatan: string
      kodepos: number
      email: string
    }
    pic_penerima_gudang?: {
      id: string
      kode_kary: string
      nama_kary: string
      no_tlp?: string
      email?: string
      is_active: boolean
    }
    pen_gd_asl?: {
      id: string
      nama_gudang: string
    }
    pen_gd_trm?: {
      id: string
      nama_gudang: string
    }
    surat_jalan_gudang?: {
      id: string
      no_sj_gudang: string
      m_unit_bisnis_id: string
      status: string
      tipe_sj_gudang: string
      tgl_sj_gudang: string
      is_ekspedisi: boolean
      supir?: string
      no_resi?: string
      bukti_foto?: string
      catatan?: string
      gudang_tujuan_id?: string
      warehouse_asal_id?: string
      warehouse_terima_id?: string
      sj_gd_asl?: {
        id: string
        nama_gudang: string
      }
      sj_gd_trm?: {
        id: string
        nama_gudang: string
      }
    }
    t_penerimaan_gudang_ds?: Array<{
      id: string
      t_penerimaan_gudang_: string
      t_sj_gudang_d_id: string
      qty_diterima: number
      qty_sisa: number
      catatan: string | null
      m_items_id: string
      m_item?: {
        id: string
        kode_item: string
        nama_item: string
        nama_singkat: string
        is_active: boolean
        status: string
        spesifikasi?: string
        tipe_barang?: string
      }
      detail_sj?: {
        id: string
        t_sj_gudan: string
        qty_sj_gud: number
        catatan?: string
        m_items_id: string
      }
    }>
    t_penerimaan_gudang_lampirans?: Array<{
      id: string
      t_penerimaan_gudang_id: string
      file_path: string
      file_name: string
      file_type: string
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
  notification_type?: 'penerimaan_gudang'
}

export interface PenerimaanGudangNotificationResponse {
  data: PenerimaanGudangNotification[]
  status: string
  approval?: PenerimaanGudangNotification[]
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
 * @param path - The menu path to match
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

// Penerimaan Gudang path constant
const PG_PATH = '/inventory/transaksi/t_penerimaan_gudang'

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Penerimaan Gudang Notifications for approval
 */
export async function getPenerimaanGudangNotifications(page = 1, limit = 10): Promise<PenerimaanGudangNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/fn/t_penerimaan_gudang_notifikasi/getUserApprovalPenerimaanGudang?id=${userId}`,
    { method: 'GET' }
  )
  
  const data = (response.approval || []).map((item: PenerimaanGudangNotification) => ({
    ...item,
    notification_type: 'penerimaan_gudang' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Penerimaan Gudang Pending Approval Notifications for the sender (user who created)
 * This shows notifications when their document is waiting for approval (IN APPROVAL status)
 */
export async function getPenerimaanGudangPendingApprovalNotifications(page = 1, limit = 10): Promise<PenerimaanGudangNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_penerimaan_gudang_notifikasi?where=status%3Dfalse&include=t_penerimaan_gudang:id|no_penerimaan_gudang,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: PenerimaanGudangNotification) => ({
    ...item,
    notification_type: 'penerimaan_gudang' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Get Penerimaan Gudang Revisi Notifications for the sender (user who created)
 * This shows notifications when their document was revised by approver
 */
export async function getPenerimaanGudangRevisiNotifications(page = 1, limit = 10): Promise<PenerimaanGudangNotificationResponse> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('User not authenticated')
  }

  const response = await apiCall<any>(
    `/dynamic/t_penerimaan_gudang_notifikasi?where=status%3Dfalse&include=t_penerimaan_gudang:id|no_penerimaan_gudang,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: 'GET' }
  )
  
  const data = (response.data || []).map((item: PenerimaanGudangNotification) => ({
    ...item,
    notification_type: 'penerimaan_gudang' as const
  }))
  
  return {
    status: response.status,
    data,
    pagination: response.pagination
  }
}

/**
 * Mark Penerimaan Gudang notification as read
 */
export async function markPenerimaanGudangNotificationAsRead(id: string): Promise<any> {
  return apiCall(
    `/dynamic/t_penerimaan_gudang_notifikasi`,
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
 * Approve Penerimaan Gudang
 */
export async function approvePenerimaanGudang(
  penerimaan_gudang_id: string,
  penerimaan_gudang_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  const result = await apiCall(
    `/fn/t_penerimaan_gudang/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        penerimaan_gudang_id,
        penerimaan_gudang_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        // m_approval_id tidak diperlukan lagi — approver ditentukan dinamis
        m_approval_id: null,
      }),
    }
  )

  return result
}

/**
 * Revise Penerimaan Gudang
 */
export async function revisePenerimaanGudang(
  penerimaan_gudang_id: string,
  penerimaan_gudang_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  const result = await apiCall(
    `/fn/t_penerimaan_gudang/revisi`,
    {
      method: 'POST',
      body: JSON.stringify({
        penerimaan_gudang_id,
        penerimaan_gudang_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        m_approval_id: null,
      }),
    }
  )

  return result
}

/**
 * Reject Penerimaan Gudang
 */
export async function rejectPenerimaanGudang(
  penerimaan_gudang_id: string,
  penerimaan_gudang_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string
): Promise<any> {
  const user_approved_id = getUserId()
  if (!user_approved_id) {
    throw new Error('User not authenticated')
  }

  const result = await apiCall(
    `/fn/t_penerimaan_gudang/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        penerimaan_gudang_id,
        penerimaan_gudang_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        m_approval_id: null,
      }),
    }
  )

  return result
}

/**
 * Get combined sender notifications for Penerimaan Gudang (Pending + Revisi)
 */
export async function getPenerimaanGudangCombinedSenderNotifications(page = 1, limit = 10): Promise<{
  pending: PenerimaanGudangNotification[]
  revisi: PenerimaanGudangNotification[]
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPenerimaanGudangPendingApprovalNotifications(page, limit).catch(() => ({ data: [] })),
    getPenerimaanGudangRevisiNotifications(page, limit).catch(() => ({ data: [] }))
  ])
  
  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || []
  }
}

/**
 * Sync stock from Penerimaan Gudang to stock_gudang_d (if applicable)
 * @returns Promise with sync result
 */
export async function syncStockFromPenerimaanGudang(): Promise<{ status: string; message: string; data?: any }> {
  return apiCall(`/fn/t_penerimaan_gudang/syncStockFromPenerimaanGudang`, {
    method: 'POST'
  })
}
