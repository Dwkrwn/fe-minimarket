import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseOrderDetail {
  id?: string;
  t_purchase_order_id?: string;
  t_purchase_request_d_id?: string;
  m_items_id?: string;
  // PR fields (flattened)
  no_pr?: string;
  diminta_oleh?: string;
  prioritas_id?: string;
  prioritas?: string;
  qty_pr?: number;
  alasan?: string;
  // Item fields (flattened)
  kode_item?: string;
  nama_item?: string;
  uom?: string;
  // PO detail fields
  qty_po?: number;
  harga?: string | number;
  disc_1?: string | number;
  disc_2?: string | number;
  disc_3?: string | number;
  amt_disc?: string | number;
  sub_total?: string | number;
  disc_total?: string | number;
  ppn_total?: string | number;
  total_stlh_pajak?: string | number;
  catatan?: string;
  // Audit fields
  created_by?: string;
  updated_by?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TPurchaseOrderItem {
  id?: string;
  supplier_quotation_id?: string;
  is_import?: boolean;
  m_currency_id: string;
  dp?: number;
  purchase_request_id?: string;
  gudang_id?: string;
  tgl_po: string;
  m_supplier_id: string;
  top_id?: string;
  ppn_id: string;
  created_by: string;
  updated_by: string;
  m_unit_bisnis_id?: string;
  total?: number;
  total_diskon?: number;
  total_ppn?: number;
  grand_total?: number;
  pph_percentage?: number;
  persen_pph?: number;
  m_currency_d_id: string;
  no_po?: string;
  catatan?: string;
  // tipe_item?: string
  status_transaksi?: string;
  status?: string;
  ekspedisi_id?: string;
  createdAt?: string;
  updatedAt?: string;
  t_purchase_order_ds?: TPurchaseOrderDetail[];
  // Relations from include
  m_supplier?: {
    id: string;
    kode_supplier?: string;
    nama_supp: string;
    is_tax?: boolean;
    top_id?: string;
    m_currency_id?: string;
  };
  m_general?: { id: string; value1: string };
  m_unit_bisnis?: { id: string; nama_comp: string };
  m_unit_bisni?: { id: string; nama_comp: string };
  top_po?: { id: string; value1: string; value3?: string };
  ppn_po?: { id: string; key1?: string; value1: string; value3: string; value4?: string };
  uang_po?: {
    id: string;
    kode_currency?: string;
    nama_currency?: string;
    money?: {
      id: string;
      key1: string;
      value1: string;
      value2: string;
      value5?: string;
    };
  };
  det_uang_po?: {
    id: string;
    m_currency_id: string;
    tgl_mulai: string;
    rate: string;
    is_active?: boolean | null;
  };
  // relations
  po_tipe_item?: {
    group: string;
    value1: string;
  };
  po_ekspedisi?: {
    group: string;
    value1: string;
  };
  po_ctr?: { id: string; name: string; username: string };
  po_updt?: { id: string; name: string; username: string } | null;
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

export interface TPurchaseOrderListResponse {
  status: string;
  data: TPurchaseOrderItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_order data
 * @param params - Query parameters object
 * @returns Promise with t_purchase_order list
 */
export async function getTPurchaseOrderList(params?: {
  page?: number;
  paginate?: number;
  order_by?: string;
  order_type?: "ASC" | "DESC";
  search?: string;
  searchfield?: string;
  include?: string;
  filters?: Record<string, string>;
  filterOperators?: Record<string, string>;
  where?: string;
}): Promise<TPurchaseOrderListResponse> {
  const queryParams = new URLSearchParams({
    page: (params?.page || 1).toString(),
    paginate: (params?.paginate || 10).toString(),
    order_by: params?.order_by || "createdAt",
    order_type: params?.order_type || "DESC",
  });

  if (params?.search && params.search.trim()) {
    queryParams.append("search", params.search.trim());
  }

  if (params?.searchfield) {
    queryParams.append("searchfield", params.searchfield);
  }

  if (params?.include) {
    queryParams.append("include", params.include);
  }

  // Add filter_column parameters for nested field searches
  if (params?.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
        // Add corresponding filter_operator if provided
        if (params.filterOperators?.[key]) {
          queryParams.append(
            `filter_operator_${key}`,
            params.filterOperators[key],
          );
        }
      }
    });
  }

  // Add where clause for complex filtering (e.g., date ranges)
  if (params?.where) {
    queryParams.append("where", params.where);
  }

  return apiCall<TPurchaseOrderListResponse>(
    `/dynamic/t_purchase_order?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPurchaseOrder by ID (complete data with all relations)
 * @param id - TPurchaseOrder ID
 * @returns Promise with t_purchase_order detail
 */
export async function getTPurchaseOrderById(
  id: string,
): Promise<{ status: string; data: TPurchaseOrderItem }> {
  return apiCall(
    `/dynamic/t_purchase_order/${id}?join=true&include=t_purchase_order_d>t_purchase_request_d>m_general,t_purchase_order_d>m_items,m_gudang,t_purchase_request,m_general,m_unit_bisnis,m_unit_bisnis>m_company,m_currency>money,m_currency_d`,
    {
      method: "GET",
    },
  );
}
// export async function getTPurchaseOrderById(id: string): Promise<{ status: string; data: TPurchaseOrderItem }> {
//   return apiCall(`/fn/t_purchase_order/getComplete?id=${id}`, {
//     method: 'GET'
//   })
// }

/**
 * Create new TPurchaseOrder
 * @param data - t_purchase_order data
 * @returns Promise with created TPurchaseOrder
 */
export async function createTPurchaseOrder(
  data: Partial<TPurchaseOrderItem>,
): Promise<{ status: string; data: TPurchaseOrderItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_order_ds && data.t_purchase_order_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_order/with-details"
    : "/dynamic/t_purchase_order";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TPurchaseOrder
 * @param id - TPurchaseOrder ID
 * @param data - t_purchase_order data to update
 * @returns Promise with updated TPurchaseOrder
 */
export async function updateTPurchaseOrder(
  id: string,
  data: Partial<TPurchaseOrderItem>,
): Promise<{ status: string; data: TPurchaseOrderItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_order_ds && data.t_purchase_order_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_order/with-details/${id}`
    : `/dynamic/t_purchase_order/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete TPurchaseOrder
 * @param id - TPurchaseOrder ID
 * @returns Promise with delete confirmation
 */
export async function deleteTPurchaseOrder(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_order/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteTPurchaseOrder(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_purchase_order/bulkDelete",
    ids,
    deleteTPurchaseOrder,
  );
}

/**
 * Get all t_purchase_order data without pagination (for sidebar)
 * @returns Promise with t_purchase_order list
 */
export async function getTPurchaseOrderListNoPagination(): Promise<TPurchaseOrderListResponse> {
  return apiCall<TPurchaseOrderListResponse>(
    "/dynamic/t_purchase_order?no_pagination=true",
    {
      method: "GET",
    },
  );
}

/**
 * Export Excel data for purchase order details
 * @param purchase_request_id - Purchase Request ID (required)
 * @param pr_detail_ids - Array of PR detail IDs (optional), will be joined with comma
 * @returns Promise with blob data for Excel file
 */
export async function exportPurchaseOrderDetailExcel(
  purchase_request_id: string,
  pr_detail_ids?: string[],
): Promise<Blob> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // Get token from localStorage
  let authToken = "";
  const authData = localStorage.getItem("auth_bb");
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      authToken = parsed.token;
    } catch (e) {
      throw new Error("Authentication token not found");
    }
  }

  const params = new URLSearchParams({
    purchase_request_id,
  });

  if (pr_detail_ids && pr_detail_ids.length > 0) {
    params.append("pr_detail_ids", pr_detail_ids.join(","));
  }

  const response = await fetch(
    `${API_BASE_URL}/fn/t_purchase_order_d/exportExcel?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Failed to export Excel" }));
    throw new Error(errorData.message || "Failed to export Excel");
  }

  return await response.blob();
}

