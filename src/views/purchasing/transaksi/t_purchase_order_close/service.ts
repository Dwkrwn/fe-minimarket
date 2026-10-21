import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseOrderCloseDetail {
  id?: string;
  t_purchase_order_close_id?: string;
  m_items_id?: string;
  t_purchase_order_d_id?: string; // Reference to t_purchase_order_d.id
  qty_close?: number;
  qty_sisa?: number;
  catatan?: string;
  // Display fields from relations
  kode_item?: string;
  nama_item?: string;
  qty_po?: number;
  satuan?: string;
  // Relations
  m_items?: {
    id: string;
    kode_item: string;
    nama_item: string;
    mi_uom?: {
      id: string;
      value1: string; // satuan
    };
    m_general?: {
      id: string;
      value1: string; // satuan (fallback)
    };
  };
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    mi_uom?: {
      id: string;
      value1: string; // satuan
    };
    m_general?: {
      id: string;
      value1: string; // satuan (fallback)
    };
  };
  t_purchase_order_d?: {
    id: string;
    qty_po?: number;
  };
}

export interface TPurchaseOrderCloseItem {
  id: string;
  m_unit_bisnis_id?: string;
  t_purchase_order_id: string;
  tgl_po_close?: string;
  no_po_close?: string;
  alasan: string;
  catatan?: string;
  status: string;
  created_by?: string;
  edited_by?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  m_unit_bisnis?: {
    id: string;
    nama_comp: string;
  };
  t_purchase_order?: {
    id: string;
    no_po: string;
    tgl_po: string;
    m_supplier_id: string;
    m_supplier?: {
      id: string;
      nama_supp: string;
    };
    t_purchase_order_ds?: any[];
  };
  // Details
  t_purchase_order_close_ds?: TPurchaseOrderCloseDetail[];
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

export interface TPurchaseOrderCloseListResponse {
  status: string;
  data: TPurchaseOrderCloseItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_order_close data
 */
export async function getTPurchaseOrderCloseList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  include?: string,
  filters?: Record<string, string>,
  where?: string,
): Promise<TPurchaseOrderCloseListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: include || "t_purchase_order>m_supplier,m_unit_bisnis",
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  // Filter by creator if specified
  if (filterCreatedBy) {
    queryParams.append("created_by", filterCreatedBy);
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

  return apiCall<TPurchaseOrderCloseListResponse>(
    `/dynamic/t_purchase_order_close?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPurchaseOrderClose by ID with details
 */
export async function getTPurchaseOrderCloseById(
  id: string,
): Promise<{ status: string; data: TPurchaseOrderCloseItem }> {
  const include =
    "m_unit_bisnis:id|nama_comp,t_purchase_order:id|no_po>m_supplier:id|nama_supp,t_purchase_order_close_d>m_items:id|nama_item|kode_item>m_general:id|value1,t_purchase_order_close_d>t_purchase_order_d:id|qty_po";
  return apiCall(
    `/dynamic/t_purchase_order_close/${id}?include=${encodeURIComponent(include)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TPurchaseOrderClose
 */
export async function createTPurchaseOrderClose(
  data: Partial<TPurchaseOrderCloseItem>,
): Promise<{ status: string; data: TPurchaseOrderCloseItem }> {
  const hasDetails = !!(
    data.t_purchase_order_close_ds && data.t_purchase_order_close_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_order_close/with-details"
    : "/dynamic/t_purchase_order_close";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TPurchaseOrderClose
 */
export async function updateTPurchaseOrderClose(
  id: string,
  data: Partial<TPurchaseOrderCloseItem>,
): Promise<{ status: string; data: TPurchaseOrderCloseItem }> {
  const hasDetails = !!(
    data.t_purchase_order_close_ds && data.t_purchase_order_close_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_order_close/with-details/${id}`
    : `/dynamic/t_purchase_order_close/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Post TPurchaseOrderClose - Change status to POST
 */
export async function postTPurchaseOrderClose(
  id: string,
): Promise<{ status: string; data: TPurchaseOrderCloseItem }> {
  return apiCall(`/dynamic/t_purchase_order_close/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST" }),
  });
}

/**
 * Delete TPurchaseOrderClose
 */
export async function deleteTPurchaseOrderClose(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_purchase_order_close/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteTPurchaseOrderClose(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_purchase_order_close/bulkDelete",
    ids,
    deleteTPurchaseOrderClose,
  );
}

// ============================================================================
// FN ENDPOINTS
// ============================================================================

/**
 * Get outstanding POs (status APPROVED with remaining qty)
 * Used for PO selection when creating PO Close
 */
export async function getPoOutstanding(params?: {
  m_unit_bisnis_id?: string;
  search?: string;
  page?: number;
  paginate?: number;
}): Promise<{ status: string; data: any[]; pagination?: any }> {
  const query = new URLSearchParams();
  if (params?.m_unit_bisnis_id)
    query.append("filter_column_m_unit_bisnis_id", params.m_unit_bisnis_id);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.paginate) query.append("paginate", String(params.paginate));
  const qs = query.toString();
  return apiCall(`/fn/t_purchase_order/getPoOutstanding${qs ? "?" + qs : ""}`, {
    method: "GET",
  });
}

/**
 * Get remaining qty (qty_sisa) for a specific t_purchase_order_d item
 * Tries GetDetail first, falls back to GetDetailDone for fully-received items
 */
export async function getPoDetailSisa(
  t_purchase_order_d_id: string,
): Promise<any | null> {
  try {
    let res = await apiCall<{ status: string; data: any[] }>(
      `/fn/t_purchase_order_d/GetDetail?filter_column_id=${t_purchase_order_d_id}`,
      { method: "GET" },
    );
    if (res.status === "success" && res.data?.length > 0) return res.data[0];

    // Fallback: item already fully received
    res = await apiCall<{ status: string; data: any[] }>(
      `/fn/t_purchase_order_d/GetDetailDone?filter_column_id=${t_purchase_order_d_id}`,
      { method: "GET" },
    );
    if (res.status === "success" && res.data?.length > 0) return res.data[0];
  } catch (error) {
    console.error("getPoDetailSisa error:", error);
  }
  return null;
}

/**
 * Approve PO Close - dipakai Super Admin untuk auto-approve saat save
 */
export async function approveTPurchaseOrderClose(
  po_close_id: string,
  po_close_notifikasi_id: string | null,
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
          a.path === "/purchasing/transaksi/t_purchase_order_close" &&
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

  return apiCall(`/fn/t_purchase_order_close/approve`, {
    method: "POST",
    body: JSON.stringify({
      po_close_id,
      po_close_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}
