import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface RakDetail {
  id?: string;
  kode: string;
  baris: number;
  kolom: number;
  m_rak_id?: string;
}

export interface RakItem {
  id?: string;
  kode_rak?: string;
  nama_rak: string;
  m_unit_bisnis_id?: string;
  m_gudang_id?: string;
  jumlah_baris?: number;
  jumlah_kolom?: number;
  catatan?: string;
  is_active?: boolean;
  is_rak_opname?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Relations
  m_unit_bisni?: {
    id: string;
    kode_unit_bisnis?: string;
    nama_comp?: string;
  };
  m_gudang?: {
    id: string;
    kode_gudang?: string;
    nama_gudang?: string;
  };
  // Details
  m_rak_d?: RakDetail[];
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

export interface RakListResponse {
  status: string;
  data: RakItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_rak data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_rak list
 */
export async function getRakList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  companyId?: string,
  filters?: Record<string, string>
): Promise<RakListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include:
      "m_unit_bisnis:id|kode_unit_bisnis|nama_comp,m_gudang:id|kode_gudang|nama_gudang",
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
        queryParams.append(key, value);
      }
    });
  }

  // Filter by company if provided (for non-super admin)
  if (companyId) {
    queryParams.append("filter_column_m_unit_bisnis_id", companyId);
  }

  return apiCall<RakListResponse>(`/dynamic/m_rak?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get Rak by ID
 * @param id - Rak ID
 * @returns Promise with m_rak detail
 */
export async function getRakById(
  id: string,
): Promise<{ status: string; data: RakItem }> {
  return apiCall(
    `/dynamic/m_rak/${id}?include=m_unit_bisnis:id|kode_unit_bisnis|nama_comp,m_gudang:id|kode_gudang|nama_gudang,m_rak_d`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new Rak
 * @param data - m_rak data
 * @returns Promise with created Rak
 */
export async function createRak(
  data: Partial<RakItem>,
): Promise<{ status: string; data: RakItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_rak_d && data.m_rak_d.length > 0);
  const endpoint = hasDetails
    ? "/dynamic/m_rak/with-details"
    : "/dynamic/m_rak";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update Rak
 * @param id - Rak ID
 * @param data - m_rak data to update
 * @returns Promise with updated Rak
 */
export async function updateRak(
  id: string,
  data: Partial<RakItem>,
): Promise<{ status: string; data: RakItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_rak_d && data.m_rak_d.length > 0);
  const endpoint = hasDetails
    ? `/dynamic/m_rak/with-details/${id}`
    : `/dynamic/m_rak/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete Rak
 * @param id - Rak ID
 * @returns Promise with delete confirmation
 */
export async function deleteRak(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_rak/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all m_rak data without pagination (for dropdowns)
 * @returns Promise with m_rak list
 */
// Only one getRakListNoPagination function should exist
export async function getRakListNoPagination(
  companyId?: string,
): Promise<RakListResponse> {
  const queryParams = new URLSearchParams({
    no_pagination: "true",
    include:
      "m_unit_bisnis:id|kode_unit_bisnis|nama_comp,m_gudang:id|kode_gudang|nama_gudang",
  });
  if (companyId) {
    queryParams.append("filter_column_m_unit_bisnis_id", companyId);
  }
  return apiCall<RakListResponse>(`/dynamic/m_rak?${queryParams}`, {
    method: "GET",
  });
}
