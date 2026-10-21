import { apiCall } from "@/lib/api";

export interface CustomerNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  m_customer_id?: string;
  sender_id: string;
  approval_level: number;
  status: boolean;
  status_name?: string;
  createdAt: string;
  updatedAt: string;
  user_default?: {
    id: string;
    name: string;
  };
  m_customer?: {
    id: string;
    kode_customer?: string | null;
    nama_customer?: string | null;
    alias_customer?: string | null;
    no_npwp?: string | null;
    no_telp_office?: string | null;
    email?: string | null;
    alamat?: string | null;
    kota?: string | null;
    provinsi?: string | null;
    is_active?: boolean;
    status?: string;
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
  notification_type?: "m_customer" | "customer";
}

export interface CustomerNotificationResponse {
  data: CustomerNotification[];
  status: string;
  approval?: CustomerNotification[];
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

function getUserId(): string {
  const authData = localStorage.getItem("auth_bb");
  if (!authData) return "";
  try {
    const parsed = JSON.parse(authData);
    return parsed.user?.id || "";
  } catch {
    return "";
  }
}

function getApprovalByPath(
  path: string,
): { id: string; sender_id: string; level: number } | null {
  const approvalList = localStorage.getItem("approval_list");
  if (!approvalList) return null;

  try {
    const parsed = JSON.parse(approvalList);
    if (!Array.isArray(parsed)) return null;
    const approval = parsed.find(
      (a: any) =>
        a.path === path && a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );
    if (!approval) return null;
    return {
      id: approval.id,
      sender_id: approval.sender_id,
      level: approval.level,
    };
  } catch {
    return null;
  }
}

const CUSTOMER_PATH = "/marketing/master/m_customer";

export async function   getCustomerNotifications(
  page = 1,
  limit = 10,
): Promise<CustomerNotificationResponse> {
  const userId = getUserId();
  if (!userId) throw new Error("User ID not found");

  const response = await apiCall<any>(
    `/fn/m_customer_notifikasi/getUserApprovalCustomer?id=${userId}`,
    { method: "GET" },
  );

  return {
    status: response.status,
    data: (response.approval || []).map((item: CustomerNotification) => ({
      ...item,
      notification_type: "m_customer" as const,
    })),
    pagination: response.pagination,
  };
}

export async function approveCustomer(
  customer_id: string,
  customer_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  const approvalData = getApprovalByPath(CUSTOMER_PATH);
  if (!user_approved_id || !approvalData) {
    throw new Error("Approval data not found");
  }

  return apiCall(`/fn/m_customer/approved`, {
    method: "POST",
    body: JSON.stringify({
      m_customer_id: customer_id,
      m_customer_notifikasi_id: customer_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}

export async function reviseCustomer(
  customer_id: string,
  customer_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  const approvalData = getApprovalByPath(CUSTOMER_PATH);
  if (!user_approved_id || !approvalData) {
    throw new Error("Approval data not found");
  }

  return apiCall(`/fn/m_customer/revisi`, {
    method: "POST",
    body: JSON.stringify({
      m_customer_id: customer_id,
      m_customer_notifikasi_id: customer_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}

export async function rejectCustomer(
  customer_id: string,
  customer_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  const approvalData = getApprovalByPath(CUSTOMER_PATH);
  if (!user_approved_id || !approvalData) {
    throw new Error("Approval data not found");
  }

  return apiCall(`/fn/m_customer/reject`, {
    method: "POST",
    body: JSON.stringify({
      m_customer_id: customer_id,
      m_customer_notifikasi_id: customer_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}
