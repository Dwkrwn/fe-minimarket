import { apiCall, API_BASE_URL, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface RfqSupplierDetail {
  id?: string; // optional
  supplier_id: string; // required
  rfq_id?: string; // optional
  catatan?: string; // optional
}

export interface RfqItemDetail {
  id?: string; // optional
  rfq_id?: string; // optional
  purchase_request_id: string; // required
  purchase_request_d_id?: string; // optional
  item_id: string; // required
  qty?: number; // optional
  uom_id: string; // required
  catatan?: string; // optional
}

export interface RfqItem {
  id?: string;
  tgl_mulai?: string; // timestamp with time zone - optional
  tgl_akhir?: string; // timestamp with time zone - optional
  currency_id: string; // uuid - required
  m_unit_bisnis_id: string; // uuid - required
  createdBy?: string; // uuid - optional
  status?: string; // character varying - optional
  catatan?: string; // text - optional
  no_rfq?: string; // character varying - optional
  t_rfq_items_ds: RfqItemDetail[];
  t_rfq_supplier_ds: RfqSupplierDetail[];
  t_rfq_supplier_d: RfqSupplierDetail[];
  t_rfq_items_d: RfqItemDetail[];
  createdAt?: string;
  updatedAt?: string;
  m_unit_bisnis?: any;
  m_currency?: any;
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

export interface RfqListResponse {
  status: string;
  data: RfqItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_rfq data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_rfq list
 */
export async function getRfqList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  include?: string,
  filter_column?: Record<string, string | number | boolean>,
  where?: string,
): Promise<RfqListResponse> {
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

  if (include) {
    queryParams.append("include", include);
  }
  if (filter_column) {
    Object.entries(filter_column).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<RfqListResponse>(`/dynamic/t_rfq?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get Rfq by ID
 * @param id - Rfq ID
 * @returns Promise with t_rfq detail
 */
export async function getRfqById(
  id: string,
): Promise<{ status: string; data: RfqItem }> {
  const includes = [
    "t_rfq_supplier_d>m_supplier",
    "t_rfq_items_d>m_items",
    "t_rfq_items_d>m_general",
    "t_rfq_items_d>t_purchase_request",
    "t_rfq_items_d>t_supplier_quotation_d>t_supplier_quotation",
    "m_unit_bisnis",
    "m_currency",
  ].join(",");

  return apiCall(`/dynamic/t_rfq/${id}?include=${includes}`, {
    method: "GET",
  });
}

/**
 * Create new Rfq
 * @param data - t_rfq data
 * @returns Promise with created Rfq
 */
export async function createRfq(
  data: Partial<RfqItem>,
): Promise<{ status: string; data: RfqItem }> {
  // Check if data has detail items
  const hasDetails =
    (data.t_rfq_items_ds && data.t_rfq_items_ds.length > 0) ||
    (data.t_rfq_supplier_ds && data.t_rfq_supplier_ds.length > 0);
  const endpoint = hasDetails
    ? "/dynamic/t_rfq/with-details"
    : "/dynamic/t_rfq";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update Rfq
 * @param id - Rfq ID
 * @param data - t_rfq data to update
 * @returns Promise with updated Rfq
 */
export async function updateRfq(
  id: string,
  data: Partial<RfqItem>,
): Promise<{ status: string; data: RfqItem }> {
  // Check if data has detail items
  const hasDetails =
    (data.t_rfq_items_ds && data.t_rfq_items_ds.length > 0) ||
    (data.t_rfq_supplier_ds && data.t_rfq_supplier_ds.length > 0);
  const endpoint = hasDetails
    ? `/dynamic/t_rfq/with-details/${id}`
    : `/dynamic/t_rfq/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete Rfq
 * @param id - Rfq ID
 * @returns Promise with delete confirmation
 */
export async function deleteRfq(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall<{ status: string; message: string }>(
    `/dynamic/t_rfq/with-details/${id}`,
    {
      method: "DELETE",
    },
  );
}

export async function bulkDeleteRfq(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_rfq/bulkDelete",
    ids,
    deleteRfq,
  );
}

/**
 *Get list rfq yang belum di tarik di sq identifier rfq_id & supplier_id
 */
export async function getRfqListForSupplierQuotation(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filter_column?: Record<string, string | number | boolean>,
): Promise<RfqListResponse> {
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

  if (filter_column) {
    Object.entries(filter_column).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  return apiCall<RfqListResponse>(`/fn/t_rfq/getrfqCanSQ?${queryParams}`, {
    method: "GET",
  });
}
/**
 * Get all t_rfq data without pagination (for sidebar)
 * @returns Promise with t_rfq list
 */
export async function getRfqListNoPagination(): Promise<RfqListResponse> {
  return apiCall<RfqListResponse>("/dynamic/t_rfq?no_pagination=true", {
    method: "GET",
  });
}

/**
 * Export Rfq to Excel
 * @param search - Search term (e.g. RFQ-260210-0001)
 * @returns Promise with blob data
 */
export async function exportRfq(
  search: string,
): Promise<{ blob: Blob; filename: string }> {
  const authData = localStorage.getItem("auth_bb");
  const token = authData ? JSON.parse(authData).token : "";

  const response = await fetch(
    `${API_BASE_URL}/fn/t_rfq/exportExcel?search=${search}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Gagal mengunduh file export");
  }

  // Extract filename from Content-Disposition header
  const disposition = response.headers.get("Content-Disposition");
  let filename = "";

  if (disposition) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, "");
    }
  }

  return { blob: await response.blob(), filename };
}
