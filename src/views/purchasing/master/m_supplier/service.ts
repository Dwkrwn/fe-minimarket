import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface SupplierDRekening {
  id?: string
  m_supplier_id?: string
  bank?: string | null
  nama_rek?: string | null
  swift_code?: string | null
  no_rek?: string | number | null
  is_default?: boolean
}

export interface SupplierDAlamat {
  id?: string
  m_supplier_id?: string
  jenis_almt_id?: string | null
  alamat?: string | null
  provinsi?: string | null
  kota?: string | null
  kecamatan?: string | null
  kodepos?: string | null
  telp?: string | null
  fax?: string | null
  email?: string | null
  nama_pic?: string | null
  catatan?: string | null
}

export interface SupplierItem {
  id: string
  kode_supplier?: string | null
  nama_supp: string
  tipe_supp_id: string
  alamat_supp: string
  negara_supp: string
  provinsi_supp: string
  kota_supp: string
  kecamatan_supp?: string | null
  kodepos?: string | null
  no_telp?: string | null
  no_fax?: string | null
  email?: string | null
  website?: string | null
  npwp_supp?: string | null
  foto_npwp?: string | null
  cp1: string
  no_cp1: string
  cp2?: string | null
  no_cp2?: string | null
  is_tax?: boolean
  is_vendor_group?: boolean
  top_number?: number | null
  top_id?: string | null
  m_currency_id?: string | null
  m_coa_id?: string | null
  catatan?: string | null
  is_active?: boolean
  created_by?: string
  updated_by?: string
  createdAt: string
  updatedAt: string
  // Relations
  tipe_supp?: {
    id: string
    value1: string
  }
  top?: {
    id: string
    value1: string
  }
  m_currency?: {
    id: string
    kode_currency: string
  }
  m_supplier_d_rekenings?: SupplierDRekening[]
  m_supplier_d_alamats?: SupplierDAlamat[]
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

export interface SupplierListResponse {
  status: string
  data: SupplierItem[]
  pagination: Pagination
}

// Interface for column filters
export interface ColumnFilters {
  [key: string]: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_supplier data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param columnFilters - Column filters object for API-based filtering
 * @returns Promise with m_supplier list
 */
export async function getSupplierList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<SupplierListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }

  // Add column filters (filter_column_xxx)
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim())
      }
    })
  }
  
  queryParams.append('include', 'm_general')
  
  return apiCall<SupplierListResponse>(`/dynamic/m_supplier?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Supplier by ID
 * @param id - Supplier ID
 * @returns Promise with m_supplier detail
 */
export async function getSupplierById(id: string): Promise<{ status: string; data: SupplierItem }> {
  const queryParams = new URLSearchParams({
    include: 'm_supplier_d_rekening,m_supplier_d_alamat>m_general,m_general,m_currency,user_default'
  })
  return apiCall(`/dynamic/m_supplier/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Supplier
 * @param data - m_supplier data
 * @returns Promise with created Supplier
 */
export async function createSupplier(data: Partial<SupplierItem>): Promise<{ status: string; data: SupplierItem }> {
  return apiCall('/dynamic/m_supplier/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Supplier
 * @param id - Supplier ID
 * @param data - m_supplier data to update
 * @returns Promise with updated Supplier
 */
export async function updateSupplier(id: string, data: Partial<SupplierItem>): Promise<{ status: string; data: SupplierItem }> {
  return apiCall(`/dynamic/m_supplier/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Supplier
 * @param id - Supplier ID
 * @returns Promise with delete confirmation
 */
export async function deleteSupplier(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_supplier/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_supplier data without pagination (for sidebar)
 * @returns Promise with m_supplier list
 */
export async function getSupplierListNoPagination(): Promise<SupplierListResponse> {
  const queryParams = new URLSearchParams({
    no_pagination: 'true',
    include: 'm_general@tipe_supp:value1|id,m_general@top:value1|id,m_currency@mata_uang:kode_currency|id'
  })
  return apiCall<SupplierListResponse>(`/dynamic/m_supplier?${queryParams}`, {
    method: 'GET'
  })
}
