import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface PurchaseRequestSubconNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  t_purchase_request_subcon_id?: string;
  sender_id: string;
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
  tpr_sc_sender?: {
    id: string;
    name: string;
  };
  tpr_sc_approval?: {
    id: string;
    name: string;
  };
  t_purchase_request_subcon?: {
    id: string;
    m_unit_bisnis_id?: string;
    no_pr_subcon?: string;
    tgl_pr_subcon?: string;
    catatan?: string;
    status?: string;
    created_by?: string | null;
    updated_by?: string | null;
    m_gudang_id?: string;
    jenis_pr_subcon?: any | {
      id: string;
      value1: any;
    };
    tgl_butuh?: string;
    status_transaksi?: string;
    createdAt?: string;
    updatedAt?: string;
    prq_sc_ctr?: string | null;
    prqs_sc_update?: string | null;
    m_unit_bisni?: {
      id: string;
      nama_comp: string;
    };
    m_gudang?: {
      id: string;
      nama_gudang: string;
    };
    t_purchase_request_subcon_bahans?: Array<{
      id: string;
      t_purchase_request_subcon_id: string;
      m_items_id: string;
      qty_pr_bahan: number;
      catatan?: string;
      created_by?: string | null;
      updated_by?: string | null;
      uom_id?: string;
      qty_free_stok?: number;
      stock_gudang_id?: string;
      createdAt?: string;
      updatedAt?: string;
      m_item?: {
        id: string;
        kode_item: string;
        nama_item: string;
        uom_id?: string;
      };
      prqb_sc_uom?: {
        id: string;
        value1: string;
      };
      stock_gudang?: {
        id: string;
        m_gudang_id?: string;
        free_stock?: string | number;
        m_items_id?: string;
        m_unit_bisnis_id?: string;
        m_rak_d_id?: string | null;
        is_opname?: boolean;
        createdAt?: string;
        updatedAt?: string;
        m_rak_d?: {
          id: string;
          kode: string;
          baris?: number | null;
          kolom?: number | null;
          m_rak_id?: string | null;
          createdAt?: string;
          updatedAt?: string;
          m_rak?: {
            id: string;
            nama_rak: string;
            kode_rak?: string;
          };
        };
      };
    }>;
    t_purchase_request_subcon_jadis?: Array<{
      id: string;
      t_purchase_request_subcon_id: string;
      m_items_id: string;
      qty_pr_jadi: number;
      qty_free_stok?: number;
      catatan?: string;
      created_by?: string | null;
      updated_by?: string | null;
      uom_id?: string;
      createdAt?: string;
      updatedAt?: string;
      m_item?: {
        id: string;
        kode_item: string;
        nama_item: string;
        uom_id?: string;
      };
      prqj_sc_uom?: {
        id: string;
        value1: string;
      };
    }>;
    t_purchase_request_subcon_jasas?: Array<{
      id: string;
      t_purchase_request_subcon_id: string;
      m_items_id: string;
      qty_pr_jasa: number;
      is_manual?: boolean | number | string;
      catatan?: string;
      created_by?: string | null;
      updated_by?: string | null;
      uom_id?: string;
      createdAt?: string;
      updatedAt?: string;
      m_item?: {
        id: string;
        kode_item: string;
        nama_item: string;
        uom_id?: string;
      };
      m_general?: {
        id: string;
        value1: string;
      };
    }>;
  };
  user_approved_id?: string;
  approval_level: number;
  status: boolean;
  status_name?: string;
  createdAt: string;
  updatedAt: string;
  user_default?: {
    id: string;
    name: string;
    username?: string;
    catatan?: string;
    tipe_user_id?: string;
    is_active?: boolean;
    m_kary_id?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  notification_type?: "purchase_request_subcon";
}

