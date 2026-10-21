import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface SalesQuotationItem {
  id: string;
  m_unit_bisnis_id?: string;
  no_sales_quotation?: string;
  no_sq?: string;
  tgl_sales_quotation?: string;
  tanggal_sq?: string;
  m_customer_id?: string;
  customer_name?: string;
  company_name?: string;
  top?: string;
  grand_total?: string;
  catatan?: string;
  status: string;
  created_by?: string;
  updated_by?: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  m_unit_bisni?: any;
  m_customer?: any;
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

export interface SalesQuotationListResponse {
  status: string;
  data: SalesQuotationItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sales_quotation data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sales_quotation list
 */
export async function getSalesQuotationList(
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
): Promise<SalesQuotationListResponse> {
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

  if (where) {
    queryParams.append("where", where);
  }

  // Add column filters (e.g., filter_column_no_sales_quotation=SQ-2511-0001)
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
      }
    });
  }

  // Add filter operators (e.g., filter_operator_no_sales_quotation=~*)
  if (filterOperators) {
    Object.entries(filterOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value);
      }
    });
  }

  return apiCall<SalesQuotationListResponse>(
    `/dynamic/t_sales_quotation?${queryParams}&include=m_unit_bisnis,m_unit_bisnis>m_company,m_customer`,
    {
      method: "GET",
    },
  );
}

/**
 * Get SalesQuotation by ID
 * @param id - SalesQuotation ID
 * @returns Promise with t_sales_quotation detail
 */
export async function getSalesQuotationById(
  id: string,
): Promise<{ status: string; data: SalesQuotationItem }> {
  return apiCall(
    `/dynamic/t_sales_quotation/${id}?include=m_unit_bisnis,m_unit_bisnis>m_company,m_customer`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new SalesQuotation
 * @param data - t_sales_quotation data
 * @returns Promise with created SalesQuotation
 */
export async function createSalesQuotation(
  data: Partial<SalesQuotationItem>,
): Promise<{ status: string; data: SalesQuotationItem }> {
  return apiCall("/dynamic/t_sales_quotation", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update SalesQuotation
 * @param id - SalesQuotation ID
 * @param data - t_sales_quotation data to update
 * @returns Promise with updated SalesQuotation
 */
export async function updateSalesQuotation(
  id: string,
  data: Partial<SalesQuotationItem>,
): Promise<{ status: string; data: SalesQuotationItem }> {
  return apiCall(`/dynamic/t_sales_quotation/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete SalesQuotation
 * @param id - SalesQuotation ID
 * @returns Promise with delete confirmation
 */
export async function deleteSalesQuotation(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_sales_quotation/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all t_sales_quotation data without pagination (for sidebar)
 * @returns Promise with t_sales_quotation list
 */
export async function getSalesQuotationListNoPagination(): Promise<SalesQuotationListResponse> {
  return apiCall<SalesQuotationListResponse>(
    "/dynamic/t_sales_quotation?no_pagination=true",
    {
      method: "GET",
    },
  );
}
