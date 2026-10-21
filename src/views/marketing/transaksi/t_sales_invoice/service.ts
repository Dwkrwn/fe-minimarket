import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SalesInvoiceItem {
  id: string
  group: string
  key1: string
  code: string
  value1: string
  value2: string
  value3: string
  value4: string
  value5: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  field_name?: string
  field_code?: string
  field1?: string
  nested?: { value1?: string }
  // Detail items (optional - only if module has details)
  t_sales_invoice_details?: any[]
  t_sales_invoice_details2?: any[]
}

export interface Pagination {
  total: number
  page: number
  totalPages: number
  limit: number
  currentRowsCount: number
  next_page: number | null
  prev_page: number | null
}

export interface SalesInvoiceListResponse {
  status: string
  data: SalesInvoiceItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sales_invoice data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_sales_invoice list
 */
export async function getSalesInvoiceList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<SalesInvoiceListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  return apiCall<SalesInvoiceListResponse>(`/dynamic/t_sales_invoice?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SalesInvoice by ID
 * @param id - SalesInvoice ID
 * @returns Promise with t_sales_invoice detail
 */
export async function getSalesInvoiceById(id: string): Promise<{ status: string; data: SalesInvoiceItem }> {
  return apiCall(`/dynamic/t_sales_invoice/${id}`, {
    method: 'GET'
  })
}

/**
 * Create new SalesInvoice
 * @param data - t_sales_invoice data
 * @returns Promise with created SalesInvoice
 */
export async function createSalesInvoice(data: Partial<SalesInvoiceItem>): Promise<{ status: string; data: SalesInvoiceItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_invoice_details || data.t_sales_invoice_details2)
  const endpoint = hasDetails ? '/dynamic/t_sales_invoice/with-details' : '/dynamic/t_sales_invoice'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SalesInvoice
 * @param id - SalesInvoice ID
 * @param data - t_sales_invoice data to update
 * @returns Promise with updated SalesInvoice
 */
export async function updateSalesInvoice(id: string, data: Partial<SalesInvoiceItem>): Promise<{ status: string; data: SalesInvoiceItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_sales_invoice_details || data.t_sales_invoice_details2)
  const endpoint = hasDetails ? `/dynamic/t_sales_invoice/with-details/${id}` : `/dynamic/t_sales_invoice/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete SalesInvoice
 * @param id - SalesInvoice ID
 * @returns Promise with delete confirmation
 */
export async function deleteSalesInvoice(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_sales_invoice/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_sales_invoice data without pagination (for sidebar)
 * @returns Promise with t_sales_invoice list
 */
export async function getSalesInvoiceListNoPagination(): Promise<SalesInvoiceListResponse> {
  return apiCall<SalesInvoiceListResponse>('/dynamic/t_sales_invoice?no_pagination=true', {
    method: 'GET'
  })
}