export interface PurchaseRequestSubconNotificationResponse {
  data: PurchaseRequestSubconNotification[];
  status: string;
  approval?: PurchaseRequestSubconNotification[];
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
 */
function getApprovalByPath(
  path: string,
): { level: number; sender_id: string; id: string | null } | null {
  const approvalListStr = localStorage.getItem("approval_list");
  const authData = localStorage.getItem("auth_bb");

  if (!approvalListStr || !authData) return null;

  try {
    const approvalList = JSON.parse(approvalListStr);
    const auth = JSON.parse(authData);

    const approval = approvalList.find(
      (a: any) =>
        a.path === path && a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!approval) return null;

    return {
      level: approval.level,
      sender_id: auth.user?.id || "",
      id: approval.id || null,
    };
  } catch (e) {
    console.error("Failed to parse approval data:", e);
    return null;
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Purchase Request Subcon Notifications for approval
 */
export async function getPurchaseRequestSubconNotifications(
  page = 1,
  limit = 10,
): Promise<PurchaseRequestSubconNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/fn/t_purchase_request_subcon_notifikasi/getUserApprovalPurchaseRequestSubcon?id=${userId}`,
    { method: "GET" },
  );

  const data = (response.approval || []).map(
    (item: PurchaseRequestSubconNotification) => ({
      ...item,
      notification_type: "purchase_request_subcon" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Mark Purchase Request Subcon notification as read
 */
export async function markPurchaseRequestSubconNotificationAsRead(
  id: string,
): Promise<any> {
  return apiCall(`/dynamic/t_purchase_request_subcon_notifikasi`, {
    method: "POST",
    body: JSON.stringify({
      id,
      status: true,
    }),
  });
}

/**
 * Approve Purchase Request Subcon - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approvePurchaseRequestSubcon(
  purchase_request_subcon_id: string,
  purchase_request_subcon_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath(
    "/purchasing/subcon/t_purchase_request_subcon",
  );
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/t_purchase_request_subcon/approve`, {
    method: "POST",
    body: JSON.stringify({
      purchase_request_subcon_id: purchase_request_subcon_id,
      purchase_request_subcon_notifikasi_id:
        purchase_request_subcon_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id: approvalData.sender_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });

  return result;
}

/**
 * Revise Purchase Request Subcon - POST to custom endpoint
 */
export async function revisePurchaseRequestSubcon(
  purchase_request_subcon_id: string,
  purchase_request_subcon_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath(
    "/purchasing/subcon/t_purchase_request_subcon",
  );
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/t_purchase_request_subcon/revisi`, {
    method: "POST",
    body: JSON.stringify({
      purchase_request_subcon_id: purchase_request_subcon_id,
      purchase_request_subcon_notifikasi_id:
        purchase_request_subcon_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id: approvalData.sender_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });

  return result;
}

/**
 * Reject Purchase Request Subcon - POST to custom endpoint
 */
export async function rejectPurchaseRequestSubcon(
  purchase_request_subcon_id: string,
  purchase_request_subcon_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath(
    "/purchasing/subcon/t_purchase_request_subcon",
  );
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/t_purchase_request_subcon/reject`, {
    method: "POST",
    body: JSON.stringify({
      purchase_request_subcon_id: purchase_request_subcon_id,
      purchase_request_subcon_notifikasi_id:
        purchase_request_subcon_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id: approvalData.sender_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });

  return result;
}

/**
 * Get Revisi notifications for Purchase Request Subcon (where sender_id = current user, status_name = REVISI)
 */
export async function getPurchaseRequestSubconRevisiNotifications(
  page = 1,
  limit = 10,
): Promise<PurchaseRequestSubconNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_request_subcon_notifikasi?where=status%3Dfalse&include=t_purchase_request_subcon:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map(
    (item: PurchaseRequestSubconNotification) => ({
      ...item,
      notification_type: "purchase_request_subcon" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get Pending Approval notifications for Purchase Request Subcon (where sender_id = current user, status_name = IN APPROVAL)
 */
export async function getPendingPurchaseRequestSubconNotifications(
  page = 1,
  limit = 10,
): Promise<PurchaseRequestSubconNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_purchase_request_subcon_notifikasi?where=status%3Dfalse&include=t_purchase_request_subcon:id,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map(
    (item: PurchaseRequestSubconNotification) => ({
      ...item,
      notification_type: "purchase_request_subcon" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get combined sender notifications for Purchase Request Subcon (Pending + Revisi)
 */
export async function getPurchaseRequestSubconCombinedSenderNotifications(
  page = 1,
  limit = 10,
): Promise<{
  pending: PurchaseRequestSubconNotification[];
  revisi: PurchaseRequestSubconNotification[];
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingPurchaseRequestSubconNotifications(page, limit).catch(() => ({
      data: [],
    })),
    getPurchaseRequestSubconRevisiNotifications(page, limit).catch(() => ({
      data: [],
    })),
  ]);

  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || [],
  };
}
