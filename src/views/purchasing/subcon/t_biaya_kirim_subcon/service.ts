import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface BiayaKirimSubconItem {
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
  no_biaya_kirim_subcon: string;
  status: string;
  tgl_biaya_kirim_subcon: string;
  catatan: string;
  // Detail items (optional - only if module has details)
  t_biaya_kirim_subcon_ds?: any[];
  t_biaya_kirim_subcon_details2?: any[];
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

export interface BiayaKirimSubconListResponse {
  status: string;
  data: BiayaKirimSubconItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_biaya_kirim_subcon data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_biaya_kirim_subcon list
 */
export async function getBiayaKirimSubconList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  where?: string,
): Promise<BiayaKirimSubconListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: "m_ekspedisi,m_unit_bisnis",
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<BiayaKirimSubconListResponse>(
    `/dynamic/t_biaya_kirim_subcon?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get BiayaKirimSubcon by ID
 * @param id - BiayaKirimSubcon ID
 * @returns Promise with t_biaya_kirim_subcon detail
 */
export async function getBiayaKirimSubconById(
  id: string,
): Promise<{ status: string; data: BiayaKirimSubconItem }> {
  const include = [
    "m_ekspedisi",
    "m_unit_bisnis",
    "t_biaya_kirim_subcon_d>t_purchase_order_subcon",
    "t_biaya_kirim_subcon_d>m_general",
    "t_biaya_kirim_subcon_d>m_items",
    "m_general",
  ].join(",");

  return apiCall(
    `/dynamic/t_biaya_kirim_subcon/${id}?include=${include}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new BiayaKirimSubcon
 * @param data - t_biaya_kirim_subcon data
 * @returns Promise with created BiayaKirimSubcon
 */
export async function createBiayaKirimSubcon(
  data: Partial<BiayaKirimSubconItem>,
): Promise<{ status: string; data: BiayaKirimSubconItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_biaya_kirim_subcon_ds || data.t_biaya_kirim_subcon_details2
  );
  const endpoint = hasDetails
    ? "/dynamic/t_biaya_kirim_subcon/with-details"
    : "/dynamic/t_biaya_kirim_subcon";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update BiayaKirimSubcon
 * @param id - BiayaKirimSubcon ID
 * @param data - t_biaya_kirim_subcon data to update
 * @returns Promise with updated BiayaKirimSubcon
 */
export async function updateBiayaKirimSubcon(
  id: string,
  data: Partial<BiayaKirimSubconItem>,
): Promise<{ status: string; data: BiayaKirimSubconItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_biaya_kirim_subcon_ds || data.t_biaya_kirim_subcon_details2
  );
  const endpoint = hasDetails
    ? `/dynamic/t_biaya_kirim_subcon/with-details/${id}`
    : `/dynamic/t_biaya_kirim_subcon/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete BiayaKirimSubcon
 * @param id - BiayaKirimSubcon ID
 * @returns Promise with delete confirmation
 */
export async function deleteBiayaKirimSubcon(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_biaya_kirim_subcon/with-details/${id}`, {
    method: "DELETE",
  });
}


/**
 * Post BiayaKirimSubcon
 */
export async function postBiayaKirimSubcon(id: string): Promise<{ status?: string; message?: string; error?: string; reason?: string; data?: any }> {
  return apiCall(`/fn/t_biaya_kirim_subcon/PostData`, {
    method: 'POST',
    body: JSON.stringify({ t_biaya_kirim_subcon_id: id })
  })
}

/**
 * Get all t_biaya_kirim_subcon data without pagination (for sidebar)
 * @returns Promise with t_biaya_kirim_subcon list
 */
export async function getBiayaKirimSubconListNoPagination(): Promise<BiayaKirimSubconListResponse> {
  return apiCall<BiayaKirimSubconListResponse>(
    "/dynamic/t_biaya_kirim_subcon?no_pagination=true",
    {
      method: "GET",
    },
  );
}