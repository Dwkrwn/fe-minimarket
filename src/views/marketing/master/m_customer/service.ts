import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface CustomerItem {
  id: string;
  m_unit_bisnis_id: string | null;
  kode_customer: string | null;
  nama_customer: string | null;
  is_tax: boolean;
  // coa_id: string | null // ABAIKAN DULU - belum ada accounting
  toleransi: number;
  no_ktp: string | null;
  alamat: string | null;
  provinsi: string | null;
  kota: string | null;
  kecamatan: string | null;
  kode_pos: string | null;
  email: string | null;
  website: string | null;
  no_telp_office: string | null;
  fax: string | null;
  cp_1: string | null;
  no_cp_1: string | null;
  email_cp_1: string | null;
  cp_2: string | null;
  no_cp_2: string | null;
  email_cp_2: string | null;
  lat: string | null;
  long: string | null;
  catatan: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  status: string;
  // Detail items (optional - only if module has details)
  m_customer_d_npwps?: any[];
  m_customer_d_alamats?: any[];
  m_customer_d_rekenings?: any[];
  m_customer_d_kontaks?: any[];
  m_customer_d_ekspedisis?: any[];
  // Relations
  m_unit_bisnis?: any;
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

export interface CustomerListResponse {
  status: string;
  data: CustomerItem[];
  pagination: Pagination;
}

export interface CustomerChangeValue {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface CustomerChangeLogPayload {
  customer_id?: string;
  customer_ub_id?: string;
  change_values?: CustomerChangeValue[];
  created_by?: string;
  status?: string;
  m_customer_change_notifikasis?: {
    status?: boolean;
    user_approved_id?: string;
    m_customer_log_id?: string;
    sender_id?: string;
    approval_level?: number;
    title?: string;
    approval_message?: string;
    approval_catatan?: string;
    status_name?: string;
  }[];
}

export interface CustomerChangeNotificationPayload {
  status?: boolean;
  user_approved_id?: string;
  m_customer_log_id?: string;
  sender_id?: string;
  approval_level?: number;
  title?: string;
  approval_message?: string;
  approval_catatan?: string;
  status_name?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_customer data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_customer list
 */
export async function getCustomerList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  respoUnitBisnisId?: string,
): Promise<CustomerListResponse> {
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

  if (respoUnitBisnisId) {
    queryParams.append("include", "m_customer_unit_bisnis");
    queryParams.append(
      "filter_column_m_customer_unit_bisnis.unit_bisnis_id",
      respoUnitBisnisId,
    );
  }

  return apiCall<CustomerListResponse>(`/dynamic/m_customer?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get Customer by ID with relations
 * @param id - Customer ID
 * @returns Promise with m_customer detail including relations
 */
export async function getCustomerById(
  id: string,
): Promise<{ status: string; data: CustomerItem }> {
  const includeParams = [
    "m_unit_bisnis",
    "m_customer_d_npwp>m_general:id|value1",
    "m_customer_d_alamat",
    "m_customer_d_rekening",
    "m_customer_d_kontak",
    "m_customer_unit_bisnis>m_unit_bisnis",
    "m_customer_image",
    "m_customer_d_ekspedisi>m_ekspedisi:id|nama",
  ].join(",");

  return apiCall(`/dynamic/m_customer/${id}?include=${includeParams}&join=true`, {
    method: "GET",
  });
}

/**
 * Create new Customer
 * @param data - m_customer data
 * @returns Promise with created Customer
 */
export async function createCustomer(
  data: Partial<CustomerItem>,
): Promise<{ status: string; data: CustomerItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.m_customer_d_npwps ||
    data.m_customer_d_alamats ||
    data.m_customer_d_rekenings ||
    data.m_customer_d_kontaks ||
    data.m_customer_d_ekspedisis
  );
  const endpoint = hasDetails
    ? "/dynamic/m_customer/with-details"
    : "/dynamic/m_customer";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update Customer
 * @param id - Customer ID
 * @param data - m_customer data to update
 * @returns Promise with updated Customer
 */
export async function updateCustomer(
  id: string,
  data: Partial<CustomerItem>,
): Promise<{ status: string; data: CustomerItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.m_customer_d_npwps ||
    data.m_customer_d_alamats ||
    data.m_customer_d_rekenings ||
    data.m_customer_d_kontaks ||
    data.m_customer_d_ekspedisis
  );
  const endpoint = hasDetails
    ? `/dynamic/m_customer/with-details/${id}`
    : `/dynamic/m_customer/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createCustomerChangeLog(
  data: CustomerChangeLogPayload,
): Promise<{ status: string; data: any }> {
  return apiCall("/dynamic/m_customer_change_log", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createCustomerChangeNotification(
  data: CustomerChangeNotificationPayload,
): Promise<{ status: string; data: any }> {
  return apiCall("/dynamic/m_customer_change_notifikasi", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Delete Customer
 * @param id - Customer ID
 * @returns Promise with delete confirmation
 */
export async function deleteCustomer(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_customer/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all m_customer data without pagination (for sidebar)
 * @returns Promise with m_customer list
 */
export async function getCustomerListNoPagination(): Promise<CustomerListResponse> {
  return apiCall<CustomerListResponse>(
    "/dynamic/m_customer?no_pagination=true",
    {
      method: "GET",
    },
  );
}
