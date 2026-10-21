import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PrefixItem {
  id: string
  m_unit_bisnis_id: string | null
  nama_prefx: string
  value: string
  tipe_prefix: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Relations (optional) - API returns 'company' for m_unit_bisnis relation
  company?: {
    id: string
    nama_comp: string
    kode_unit_bisnis: string | null
    provinsi: string
    kota: string
  }

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

export interface PrefixListResponse {
  status: string
  data: PrefixItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_prefix data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_prefix list
 */
export async function getPrefixList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<PrefixListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_unit_bisnis' // Include relasi unit bisnis
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  return apiCall<PrefixListResponse>(`/dynamic/m_prefix?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Prefix by ID
 * @param id - Prefix ID
 * @returns Promise with m_prefix detail
 */
export async function getPrefixById(id: string): Promise<{ status: string; data: PrefixItem }> {
  return apiCall(`/dynamic/m_prefix/${id}?include=m_unit_bisnis`, {
    method: 'GET'
  })
}

/**
 * Create new Prefix
 * @param data - m_prefix data
 * @returns Promise with created Prefix
 */
export async function createPrefix(data: Partial<PrefixItem>): Promise<{ status: string; data: PrefixItem }> {
  return apiCall('/dynamic/m_prefix', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Prefix
 * @param id - Prefix ID
 * @param data - m_prefix data to update
 * @returns Promise with updated Prefix
 */
export async function updatePrefix(id: string, data: Partial<PrefixItem>): Promise<{ status: string; data: PrefixItem }> {
  return apiCall(`/dynamic/m_prefix/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Prefix
 * @param id - Prefix ID
 * @returns Promise with delete confirmation
 */
export async function deletePrefix(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_prefix/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_prefix data without pagination (for sidebar)
 * @returns Promise with m_prefix list
 */
export async function getPrefixListNoPagination(): Promise<PrefixListResponse> {
  return apiCall<PrefixListResponse>('/dynamic/m_prefix?no_pagination=true', {
    method: 'GET'
  })
}

// ============================================================================
// FORMAT NOMOR INTERFACES
// ============================================================================

export interface FormatNomorDetail {
  id?: string
  m_format_nomor_id?: string
  m_prefix_id: string | null
  prefix_value: string
  index?: number | null
  createdAt?: string
  updatedAt?: string
  isCompanyPrefix?: boolean // Flag for auto-generated company prefix
  // Relations
  m_prefix?: {
    id: string
    nama_prefx: string
    value: string
    tipe_prefix: string
  }
}

export interface FormatNomorItem {
  id: string
  m_unit_bisnis_id: string
  m_menu_id: string
  pertinjau: string
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Relations - API returns these with specific keys
  // Note: Backend has typo 'm_unit_bisni' instead of 'm_unit_bisnis'
  m_unit_bisni?: {
    id: string
    nama_comp: string
    kode_unit_bisnis: string | null
  }
  m_unit_bisnis?: {
    id: string
    nama_comp: string
    kode_unit_bisnis: string | null
  }
  company?: {
    id: string
    nama_comp: string
    kode_unit_bisnis: string | null
  }
  m_menu?: {
    id: string
    name: string
    label: string
  }
  menu?: {
    id: string
    name: string
    label: string
  }
  m_format_nomor_d?: FormatNomorDetail[]
  m_format_nomor_ds?: FormatNomorDetail[]
}

export interface FormatNomorListResponse {
  status: string
  data: FormatNomorItem[]
  pagination: Pagination
}

// ============================================================================
// FORMAT NOMOR API FUNCTIONS
// ============================================================================

/**
 * Get all format nomor data
 */
export async function getFormatNomorList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  where?: string,
  columnFilters?: Record<string, string>
): Promise<FormatNomorListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_unit_bisnis,m_menu'
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  if (where) {
    queryParams.append('where', where)
  }
  
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(`filter_column_${key}`, value)
      }
    })
  }
  
  return apiCall<FormatNomorListResponse>(`/dynamic/m_format_nomor?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Format Nomor by ID
 */
export async function getFormatNomorById(id: string): Promise<{ status: string; data: FormatNomorItem }> {
  return apiCall(`/dynamic/m_format_nomor/${id}?include=m_format_nomor_d>m_prefix,m_menu,m_unit_bisnis`, {
    method: 'GET'
  })
}

/**
 * Create format nomor with details
 */
export async function createFormatNomor(data: Partial<FormatNomorItem>): Promise<{ status: string; message: string; data: FormatNomorItem }> {
  return apiCall('/dynamic/m_format_nomor/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update format nomor with details
 */
export async function updateFormatNomor(id: string, data: Partial<FormatNomorItem>): Promise<{ status: string; message: string; data: FormatNomorItem }> {
  return apiCall(`/dynamic/m_format_nomor/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete format nomor
 */
export async function deleteFormatNomor(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_format_nomor/${id}`, {
    method: 'DELETE'
  })
}
