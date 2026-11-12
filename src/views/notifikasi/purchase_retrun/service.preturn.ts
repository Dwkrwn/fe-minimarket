import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface PurchaseReturnNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  t_purchase_return_id?: string;
  sender_id: string;
  approval_level: number;
  status: boolean;
  status_name?: string;
  user_approved_id?: string | null;
  createdAt: string;
  updatedAt: string;
  tp_return_sender?: {
    id: string;
    name: string;
  };
  tp_return_approval?: {
    id: string;
    name: string;
  } | null;
  t_purchase_return?: {
    id: string;
    m_unit_bisnis_id: string;
    status: string;
    no_return: string;
    tgl_retur?: string | null;
    m_supplier_id: string;
    t_penerimaan_barangs_id: string | null;
    t_purchase_invoice_id: string;
    m_gudang_id: string;
    tiper_retur: string;
    ppn_id: string;
    pph_id: string;
    m_currency_id: string;
    catatan: string | null;
    total: string;
    total_diskon: string;
    total_ppn: string;
    total_pph: string;
    grand_total: string;
    created_by: string;
    updated_by: string | null;
    is_pi_pb: boolean;
    createdAt: string;
    updatedAt: string;
    m_supplier?: {
      id: string;
      kode_supplier: string;
      nama_supp: string;
      is_active: boolean;
      tipe_supp_id?: string;
      is_tax?: boolean;
      alamat_supp?: string;
      email?: string;
      no_telp?: string;
    };
    t_penerimaan_barang?: {
      id: string;
      no_pb: string;
      no_penerimaan: string;
    } | null;
    t_purchase_invoice?: {
      id: string;
      no_pi: string;
      tgl_pi: string;
      status: string;
      t_purchase_order?: {
        id: string;
        no_po: string;
      };
    };
    m_currency?: {
      id: string;
      kode_currency: string;
      nama_currency: string;
      simbol_id: string;
      m_currency_ds?: Array<{
        id: string;
        rate: string;
        tgl_mulai: string;
      }>;
    };
    m_gudang?: {
      id: string;
      nama_gudang: string;
      alamat_gudang?: string | null;
      provinsi?: string | null;
      kota?: string | null;
      kecamatan?: string | null;
      kode_pos?: string | null;
    };
    t_pr_retur?: {
      id: string;
      value1: string;
      value2: string | null;
      value3: string | null;
    };
    t_pr_ppn?: {
      id: string;
      value1: string;
      value2: string;
      value3: string;
    };
    t_pr_pph?: {
      id: string;
      value1: string;
      value2: string;
      value3: string;
    };
    t_purchase_return_ds?: Array<{
      id: string;
      alasan_id?: string;
      no_penerimaan?: string;
      no_pb?: string;
      no_pi?: string;
      no_po?: string;
      rak_display?: string;
      kode_item: string;
      nama_item: string;
      qty_pb: number;
      qty_pi?: number | null;
      qty_retur: number;
      satuan: string;
      harga?: number | null;
      disc_1_percent?: number | null;
      disc_2_percent?: number | null;
      disc_3_percent?: number | null;
      disc_amount?: number | null;
      total_diskon?: number | null;
      subtotal?: number | null;
      pph?: number | null;
      ppn?: number | null;
      grand_total?: number | null;
      alasan: string;
      catatan: string;
      bukti_foto?: string | null;
    }>;
  };
  menu_info?: {
    approval_detail_id: string;
    level: number;
    approval_id: string;
    approval_name: string;
    menu_id: string;
    menu_name: string;
    menu_path: string;
    syarat?: any[];
  };
  notification_type?: "purchase_return";
}

export interface PurchaseReturnNotificationResponse {
  data: PurchaseReturnNotification[];
  status: string;
  approval?: PurchaseReturnNotification[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    currentRowsCount: number;
    next_page: number | null;
    prev_page: number | null;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getUserId(): string {
  const authData = localStorage.getItem("auth_bb");
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.user?.id || "";
    } catch (e) {
      console.error("Failed to parse auth data:", e);
    }
  }
  return "";
}

/**
 * Get approval data from localStorage by path
 * @param path - The menu path to match (e.g., '/purchasing/transaksi/t_purchase_request')
 * @returns Approval data object with id and sender_id, or null if not found
 */
function getApprovalByPath(
  path: string,
): { id: string; sender_id: string; level: number } | null {
  const approvalList = localStorage.getItem("approval_list");
  if (approvalList) {
    try {
      const parsed = JSON.parse(approvalList);
      const approval = parsed.find(
        (a: any) =>
          a.path === path && a.tipe_approve?.toUpperCase() === "MENYETUJUI",
      );
      if (approval) {
        return {
          id: approval.id,
          sender_id: approval.sender_id,
          level: approval.level,
        };
      }
    } catch (e) {
      console.error("Failed to parse approval_list:", e);
    }
  }
  return null;
}

