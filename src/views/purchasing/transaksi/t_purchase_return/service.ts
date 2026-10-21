import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseReturnItem {
  id?: string;
  m_unit_bisnis_id?: string;
  status?: string;
  no_return?: string;
  tgl_retur?: string;
  m_supplier_id?: string;
  t_penerimaan_barangs_id?: string;
  t_purchase_invoice_id?: string;
  t_purchase_order_id?: string;
  m_gudang_id?: string;
  tiper_retur?: string;
  ppn_id?: string;
  pph_id?: string;
  m_currency_id?: string;
  m_currency_d_id?: string;
  catatan?: string;
  total?: number | string;
  total_diskon?: number | string;
  total_ppn?: number | string;
  total_pph?: number | string;
  grand_total?: number | string;
  created_by?: string;
  updated_by?: string;
  is_pi_pb?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Relations
  m_unit_bisni?: any;
  m_supplier?: any;
  t_penerimaan_barang?: any;
  t_purchase_invoice?: any;
  t_purchase_order?: any;
  m_gudang?: any;
  t_pr_retur?: any;
  t_pr_ppn?: any;
  t_pr_pph?: any;
  m_currency?: any;
  t_pr_ctr?: any;
  t_pr_update?: any;
  // Detail items
  t_purchase_return_d?: any[];
  t_purchase_return_ds?: any[];
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

export interface TPurchaseReturnListResponse {
  status: string;
  data: TPurchaseReturnItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_return data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_purchase_return list
 */
export async function getTPurchaseReturnList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string
): Promise<TPurchaseReturnListResponse> {
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

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
        if (filterOperators?.[key]) {
          queryParams.append(`filter_operator_${key}`, filterOperators[key]);
        }
      }
    });
  }

  if (where) {
    queryParams.append("where", where);
  }

  // Add include parameter for related data
  const include =
    "m_general:id|value1,m_supplier,m_currency,user_default:name|id";
  queryParams.append("include", include);
  queryParams.append("join", "sub");

  return apiCall<TPurchaseReturnListResponse>(
    `/dynamic/t_purchase_return?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPurchaseReturn by ID
 * @param id - TPurchaseReturn ID
 * @param is_pi_pb - Flag untuk referensi PB (true) atau PI (false)
 * @returns Promise with t_purchase_return detail with relations
 */
export async function getTPurchaseReturnById(
  id: string,
  is_pi_pb?: boolean,
): Promise<{ status: string; data: TPurchaseReturnItem }> {

  const include = [
    "m_currency>money",   
    "m_supplier",
    "m_gudang",         
    "m_unit_bisnis:id|nama_comp", 
    "t_purchase_return_d>t_penerimaan_barang_d" , 
    "t_purchase_return_d>t_penerimaan_barang_d>t_penerimaan_barangs" ,
    "t_purchase_return_d>t_penerimaan_barang_d>t_purchase_order" ,
    "t_purchase_return_d>t_penerimaan_barang_d>m_rak_d>m_rak" , 
    "t_purchase_return_d>t_purchase_invoice_d",
     "t_purchase_return_d>t_purchase_invoice_d>t_purchase_order",
    "t_purchase_return_d>t_purchase_invoice_d>t_purchase_invoice>m_supplier",
    "t_purchase_return_d>t_purchase_invoice_d>t_purchase_invoice>m_supplier>m_general",
    "t_purchase_return_d>t_purchase_invoice_d>t_purchase_invoice>m_currency>money",
    "t_purchase_return_d>t_purchase_invoice_d>t_penerimaan_barang_d>m_rak_d>m_rak",
    "t_purchase_return_d>m_items:id|kode_item|nama_item",
    "t_purchase_return_d>m_items>m_general", 
    "t_purchase_return_d>m_general", 
  ].join(",");

  return apiCall(
    `/dynamic/t_purchase_return/${id}?include=${encodeURIComponent(include)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TPurchaseReturn
 * @param data - t_purchase_return data
 * @returns Promise with created TPurchaseReturn
 */
export async function createTPurchaseReturn(
  data: Partial<TPurchaseReturnItem>,
): Promise<{ status: string; data: TPurchaseReturnItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_return_ds && data.t_purchase_return_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_return/with-details"
    : "/dynamic/t_purchase_return";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TPurchaseReturn
 * @param id - TPurchaseReturn ID
 * @param data - t_purchase_return data to update
 * @returns Promise with updated TPurchaseReturn
 */
export async function updateTPurchaseReturn(
  id: string,
  data: Partial<TPurchaseReturnItem>,
): Promise<{ status: string; data: TPurchaseReturnItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_return_ds && data.t_purchase_return_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_return/with-details/${id}`
    : `/dynamic/t_purchase_return/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete TPurchaseReturn
 * @param id - TPurchaseReturn ID
 * @returns Promise with delete confirmation
 */
export async function deleteTPurchaseReturn(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_return/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteTPurchaseReturn(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_purchase_return/bulkDelete",
    ids,
    deleteTPurchaseReturn,
  );
}

/**
 * Get all t_purchase_return data without pagination (for sidebar)
 * @returns Promise with t_purchase_return list
 */
export async function getTPurchaseReturnListNoPagination(): Promise<TPurchaseReturnListResponse> {
  return apiCall<TPurchaseReturnListResponse>(
    "/dynamic/t_purchase_return?no_pagination=true",
    {
      method: "GET",
    },
  );
}

/**
 * Approve Purchase Return - dipakai Super Admin untuk auto-approve saat save
 */
export async function approveTPurchaseReturn(
  return_id: string,
  return_notifikasi_id: string | null,
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
          a.path === "/purchasing/transaksi/t_purchase_return" &&
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

  return apiCall(`/fn/t_purchase_return/approve`, {
    method: "POST",
    body: JSON.stringify({
      return_id,
      return_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}
