import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface SupplierNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  m_supplier_id?: string;
  sender_id: string;
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
  m_supplier?: {
    id: string;
    kode_supplier?: string | null;
    nama_supp: string;
    tipe_supp_id: string;
    alamat_supp: string;
    negara_supp: string;
    provinsi_supp: string;
    kota_supp: string;
    kecamatan_supp?: string | null;
    kodepos?: string | null;
    no_telp?: string | null;
    no_fax?: string | null;
    email?: string | null;
    website?: string | null;
    npwp_supp?: string | null;
    cp1: string;
    no_cp1: string;
    cp2?: string | null;
    no_cp2?: string | null;
    is_tax?: boolean;
    top_id?: string | null;
    m_currency_id?: string | null;
    m_coa_id?: string | null;
    catatan?: string | null;
    is_active?: boolean;
    created_by?: string;
    updated_by?: string;
    createdAt?: string;
    updatedAt?: string;
    tipe_supp?: {
      id: string;
      value1: string;
    };
    top?: {
      id: string;
      value1: string;
    };
    m_currency?: {
      id: string;
      kode_currency: string;
    };
    m_supplier_d_rekenings?: Array<{
      id?: string;
      m_supplier_id?: string;
      bank?: string | null;
      no_rek?: number | null;
      is_default?: boolean;
    }>;
    m_supplier_d_alamats?: Array<{
      id?: string;
      m_supplier_id?: string;
      jenis_almt_id?: string | null;
      alamat?: string | null;
      provinsi?: string | null;
      kota?: string | null;
      kecamatan?: string | null;
      kodepos?: string | null;
      telp?: string | null;
      fax?: string | null;
      email?: string | null;
      nama_pic?: string | null;
      catatan?: string | null;
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
  notification_type?: "supplier";
}

export interface SupplierNotificationResponse {
  data: SupplierNotification[];
  status: string;
  approval?: SupplierNotification[];
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
 * @param path - The menu path to match (e.g., '/purchasing/master/m_supplier')
 * @returns Approval data object with id and sender_id, or null if not found
 */
function getApprovalByPath(
  path: string,
): { id: string; sender_id: string; level: number } | null {
  const approvalList = localStorage.getItem("approval_list");
  if (approvalList) {
    try {
      const parsed = JSON.parse(approvalList);
      if (Array.isArray(parsed)) {
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
      }
    } catch (e) {
      console.error("Failed to parse approval list:", e);
    }
  }
  return null;
}

// Supplier path constant
const SUPPLIER_PATH = "/purchasing/master/m_supplier";

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get Supplier Notifications for approval
 */
export async function getSupplierNotifications(
  page = 1,
  limit = 10,
): Promise<SupplierNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User ID not found");
  }

  const response = await apiCall<any>(
    `/fn/m_supplier_notifikasi/getUserApprovalSupplier?id=${userId}`,
    { method: "GET" },
  );

  const data = (response.approval || []).map((item: SupplierNotification) => ({
    ...item,
    notification_type: "supplier" as const,
  }));

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get Supplier Pending Approval Notifications for the sender (user who created the Supplier)
 * This shows notifications when their Supplier is waiting for approval (IN APPROVAL status)
 */
export async function getSupplierPendingApprovalNotifications(
  page = 1,
  limit = 10,
): Promise<SupplierNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User ID not found");
  }

  const response = await apiCall<any>(
    `/dynamic/m_supplier_notifikasi?where=status%3Dfalse&include=m_supplier:id|nama_supp|kode_supplier,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=IN APPROVAL&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map((item: SupplierNotification) => ({
    ...item,
    notification_type: "supplier" as const,
  }));

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Mark Supplier notification as read
 */
export async function markSupplierNotificationAsRead(id: string): Promise<any> {
  return apiCall(`/dynamic/m_supplier_notifikasi`, {
    method: "POST",
    body: JSON.stringify({
      id,
      status: true,
    }),
  });
}

/**
 * Approve Supplier - POST to /fn/m_supplier/approved
 * Updates both Supplier status and notification
 */
export async function approveSupplier(
  supplier_id: string,
  supplier_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  if (!user_approved_id) {
    throw new Error("User ID not found");
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(SUPPLIER_PATH);
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  // Call custom endpoint - backend handles status update based on approval level
  const result = await apiCall(`/fn/m_supplier/approved`, {
    method: "POST",
    body: JSON.stringify({
      m_supplier_id: supplier_id,
      m_supplier_notifikasi_id: supplier_notifikasi_id,
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
 * Revise Supplier - POST to /fn/m_supplier/revisi
 * Updates both Supplier status and notification
 */
export async function reviseSupplier(
  supplier_id: string,
  supplier_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  if (!user_approved_id) {
    throw new Error("User ID not found");
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(SUPPLIER_PATH);
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/m_supplier/revisi`, {
    method: "POST",
    body: JSON.stringify({
      m_supplier_id: supplier_id,
      m_supplier_notifikasi_id: supplier_notifikasi_id,
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
 * Reject Supplier - POST to /fn/m_supplier/reject
 * Updates both Supplier status and notification
 */
export async function rejectSupplier(
  supplier_id: string,
  supplier_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  if (!user_approved_id) {
    throw new Error("User ID not found");
  }

  // Get m_approval_id and sender_id from localStorage
  const approvalData = getApprovalByPath(SUPPLIER_PATH);
  if (!approvalData) {
    throw new Error("Approval data not found");
  }

  const result = await apiCall(`/fn/m_supplier/reject`, {
    method: "POST",
    body: JSON.stringify({
      m_supplier_id: supplier_id,
      m_supplier_notifikasi_id: supplier_notifikasi_id,
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
 * Get Supplier Revisi Notifications for the sender (user who created the Supplier)
 * This shows notifications when their Supplier was revised by approver
 */
export async function getSupplierRevisiNotifications(
  page = 1,
  limit = 10,
): Promise<SupplierNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User ID not found");
  }

  const response = await apiCall<any>(
    `/dynamic/m_supplier_notifikasi?where=status%3Dfalse&include=m_supplier:id|nama_supp|kode_supplier,user_default:id|name&filter_column_sender_id=${userId}&filter_column_status_name=REVISI&page=${page}&limit=${limit}`,
    { method: "GET" },
  );

  const data = (response.data || []).map((item: SupplierNotification) => ({
    ...item,
    notification_type: "supplier" as const,
  }));

  return {
    status: response.status,
    data,
    pagination: response.pagination,
  };
}

/**
 * Get combined sender notifications for Supplier (Pending + Revisi)
 * Used in main notification view to show all sender-related notifications
 */
export async function getSupplierCombinedSenderNotifications(
  page = 1,
  limit = 10,
): Promise<{
  pending: SupplierNotification[];
  revisi: SupplierNotification[];
}> {
  const [pendingResponse, revisiResponse] = await Promise.all([
    getSupplierPendingApprovalNotifications(page, limit),
    getSupplierRevisiNotifications(page, limit),
  ]);

  return {
    pending: pendingResponse.data,
    revisi: revisiResponse.data,
  };
}
