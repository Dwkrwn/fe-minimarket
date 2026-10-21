import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TransformItem {
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
  transform_no?: string;
  note?: string;
  tipe?: string;
  tipe_id?: string;
  m_item_id?: string;
  m_item?: {
    id: string;
    kode_item?: string;
    nama_item?: string;
    nama?: string;
  };
  m_general?: {
    id: string;
    code?: string;
    value1?: string;
  };
  // Detail items (optional - only if module has details)
  m_transform_d?: any[];
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

export interface TransformListResponse {
  status: string;
  data: TransformItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_transform data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_transform list
 */
export async function getTransformList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>
): Promise<TransformListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    include: "m_items,m_general",
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
        queryParams.append(key, value);
      }
    });
  }

  return apiCall<TransformListResponse>(`/dynamic/m_transform?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get Transform by ID
 * @param id - Transform ID
 * @returns Promise with m_transform detail
 */
export async function getTransformById(
  id: string,
): Promise<{ status: string; data: TransformItem }> {
  return apiCall(`/dynamic/m_transform/${id}?include=m_transform_d>m_items,m_general,m_items`, {
    method: "GET",
  });
}

/**
 * Create new Transform
 * @param data - m_transform data
 * @returns Promise with created Transform
 */
export async function createTransform(
  data: Partial<TransformItem>,
): Promise<{ status: string; data: TransformItem }> {
  // Check if data has detail items
  const hasDetails = !!data.m_transform_d;
  const endpoint = hasDetails
    ? "/dynamic/m_transform/with-details"
    : "/dynamic/m_transform";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update Transform
 * @param id - Transform ID
 * @param data - m_transform data to update
 * @returns Promise with updated Transform
 */
export async function updateTransform(
  id: string,
  data: Partial<TransformItem>,
): Promise<{ status: string; data: TransformItem }> {
  // Check if data has detail items
  const hasDetails = !!data.m_transform_d;
  const endpoint = hasDetails
    ? `/dynamic/m_transform/with-details/${id}`
    : `/dynamic/m_transform/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete Transform
 * @param id - Transform ID
 * @returns Promise with delete confirmation
 */
export async function deleteTransform(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_transform/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all m_transform data without pagination (for sidebar)
 * @returns Promise with m_transform list
 */
export async function getTransformListNoPagination(): Promise<TransformListResponse> {
  return apiCall<TransformListResponse>(
    "/dynamic/m_transform?no_pagination=true",
    {
      method: "GET",
    },
  );
}
