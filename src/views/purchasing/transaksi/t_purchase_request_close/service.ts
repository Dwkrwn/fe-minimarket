import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseRequestCloseItem {
  id: string;
  no_preq_close?: string;
  tgl_close?: string;
  t_purchase_request_id?: string;
  m_unit_bisnis_id?: string;
  alasan?: string;
  catatan?: string;
  status?: string;
  created_by?: string;
  updated_by?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  t_purchase_request?: any;
  m_unit_bisni?: any;
  // Detail items
  t_purchase_request_close_ds?: any[];
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentRowsCount: number;
  next_page: number | null;
  prev_page: number | null;
}

export interface TPurchaseRequestCloseListResponse {
  status: string;
  data: TPurchaseRequestCloseItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_request_close data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_purchase_request_close list
 */
export async function getTPurchaseRequestCloseList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string,
): Promise<TPurchaseRequestCloseListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  if (filterCreatedBy) {
    queryParams.append("filter_column_created_by", filterCreatedBy);
  }

  // Add column filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
      }
    });
  }

  if (where?.trim()) {
    queryParams.append("where", where.trim());
  }

  // Add join parameter to include relations
  queryParams.append("join", "true");

  return apiCall<TPurchaseRequestCloseListResponse>(
    `/dynamic/t_purchase_request_close?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPurchaseRequestClose by ID
 * @param id - TPurchaseRequestClose ID
 * @returns Promise with t_purchase_request_close detail
 */
export async function getTPurchaseRequestCloseById(
  id: string,
): Promise<{ status: string; data: TPurchaseRequestCloseItem }> {
  return apiCall(
    `/dynamic/t_purchase_request_close/${id}?include=m_unit_bisnis:id|nama_comp,t_purchase_request>t_purchase_request_d,t_purchase_request>m_unit_bisnis:id|nama_comp,t_purchase_request>user_default:id|name,user_default,t_purchase_request_close_d>t_purchase_order_d:id|qty_po,t_purchase_request_close_d>m_items:id|nama_item|kode_item>m_general:id|value1`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TPurchaseRequestClose
 * @param data - t_purchase_request_close data
 * @returns Promise with created TPurchaseRequestClose
 */
export async function createTPurchaseRequestClose(
  data: Partial<TPurchaseRequestCloseItem>,
): Promise<{ status: string; data: TPurchaseRequestCloseItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_request_close_ds &&
    data.t_purchase_request_close_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_request_close/with-details"
    : "/dynamic/t_purchase_request_close";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TPurchaseRequestClose
 * @param id - TPurchaseRequestClose ID
 * @param data - t_purchase_request_close data to update
 * @returns Promise with updated TPurchaseRequestClose
 */
export async function updateTPurchaseRequestClose(
  id: string,
  data: Partial<TPurchaseRequestCloseItem>,
): Promise<{ status: string; data: TPurchaseRequestCloseItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_request_close_ds &&
    data.t_purchase_request_close_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_request_close/with-details/${id}`
    : `/dynamic/t_purchase_request_close/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete TPurchaseRequestClose
 * @param id - TPurchaseRequestClose ID
 * @returns Promise with delete confirmation
 */
export async function deleteTPurchaseRequestClose(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_request_close/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteTPurchaseRequestClose(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_purchase_request_close/bulkDelete",
    ids,
    deleteTPurchaseRequestClose,
  );
}

/**
 * Get all t_purchase_request_close data without pagination (for sidebar)
 * @returns Promise with t_purchase_request_close list
 */
export async function getTPurchaseRequestCloseListNoPagination(): Promise<TPurchaseRequestCloseListResponse> {
  return apiCall<TPurchaseRequestCloseListResponse>(
    "/dynamic/t_purchase_request_close?no_pagination=true",
    {
      method: "GET",
    },
  );
}

/**
 * Get sisa (remaining) PR qty per item
 * @param purchaseRequestId - Purchase Request ID
 * @param excludeCloseId - Optional, exclude a specific close record (for edit mode)
 * @returns Promise with sisa PR data per item
 */
export async function getPrSisa(
  purchaseRequestId: string,
  excludeCloseId?: string,
): Promise<{ status: string; data: any[] }> {
  const params = new URLSearchParams({
    purchase_request_id: purchaseRequestId,
  });
  if (excludeCloseId) {
    params.append("exclude_close_id", excludeCloseId);
  }
  return apiCall(`/fn/t_purchase_request/getPrSisa?${params}`, {
    method: "GET",
  });
}

/**
 * Get outstanding PR list with details_outstanding
 * @param params - query params for outstanding list
 */
export async function getPROutstandingList(
  params: Record<string, string | number | boolean | undefined>,
): Promise<{ status: string; data: any[]; pagination?: any }> {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });

  return apiCall(`/fn/t_purchase_request/getPROutstandingList?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Approve PR Close - dipakai Super Admin untuk auto-approve saat save
 */
export async function approveTPurchaseRequestClose(
  preq_close_id: string,
  preq_close_notifikasi_id: string | null,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: any }> {
  let fallbackUserId: string | null = null;
  try {
    const authData = localStorage.getItem("auth_bb");
    if (authData) {
      const auth = JSON.parse(authData);
      fallbackUserId = auth.user?.id || null;
    }
  } catch {
    // ignore
  }

  let approvalData: {
    level: number;
    sender_id: string;
    id: string | null;
  } | null = null;
  try {
    const approvalListStr = localStorage.getItem("approval_list");
    const authData = localStorage.getItem("auth_bb");
    if (approvalListStr && authData) {
      const approvalList = JSON.parse(approvalListStr);
      const auth = JSON.parse(authData);
      const approval = approvalList.find(
        (a: any) =>
          a.path === "/purchasing/transaksi/t_purchase_request_close" &&
          a.tipe_approve?.toUpperCase() === "MENYETUJUI",
      );
      if (approval) {
        approvalData = {
          level: approval.level,
          sender_id: auth.user?.id || "",
          id: approval.id || null,
        };
      }
    }
  } catch {
    // ignore
  }

  return apiCall(`/fn/t_purchase_request_close/approve`, {
    method: "POST",
    body: JSON.stringify({
      purchase_request_close_id: preq_close_id,
      purchase_request_close_notifikasi_id: preq_close_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}