/**
 * Import Excel data for purchase order details
 * @param excelData - FormData containing the Excel file
 * @returns Promise with imported data
 */
export async function importPurchaseOrderDetailExcel(
  excelData: FormData,
): Promise<{ status: string; data: any; message?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // Get token from localStorage
  let authToken = "";
  const authData = localStorage.getItem("auth_bb");
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      authToken = parsed.token;
    } catch (e) {
      throw new Error("Authentication token not found");
    }
  }

  const response = await fetch(
    `${API_BASE_URL}/fn/t_purchase_order_d/importExcel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: excelData,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to import Excel");
  }

  return data;
}

/**
 * Get sisa (remaining) PR qty per item
 * @param purchaseRequestId - Purchase Request ID
 * @param excludePoId - Optional, exclude a specific PO record (for edit mode)
 * @returns Promise with sisa PR data per item
 */
export async function getPrSisa(
  purchaseRequestId: string,
  excludePoId?: string,
  excludeZero?: boolean,
): Promise<{ status: string; data: any[] }> {
  const params = new URLSearchParams({
    purchase_request_id: purchaseRequestId,
  });
  if (excludePoId) {
    params.append("exclude_po_id", excludePoId);
  }
  if (excludeZero) {
    params.append("exclude_zero", "true");
  }
  return apiCall(`/fn/t_purchase_request/getPrSisa?${params}`, {
    method: "GET",
  });
}

/**
 * Approve Purchase Order - dipakai Super Admin untuk auto-approve saat save
 */
export async function approveTPurchaseOrder(
  purchase_order_id: string,
  purchase_order_notifikasi_id: string | null,
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
          a.path === "/purchasing/transaksi/t_purchase_order" &&
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

  return apiCall(`/fn/t_purchase_order/approve`, {
    method: "POST",
    body: JSON.stringify({
      purchase_order_id,
      purchase_order_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}
