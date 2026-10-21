import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TransferGudangNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  t_transfer_gudang_id?: string;
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
  };
  t_transfer_gudang?: {
    id: string;
    no_tw?: string;
    tgl_tw?: string;
    status: string;
    type?: string;
    catatan?: string;
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
  notification_type?: "transfer_gudang";
}

export interface TransferGudangNotificationResponse {
  data: TransferGudangNotification[];
  status: string;
  approval?: TransferGudangNotification[];
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
 * Get Transfer Gudang Notifications for approval
 */
export async function getTransferGudangNotifications(
  page = 1,
  limit = 10,
): Promise<TransferGudangNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/fn/t_transfer_gudang_notifikasi/getUserApprovalTransferGudang?id=${userId}`,
    { method: "GET" },
  );

  const rawItems = [...(response.approval || []), ...(response.data || [])];
  const seen = new Set<string>();
  const data = rawItems
    .filter((item: TransferGudangNotification) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item: TransferGudangNotification) => ({
      ...item,
      notification_type: "transfer_gudang" as const,
    }));

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Mark Transfer Gudang notification as read
 */
export async function markTransferGudangNotificationAsRead(
  id: string,
): Promise<any> {
  return apiCall(`/dynamic/t_transfer_gudang_notifikasi/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      status: true,
    }),
  });
}

/**
 * Approve Transfer Gudang
 */
export async function approveTransferGudangNotification(
  t_transfer_gudang_id: string,
  t_transfer_gudang_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_transfer_gudang");
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  return apiCall(`/fn/t_transfer_gudang/approveTransferGudang`, {
    method: "POST",
    body: JSON.stringify({
      t_transfer_gudang_id,
      t_transfer_gudang_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id: approvalData.sender_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}

/**
 * Revise Transfer Gudang
 */
export async function reviseTransferGudangNotification(
  t_transfer_gudang_id: string,
  t_transfer_gudang_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_transfer_gudang");
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  return apiCall(`/fn/t_transfer_gudang/revisiTransferGudang`, {
    method: "POST",
    body: JSON.stringify({
      t_transfer_gudang_id,
      t_transfer_gudang_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id: approvalData.sender_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}

/**
 * Reject Transfer Gudang
 */
export async function rejectTransferGudangNotification(
  t_transfer_gudang_id: string,
  t_transfer_gudang_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_transfer_gudang");
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  return apiCall(`/fn/t_transfer_gudang/rejectTransferGudang`, {
    method: "POST",
    body: JSON.stringify({
      t_transfer_gudang_id,
      t_transfer_gudang_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id: approvalData.sender_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}

/**
 * Get Revisi notifications for Transfer Gudang
 */
export async function getTransferGudangRevisiNotifications(
  page = 1,
  limit = 10,
): Promise<TransferGudangNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_transfer_gudang_notifikasi?where=status%3Dfalse&include=t_transfer_gudang:id|no_tw|tgl_tw|status,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map(
    (item: TransferGudangNotification) => ({
      ...item,
      notification_type: "transfer_gudang" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get Pending Approval notifications for Transfer Gudang
 */
export async function getPendingTransferGudangNotifications(
  page = 1,
  limit = 10,
): Promise<TransferGudangNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const response = await apiCall<any>(
    `/dynamic/t_transfer_gudang_notifikasi?where=status%3Dfalse&include=t_transfer_gudang:id|no_tw|tgl_tw|status,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN%20APPROVAL&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map(
    (item: TransferGudangNotification) => ({
      ...item,
      notification_type: "transfer_gudang" as const,
    }),
  );

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get combined sender notifications for Transfer Gudang (Pending + Revisi)
 */
export async function getTransferGudangCombinedSenderNotifications(
  page = 1,
  limit = 10,
): Promise<{
  pending: TransferGudangNotification[];
  revisi: TransferGudangNotification[];
}> {
  const [pendingResult, revisiResult] = await Promise.all([
    getPendingTransferGudangNotifications(page, limit).catch(() => ({
      data: [],
    })),
    getTransferGudangRevisiNotifications(page, limit).catch(() => ({
      data: [],
    })),
  ]);

  return {
    pending: pendingResult.data || [],
    revisi: revisiResult.data || [],
  };
}
