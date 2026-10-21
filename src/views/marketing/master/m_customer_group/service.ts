import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface CustomerGroupItem {
  id: string;
  kode?: string;
  nama?: string;
  group: string;
  key1: string;
  code: string;
  value1: string;
  value2: string;
  value3: string;
  value4: string;
  value5: string;
  kredit_limit_total?: number | string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  // Detail items (optional - only if module has details)
  m_customer_group_ds?: any[];
  m_customer_group_ubs?: any[];
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

export interface CustomerGroupListResponse {
  status: string;
  data: CustomerGroupItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_customer_group data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_customer_group list
 */
export async function getCustomerGroupList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
): Promise<CustomerGroupListResponse> {
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

  return apiCall<CustomerGroupListResponse>(
    `/dynamic/m_customer_group?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get CustomerGroup by ID
 * @param id - CustomerGroup ID
 * @returns Promise with m_customer_group detail
 */
export async function getCustomerGroupById(
  id: string,
): Promise<{ status: string; data: CustomerGroupItem }> {
  return apiCall(
    `/dynamic/m_customer_group/${id}?include=m_customer_group_ub>m_unit_bisnis,m_customer_group_ub>m_customer_group_d>m_customer&join=true`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new CustomerGroup
 * @param data - m_customer_group data
 * @returns Promise with created CustomerGroup
 */
export async function createCustomerGroup(
  data: Partial<CustomerGroupItem>,
): Promise<{ status: string; data: CustomerGroupItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_customer_group_ds || data.m_customer_group_ubs);
  const endpoint = hasDetails
    ? "/dynamic/m_customer_group/with-details"
    : "/dynamic/m_customer_group";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update CustomerGroup
 * @param id - CustomerGroup ID
 * @param data - m_customer_group data to update
 * @returns Promise with updated CustomerGroup
 */
export async function updateCustomerGroup(
  id: string,
  data: Partial<CustomerGroupItem>,
): Promise<{ status: string; data: CustomerGroupItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_customer_group_ds || data.m_customer_group_ubs);
  const endpoint = hasDetails
    ? `/dynamic/m_customer_group/with-details/${id}`
    : `/dynamic/m_customer_group/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete CustomerGroup
 * @param id - CustomerGroup ID
 * @returns Promise with delete confirmation
 */
export async function deleteCustomerGroup(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_customer_group/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all m_customer_group data without pagination (for sidebar)
 * @returns Promise with m_customer_group list
 */
export async function getCustomerGroupListNoPagination(): Promise<CustomerGroupListResponse> {
  return apiCall<CustomerGroupListResponse>(
    "/dynamic/m_customer_group?no_pagination=true",
    {
      method: "GET",
    },
  );
}
