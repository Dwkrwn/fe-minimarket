import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface StockOpnameNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  t_stock_opname_id?: string;
  sender_id: string;
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
  // Alias untuk sender (dari relasi)
  topname_sender?: {
    id: string;
    name: string;
  };
  // Alias untuk approver (dari relasi)
  topname_approval?: {
    id: string;
    name: string;
  };
  column_name?: string;
  t_stock_opname?: {
    id: string;
    no_stock_opname?: string;
    tgl_opname?: string;
    status: string;
    catatan?: string;
    created_by?: string;
    updated_by?: string;
    createdAt?: string;
    updatedAt?: string;
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
  notification_type?: "stock_opname";
}

export interface StockOpnameNotificationResponse {
  data: StockOpnameNotification[];
  status: string;
  approval?: StockOpnameNotification[];
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
 * Get Stock Opname Notifications for approval
 */
export async function getStockOpnameNotifications(
  page = 1,
  limit = 10,
): Promise<StockOpnameNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/fn/t_stock_opname_notifikasi/getUserApprovalStockOpname?id=${userId}`,
    { method: "GET" },
  );

  const data = (response.approval || []).map(
    (item: StockOpnameNotification) => ({
      ...item,
      notification_type: "stock_opname" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Mark Stock Opname notification as read
 */
export async function markStockOpnameNotificationAsRead(
  id: string,
): Promise<any> {
  return apiCall(`/dynamic/t_stock_opname_notifikasi`, {
    method: "POST",
    body: JSON.stringify({
      id,
      status: true,
    }),
  });
}

/**
 * Approve Stock Opname - POST to custom endpoint
 * Handles both notification update and record status update
 */
export async function approveStockOpname(
  t_stock_opname_id: string,
  t_stock_opname_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath("/inventory/opname/fisik");
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/t_stock_opname/approve`, {
    method: "POST",
    body: JSON.stringify({
      t_stock_opname_id,
      t_stock_opname_notifikasi_id,
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
 * Revise Stock Opname - POST to custom endpoint
 */
export async function reviseStockOpname(
  t_stock_opname_id: string,
  t_stock_opname_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath("/inventory/opname/fisik");
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/t_stock_opname/revisi`, {
    method: "POST",
    body: JSON.stringify({
      t_stock_opname_id,
      t_stock_opname_notifikasi_id,
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
 * Reject Stock Opname - POST to custom endpoint
 */
export async function rejectStockOpname(
  t_stock_opname_id: string,
  t_stock_opname_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath("/inventory/opname/fisik");
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/t_stock_opname/reject`, {
    method: "POST",
    body: JSON.stringify({
      t_stock_opname_id,
      t_stock_opname_notifikasi_id,
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
 * Get Revisi notifications for Stock Opname (where sender_id = current user, status_name = REVISI)
 */
export async function getStockOpnameRevisiNotifications(
  page = 1,
  limit = 10,
): Promise<StockOpnameNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_stock_opname_notifikasi?where=status%3Dfalse&include=t_stock_opname:id|no_stock_opname|tgl_opname|status,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map((item: StockOpnameNotification) => ({
    ...item,
    notification_type: "stock_opname" as const,
  }));

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get Pending Approval notifications for Stock Opname (where sender_id = current user, status_name = IN APPROVAL)
 */
export async function getPendingStockOpnameNotifications(
  page = 1,
  limit = 10,
): Promise<StockOpnameNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_stock_opname_notifikasi?where=status%3Dfalse&include=t_stock_opname:id|no_stock_opname|tgl_opname|status,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map((item: StockOpnameNotification) => ({
    ...item,
    notification_type: "stock_opname" as const,
  }));

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get combined sender notifications for Stock Opname (Pending + Revisi)
 */
export async function getStockOpnameCombinedSenderNotifications(
  page = 1,
  limit = 10,
): Promise<{
  pending: StockOpnameNotification[];
  revisi: StockOpnameNotification[];
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingStockOpnameNotifications(page, limit).catch(() => ({ data: [] })),
    getStockOpnameRevisiNotifications(page, limit).catch(() => ({ data: [] })),
  ]);

  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || [],
  };
}
