import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseInvoiceItem {
  id?: string;
  // Purchase Invoice specific fields
  no_pi?: string;
  tgl_pi?: string;
  m_supplier_id?: string;
  t_penerimaan_barang_id?: string;
  tgl_jatuh_tempo?: string;
  m_currency_id?: string;
  m_currency_d_id?: string;
  exchange_rate?: number;
  total?: number;
  total_diskon?: number;
  total_ppn?: number;
  total_pph?: number;
  grand_total?: number;
  catatan?: string;
  seri_pajak?: number;
  dpp_lainnya?: number;
  status?: string;
  status_transaksi?: string;
  m_unit_bisnis_id?: string;
  created_by?: string;
  updated_by?: string;
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  // Relations
  m_unit_bisni?: any;
  t_penerimaan_barang?: any;
  m_supplier?: any;
  m_currency?: any;
  m_currency_d?: any;
  pi_ctr?: any; // created by user
  pi_updt?: any; // updated by user
  pph_pi?: any;
  ppn_pi?: any;
  t_purchase_invoice_details?: any[];
  t_purchase_invoice_ds?: any[]; // For frontend form submission
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

export interface TPurchaseInvoiceListResponse {
  status: string;
  data: TPurchaseInvoiceItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

// Interface for column filters
export interface ColumnFilters {
  [key: string]: string;
}

// Interface for date range filters
export interface DateRangeFilter {
  from: string;
  to: string;
}

export interface DateRangeFilters {
  [key: string]: DateRangeFilter;
}

/**
 * Get all t_purchase_invoice data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param filterCreatedBy - Filter by created user ID (optional)
 * @param include - Include related tables (optional)
 * @param columnFilters - Column filters for API filtering (optional)
 * @returns Promise with t_purchase_invoice list
 */
export async function getTPurchaseInvoiceList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  include?: string,
  columnFilters?: ColumnFilters,
): Promise<TPurchaseInvoiceListResponse> {
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

  if (include) {
    queryParams.append("include", include);
  }

  // Add column filters (filter_column_xxx)
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim());
      }
    });
  }

  return apiCall<TPurchaseInvoiceListResponse>(
    `/dynamic/t_purchase_invoice?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPurchaseInvoice by ID
 * @param id - TPurchaseInvoice ID
 * @returns Promise with t_purchase_invoice detail with relations
 */
export async function getTPurchaseInvoiceById(
  id: string,
): Promise<{ status: string; data: TPurchaseInvoiceItem }> {
  const include =
    "m_currency>money,m_currency_d,m_unit_bisnis:id|nama_comp,t_purchase_invoice_d>t_penerimaan_barang_d,t_purchase_invoice_d>t_purchase_order_d>t_purchase_order:id|no_po|exchange_rate,t_purchase_invoice_d>m_items:id|kode_item|nama_item,t_purchase_invoice_d>t_penerimaan_barangs,t_purchase_invoice_d>m_general";
  return apiCall(
    `/dynamic/t_purchase_invoice/${id}?include=${encodeURIComponent(include)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TPurchaseInvoice
 * @param data - t_purchase_invoice data
 * @returns Promise with created TPurchaseInvoice
 */
export async function createTPurchaseInvoice(
  data: Partial<TPurchaseInvoiceItem>,
): Promise<{ status: string; data: TPurchaseInvoiceItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_invoice_ds && data.t_purchase_invoice_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_invoice/with-details"
    : "/dynamic/t_purchase_invoice";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TPurchaseInvoice
 * @param id - TPurchaseInvoice ID
 * @param data - t_purchase_invoice data to update
 * @returns Promise with updated TPurchaseInvoice
 */
export async function updateTPurchaseInvoice(
  id: string,
  data: Partial<TPurchaseInvoiceItem>,
): Promise<{ status: string; data: TPurchaseInvoiceItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_invoice_ds && data.t_purchase_invoice_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_invoice/with-details/${id}`
    : `/dynamic/t_purchase_invoice/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete TPurchaseInvoice
 * @param id - TPurchaseInvoice ID
 * @returns Promise with delete confirmation
 */
export async function deleteTPurchaseInvoice(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_invoice/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteTPurchaseInvoice(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_purchase_invoice/bulkDelete",
    ids,
    deleteTPurchaseInvoice,
  );
}

/**
 * Get all t_purchase_invoice data without pagination (for sidebar)
 * @returns Promise with t_purchase_invoice list
 */
export async function getTPurchaseInvoiceListNoPagination(): Promise<TPurchaseInvoiceListResponse> {
  return apiCall<TPurchaseInvoiceListResponse>(
    "/dynamic/t_purchase_invoice?no_pagination=true",
    {
      method: "GET",
    },
  );
}

/**
 * Approve Purchase Invoice - dipakai Super Admin untuk auto-approve saat save
 */
export async function approveTPurchaseInvoice(
  pi_id: string,
  pi_notifikasi_id: string | null,
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
          a.path === "/purchasing/transaksi/t_purchase_invoice" &&
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

  return apiCall(`/fn/t_purchase_invoice/approve`, {
    method: "POST",
    body: JSON.stringify({
      pi_id,
      pi_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}