// Purchase Return path constant
const PR_PATH = "/purchasing/receiving/purchase-returns";

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Purchase Return Notifications for approval
 */
export async function getPurchaseReturnNotifications(
  page = 1,
  limit = 10,
): Promise<PurchaseReturnNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_return_notifikasi/getUserApprovalPurchaseReturn?id=${userId}`,
    { method: "GET" },
  );

  const data = (response.approval || []).map(
    (item: PurchaseReturnNotification) => ({
      ...item,
      notification_type: "purchase_return" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get Purchase Return Pending Approval Notifications for the sender (user who created the PR)
 * This shows notifications when their PR is waiting for approval (IN APPROVAL status)
 */
export async function getPurchaseReturnPendingApprovalNotifications(
  page = 1,
  limit = 10,
): Promise<PurchaseReturnNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_return_notifikasi?where=status%3Dfalse&include=t_purchase_return:id|no_return,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map(
    (item: PurchaseReturnNotification) => ({
      ...item,
      notification_type: "purchase_return" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}
/**
 * Mark Purchase Return notification as read
 */
export async function markPurchaseReturnNotificationAsRead(
  id: string,
): Promise<any> {
  return apiCall(`/dynamic/t_purchase_return_notifikasi`, {
    method: "POST",
    body: JSON.stringify({
      id,
      status: true,
    }),
  });
}

/**
 * Approve Purchase Return - POST to /fn/t_purchase_return/approve
 * Updates both PR status and notification
 */
export async function approvePurchaseReturn(
  purchase_return_id: string,
  purchase_return_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  if (!user_approved_id) {
    throw new Error("User not authenticated");
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PR_PATH);
  if (!approvalData) {
    throw new Error("Approval data not found for Purchase Return");
  }

  // Call custom endpoint - backend handles status update & stock reduction
  const result = await apiCall(`/fn/t_purchase_return/approve`, {
    method: "POST",
    body: JSON.stringify({
      purchase_return_id,
      purchase_return_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });

  return result;
}

/**
 * Revise Purchase Return - POST to /fn/t_purchase_return/revisi
 * Updates both PR status and notification
 */
export async function revisePurchaseReturn(
  purchase_return_id: string,
  purchase_return_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  if (!user_approved_id) {
    throw new Error("User not authenticated");
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PR_PATH);
  if (!approvalData) {
    throw new Error("Approval data not found for Purchase Return");
  }

  // Call custom endpoint - backend handles status update
  const result = await apiCall(`/fn/t_purchase_return/revisi`, {
    method: "POST",
    body: JSON.stringify({
      purchase_return_id,
      purchase_return_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });

  return result;
}

/**
 * Reject Purchase Return - POST to /fn/t_purchase_return/reject
 * Updates both PR status and notification
 */
export async function rejectPurchaseReturn(
  purchase_return_id: string,
  purchase_return_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  if (!user_approved_id) {
    throw new Error("User not authenticated");
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(PR_PATH);
  if (!approvalData) {
    throw new Error("Approval data not found for Purchase Return");
  }

  // Call custom endpoint - backend handles status update
  const result = await apiCall(`/fn/t_purchase_return/reject`, {
    method: "POST",
    body: JSON.stringify({
      purchase_return_id,
      purchase_return_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });

  return result;
}

/**
 * Get Purchase Return Revisi Notifications for the sender (user who created the PR)
 * This shows notifications when their PR was revised by approver
 */
export async function getPurchaseReturnRevisiNotifications(
  page = 1,
  limit = 10,
): Promise<PurchaseReturnNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_return_notifikasi?where=status%3Dfalse&include=t_purchase_return:id|no_return,user_default:id&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map(
    (item: PurchaseReturnNotification) => ({
      ...item,
      notification_type: "purchase_return" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get combined sender notifications for Purchase Return (Pending + Revisi)
 * Used in main notification view to show all sender-related notifications
 */
export async function getPurchaseReturnCombinedSenderNotifications(
  page = 1,
  limit = 10,
): Promise<{
  pending: PurchaseReturnNotification[];
  revisi: PurchaseReturnNotification[];
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPurchaseReturnPendingApprovalNotifications(page, limit).catch(() => ({
      data: [],
    })),
    getPurchaseReturnRevisiNotifications(page, limit).catch(() => ({
      data: [],
    })),
  ]);

  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || [],
  };
}

/**
 * Sync stock from Purchase Return to stock_gudang_d
 * @returns Promise with sync result
 */
export async function syncStockFromPurchaseReturn(): Promise<{
  status: string;
  message: string;
  data?: any;
}> {
  return apiCall(`/fn/t_purchase_return/syncStockFromPurchaseReturn`, {
    method: "POST",
  });
}
