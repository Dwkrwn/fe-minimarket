import { apiCall, bulkDeleteWithFallback } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SupplierQuotationDetail {
  id?: string
  t_supplier_quotation_id?: string
  uom_id: string
  start_date?: string
  end_date?: string
  min_qty: number
  price: number
  catatan?: string
  // Helper fields for UI
  no_rfq?: string
  kode_item?: string
  nama_item?: string
  uom_name?: string
  rfq_items_d_id?: string // Linked to t_rfq_items_d.id
}

export interface SupplierQuotationItem {
  id?: string
  tgl_quotation?: string
  m_unit_bisnis_id?: string
  t_rfq_id?: string
  m_currency_id?: string
  ppn_type?: string
  m_supplier_id?: string
  ppn?: number
  no_supplier_quotation?: string
  lampiran?: string
  catatan?: string
  t_supplier_quotation_ds: SupplierQuotationDetail[]
  // Helper fields
  created_by?: string | null
  update_by?: string | null
  updated_by?: string | null
  createdAt?: string
  updatedAt?: string
  m_unit_bisnis?: any
  t_rfq?: any
  m_currency?: any
  m_supplier?: any
  status?: string
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

export interface SupplierQuotationListResponse {
  status: string
  data: SupplierQuotationItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_supplier_quotation data
 */
export async function getSupplierQuotationList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  params?: Record<string, any>
): Promise<SupplierQuotationListResponse> {
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

  if (params) {
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        queryParams.append(key, params[key])
      }
    })
  }

  return apiCall<SupplierQuotationListResponse>(`/dynamic/t_supplier_quotation?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get SupplierQuotation by ID
 */
export async function getSupplierQuotationById(id: string): Promise<{ status: string; data: SupplierQuotationItem }> {
  // Include details and relations
  const includes = [
    't_supplier_quotation_d',
    't_supplier_quotation_d>t_rfq_items_d>m_items',
    't_supplier_quotation_d>t_rfq_items_d>m_general',
    'm_unit_bisnis',
    't_rfq',
    'm_currency',
    'm_supplier'
  ].join(',')
  return apiCall(`/dynamic/t_supplier_quotation/${id}?include=${includes}`, {
    method: 'GET'
  })
}

/**
 * Create new SupplierQuotation
 */
export async function createSupplierQuotation(data: Partial<SupplierQuotationItem>): Promise<{ status: string; data: SupplierQuotationItem }> {
  const hasDetails = !!(data.t_supplier_quotation_ds && data.t_supplier_quotation_ds.length > 0)
  const endpoint = hasDetails ? '/dynamic/t_supplier_quotation/with-details' : '/dynamic/t_supplier_quotation'

  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update SupplierQuotation
 */
export async function updateSupplierQuotation(id: string, data: Partial<SupplierQuotationItem>): Promise<{ status: string; data: SupplierQuotationItem }> {
  const hasDetails = !!(data.t_supplier_quotation_ds && data.t_supplier_quotation_ds.length > 0)
  const endpoint = hasDetails ? `/dynamic/t_supplier_quotation/with-details/${id}` : `/dynamic/t_supplier_quotation/${id}`

  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Post SupplierQuotation - Change status to POST
 */
export async function postSupplierQuotation(id: string): Promise<{ status: string; message?: string; data?: any }> {
  return apiCall(`/fn/t_supplier_quotation/postSupplierQuotation`, {
    method: 'POST',
    body: JSON.stringify({ supplier_quotation_id: id })
  })
}

/**
 * Delete SupplierQuotation
 */
export async function deleteSupplierQuotation(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_supplier_quotation/with-details/${id}`, {
    method: 'DELETE'
  })
}

export async function bulkDeleteSupplierQuotation(ids: string[]): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    '/dynamic/t_supplier_quotation/bulkDelete',
    ids,
    deleteSupplierQuotation,
  )
}


/**
 * Validate Excel before import for Supplier Quotation
 */
export async function validateImportExcel(file: File, supplierId: string): Promise<{ 
  status?: string;
  success?: boolean;
  code?: number;
  data?: any; 
  message?: string;
  hasDuplicates?: boolean;
  duplicateItems?: any[];
  errors?: any;
}> {
  const formData = new FormData()
  formData.append('excelData', file)
  formData.append('supplier_id', supplierId)

  // Direct fetch to handle 400 responses properly
  const authData = localStorage.getItem('auth_bb')
  let authToken = ''
  if (authData) {
    try {
      const parsed = JSON.parse(authData)
      authToken = parsed.token
    } catch (e) {
      // Invalid JSON
    }
  }

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/fn/t_supplier_quotation/validateImportExcel`, {
    method: 'POST',
    headers: {
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
    body: formData
  })

  const data = await response.json().catch(() => ({}))
  
  // Return data as-is, preserving all fields including code
  return data
}

/**
 * Import Excel for Supplier Quotation
 */
export async function importExcel(file: File, supplierId: string): Promise<{ status: string; data: { t_supplier_quotation_id: string; id?: string;[key: string]: any }; message?: string }> {
  const formData = new FormData()
  formData.append('excelData', file)
  formData.append('supplier_id', supplierId)

  return apiCall('/fn/t_supplier_quotation/importExcel', {
    method: 'POST',
    body: formData
  })
}
