import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TPurchaseRequestItem {
  id?: string;
  updated_by?: string;
  created_by: string;
  m_unit_bisnis_id?: string;
  tgl_pr?: string;
  tgl_butuh: string;
  no_pr?: string;
  divisi?: string;
  catatan?: string;
  req_type_user: string;
  req_user_by: string;

  is_rfq?: boolean;
  status?: string;
  status_transaksi?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Detail items
  t_purchase_request_ds?: TPurchaseRequestDetail[];

  // Legacy/Optional fields to prevent breakages if still used in UI temporarily
  ref_so_id?: string;
  prioritas_id?: string;
}

export interface TPurchaseRequestDetail {
  id?: string;
  updated_by?: string;
  created_by: string;
  t_purchase_request_id?: string;
  m_items_id?: string;
  qty_pr?: number;
  qty_free_stok?: number; // added free stock quantity per item
  uom_id?: string;
  catatan?: string;
  // Relasi untuk display
  m_item?: any;
  uom?: any;

  // Legacy
  alasan?: string;
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

export interface TPurchaseRequestListResponse {
  status: string;
  data: TPurchaseRequestItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_request data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param filterCreatedBy - Filter by created_by user ID (optional)
 * @param filters - Column filters for API-based filtering (optional)
 * @param filterOperators - Filter operators for columns (optional, e.g., ~*, =, etc.)
 * @param where - WHERE clause for complex filtering (optional, e.g., "tgl_pr>=2025-01-01|tgl_pr<2025-02-01")
 * @returns Promise with t_purchase_request list
 */
export async function getTPurchaseRequestList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string,
): Promise<TPurchaseRequestListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: "m_unit_bisnis:id|nama_comp",
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

  // Add column filters (e.g., filter_column_no_pr=CBM-TBBSP-2511-0001)
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
      }
    });
  }

  // Add filter operators (e.g., filter_operator_no_pr=~*)
  if (filterOperators) {
    Object.entries(filterOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value);
      }
    });
  }

  // Add where clause for date range filters
  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<TPurchaseRequestListResponse>(
    `/dynamic/t_purchase_request?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPurchaseRequest by ID
 * @param id - TPurchaseRequest ID
 * @returns Promise with t_purchase_request detail
 */
export async function getTPurchaseRequestById(
  id: string,
): Promise<{ status: string; data: TPurchaseRequestItem }> {
  const includes = [
    "user_default",
    "t_purchase_request_d>m_items>m_general",
    "t_purchase_request_d>m_items>m_items_image",
    "t_purchase_request_d>m_items>stock_gudang",
    "t_purchase_request_d>m_items>m_items_gudang",
    "m_unit_bisnis:id|nama_comp",
    "m_gudang:id|nama_gudang"
  ].join(",");

  return apiCall(
    `/dynamic/t_purchase_request/${id}?include=${encodeURIComponent(includes)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TPurchaseRequest
 * @param data - t_purchase_request data
 * @returns Promise with created TPurchaseRequest
 */
export async function createTPurchaseRequest(
  data: Partial<TPurchaseRequestItem>,
): Promise<{ status: string; data: TPurchaseRequestItem }> {
  // Check if data has detail items
  const hasDetails = !!data.t_purchase_request_ds;
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_request/with-details"
    : "/dynamic/t_purchase_request";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TPurchaseRequest
 * @param id - TPurchaseRequest ID
 * @param data - t_purchase_request data to update
 * @returns Promise with updated TPurchaseRequest
 */
export async function updateTPurchaseRequest(
  id: string,
  data: Partial<TPurchaseRequestItem>,
): Promise<{ status: string; data: TPurchaseRequestItem }> {
  // Check if data has detail items
  const hasDetails = !!data.t_purchase_request_ds;
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_request/with-details/${id}`
    : `/dynamic/t_purchase_request/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete TPurchaseRequest
 * @param id - TPurchaseRequest ID
 * @returns Promise with delete confirmation
 */
export async function deleteTPurchaseRequest(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_request/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Bulk delete TPurchaseRequest
 * @param ids - TPurchaseRequest IDs
 * @returns Promise with delete confirmation
 */
export async function bulkDeleteTPurchaseRequest(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_purchase_request/bulkDelete",
    ids,
    deleteTPurchaseRequest,
  );
}

/**
 * Get all t_purchase_request data without pagination (for sidebar)
 * @returns Promise with t_purchase_request list
 */
export async function getTPurchaseRequestListNoPagination(): Promise<TPurchaseRequestListResponse> {
  return apiCall<TPurchaseRequestListResponse>(
    "/dynamic/t_purchase_request?no_pagination=true",
    {
      method: "GET",
    },
  );
}
