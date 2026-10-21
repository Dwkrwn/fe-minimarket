import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface PurchaseRequestSubconItem {
  id: string;
  group: string;
  key1: string;
  code: string;
  value1: string;
  value2: string;
  value3: string;
  value4: string;
  value5: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  status: string;
  catatan?: string;
  created_by?: string;
  updated_by?: string;
  tgl_butuh?: string;
  tgl_pr_subcon?: string;
  tgl_t_purchase_request_subcon?: string;
  no_pr_subcon?: string;
  status_transaksi?: string;
  jenis_pr_subcon?: string | null | {
    id: string;
    value1: string;
  };
  // Detail items (optional - only if module has details)
  t_purchase_request_subcon_bahan?: any[];
  t_purchase_request_subcon_jadi?: any[];
  t_purchase_request_subcon_jasa?: any[];
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

export interface PurchaseRequestSubconListResponse {
  status: string;
  data: PurchaseRequestSubconItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_request_subcon data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_purchase_request_subcon list
 */
export async function getPurchaseRequestSubconList(
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
): Promise<PurchaseRequestSubconListResponse> {
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

  return apiCall<PurchaseRequestSubconListResponse>(
    `/dynamic/t_purchase_request_subcon?${queryParams}&include=m_unit_bisnis,m_unit_bisnis>m_company`,
    {
      method: "GET",
    },
  );
}

/**
 * Get PurchaseRequestSubcon by ID
 * @param id - PurchaseRequestSubcon ID
 * @returns Promise with t_purchase_request_subcon detail
 */
export async function getPurchaseRequestSubconById(
  id: string,
): Promise<{ status: string; data: PurchaseRequestSubconItem }> {
  return apiCall(
    `/dynamic/t_purchase_request_subcon/${id}?include=t_purchase_request_subcon_bahan>m_items,t_purchase_request_subcon_bahan>m_general,t_purchase_request_subcon_bahan>stock_gudang>m_rak_d>m_rak,t_purchase_request_subcon_jadi>m_items,t_purchase_request_subcon_jadi>m_general,t_purchase_request_subcon_jasa>m_items,t_purchase_request_subcon_jasa>m_general,m_unit_bisnis,m_unit_bisnis>m_company,m_gudang,m_general`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new PurchaseRequestSubcon
 * @param data - t_purchase_request_subcon data
 * @returns Promise with created PurchaseRequestSubcon
 */
export async function createPurchaseRequestSubcon(
  data: Partial<PurchaseRequestSubconItem>,
): Promise<{ status: string; data: PurchaseRequestSubconItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_request_subcon_bahan ||
    data.t_purchase_request_subcon_jadi ||
    data.t_purchase_request_subcon_jasa
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_request_subcon/with-details"
    : "/dynamic/t_purchase_request_subcon";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update PurchaseRequestSubcon
 * @param id - PurchaseRequestSubcon ID
 * @param data - t_purchase_request_subcon data to update
 * @returns Promise with updated PurchaseRequestSubcon
 */
export async function updatePurchaseRequestSubcon(
  id: string,
  data: Partial<PurchaseRequestSubconItem>,
): Promise<{ status: string; data: PurchaseRequestSubconItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_purchase_request_subcon_bahan ||
    data.t_purchase_request_subcon_jadi ||
    data.t_purchase_request_subcon_jasa
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_request_subcon/with-details/${id}`
    : `/dynamic/t_purchase_request_subcon/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete PurchaseRequestSubcon
 * @param id - PurchaseRequestSubcon ID
 * @returns Promise with delete confirmation
 */
export async function deletePurchaseRequestSubcon(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_request_subcon/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all t_purchase_request_subcon data without pagination (for sidebar)
 * @returns Promise with t_purchase_request_subcon list
 */
export async function getPurchaseRequestSubconListNoPagination(): Promise<PurchaseRequestSubconListResponse> {
  return apiCall<PurchaseRequestSubconListResponse>(
    "/dynamic/t_purchase_request_subcon?no_pagination=true",
    {
      method: "GET",
    },
  );
}
