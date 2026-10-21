import { apiCall } from "@/lib/api";

export interface CustomerChangeValue {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface CustomerChangeLog {
  id: string;
  customer_id?: string;
  customer_ub_id?: string;
  change_values?: CustomerChangeValue[] | string | null;
  customer_ub?: any;
  m_customer?: any;
}

export interface CustomerChangeNotification {
  id: string;
  title: string;
  approval_message: string;
  approval_catatan: string | null;
  m_customer_log_id?: string;
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
  m_customer_change_log?: CustomerChangeLog | null;
  notification_type?: "m_customer_change" | "customer_change";
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
      (item: any) =>
        item.path === path && item.tipe_approve?.toUpperCase() === "MENYETUJUI",
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
const CHANGE_NOTIFICATION_INCLUDE = encodeURIComponent(
  "m_customer_change_log>m_customer,m_customer_change_log>m_customer_unit_bisnis,user_default:id|name",
);
const CHANGE_LOG_INCLUDE = encodeURIComponent(
  "customer_ub>m_unit_bisnis,m_customer",
);

export async function getCustomerChangeNotificationById(
  id: string,
): Promise<CustomerChangeNotification> {
  const response = await apiCall<any>(
    `/dynamic/m_customer_change_notifikasi/${id}?join=true&include=${CHANGE_NOTIFICATION_INCLUDE}`,
    { method: "GET" },
  );

  return (response.data || response) as CustomerChangeNotification;
}

export async function getCustomerChangeLogById(
  id: string,
): Promise<CustomerChangeLog> {
  const response = await apiCall<any>(
    `/dynamic/m_customer_change_log/${id}?join=true&include=${CHANGE_LOG_INCLUDE}`,
    { method: "GET" },
  );

  return (response.data || response) as CustomerChangeLog;
}

async function submitCustomerChangeApproval(
  endpoint: "approved" | "revisi" | "reject",
  notification: CustomerChangeNotification,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  const user_approved_id = getUserId();
  const approvalData = getApprovalByPath(CUSTOMER_PATH);

  if (!user_approved_id || !approvalData) {
    throw new Error("Approval data not found");
  }

  const logId =
    notification.m_customer_log_id || notification.m_customer_change_log?.id;
  const customerId = notification.m_customer_change_log?.customer_id;

  if (!logId || !customerId) {
    throw new Error("Data perubahan customer tidak lengkap");
  }

  return apiCall(`/fn/m_customer_change_log/${endpoint}`, {
    method: "POST",
    body: JSON.stringify({
      m_customer_id: customerId,
      m_customer_log_id: logId,
      m_customer_change_notifikasi_id: notification.id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id: approvalData.sender_id,
      m_approval_id: approvalData.id,
    }),
  });
}

export async function approveCustomerChange(
  notification: CustomerChangeNotification,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  return submitCustomerChangeApproval(
    "approved",
    notification,
    approval_level,
    approval_catatan,
  );
}

export async function reviseCustomerChange(
  notification: CustomerChangeNotification,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  return submitCustomerChangeApproval(
    "revisi",
    notification,
    approval_level,
    approval_catatan,
  );
}

export async function rejectCustomerChange(
  notification: CustomerChangeNotification,
  approval_level: number,
  approval_catatan: string,
): Promise<any> {
  return submitCustomerChangeApproval(
    "reject",
    notification,
    approval_level,
    approval_catatan,
  );
}
