import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TujuanEkspedisiItem {
  id?: string
  m_ekspedisi_id: string
  nama_provinsi: string
  nama_kota: string
  created_by?: string
  updated_by?: string
  createdAt?: string
  updatedAt?: string
}

export interface EkspedisiItem {
  id: string
  kode_ekspedisi?: string
  nama: string
  tujuan_kirim?: string | null
  alamat?: string | null
  provinsi?: string | null
  kota?: string | null
  kecamatan?: string | null
  telepon?: string | null
  cp_kantor?: string | null
  cp_lapangan?: string | null
  catatan_biaya?: number | null
  catatan_lain?: string | null
  is_active?: boolean
  created_by?: string
  updated_by?: string
  createdAt: string
  updatedAt: string
  m_tujuan_ekspedisis?: TujuanEkspedisiItem[]
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

export interface EkspedisiListResponse {
  status: string
  data: EkspedisiItem[]
  pagination: Pagination
}

export interface EkspedisiUsageItem {
  label: string
  total: number
}

export interface EkspedisiUsageResponse {
  used: boolean
  usages: EkspedisiUsageItem[]
}

// Interface for column filters
export interface ColumnFilters {
  [key: string]: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_ekspedisi data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param columnFilters - Column filters object for API-based filtering
 * @returns Promise with m_ekspedisi list
 */
export async function getEkspedisiList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: Record<string, string>,
  columnFilterOperators?: Record<string, string>,
  where?: string
): Promise<EkspedisiListResponse> {
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

  // Add column filters (filter_column_xxx)
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim())
      }
    })
  }

  if (columnFilterOperators) {
    Object.entries(columnFilterOperators).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_operator_${key}`, value.trim())
      }
    })
  }

  if (where) {
    queryParams.append('where', where)
  }
  
  // Include m_tujuan_ekspedisi relation (model name, not field name)
  queryParams.append('include', 'm_tujuan_ekspedisi')
  
  return apiCall<EkspedisiListResponse>(`/dynamic/m_ekspedisi?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Ekspedisi by ID
 * @param id - Ekspedisi ID
 * @returns Promise with m_ekspedisi detail
 */
export async function getEkspedisiById(id: string): Promise<{ status: string; data: EkspedisiItem }> {
  const queryParams = new URLSearchParams({
    include: 'm_tujuan_ekspedisi'  // Model name, not field name
  })
  return apiCall(`/dynamic/m_ekspedisi/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Ekspedisi with details (tujuan)
 * @param data - m_ekspedisi data with m_tujuan_ekspedisis array
 * @returns Promise with created Ekspedisi
 */
export async function createEkspedisi(data: Partial<EkspedisiItem>): Promise<{ status: string; data: EkspedisiItem }> {
  return apiCall('/dynamic/m_ekspedisi/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Ekspedisi with details (tujuan)
 * @param id - Ekspedisi ID
 * @param data - m_ekspedisi data with m_tujuan_ekspedisis array to update
 * @returns Promise with updated Ekspedisi
 */
export async function updateEkspedisi(id: string, data: Partial<EkspedisiItem>): Promise<{ status: string; data: EkspedisiItem }> {
  return apiCall(`/dynamic/m_ekspedisi/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Ekspedisi (with cascade to tujuan)
 * @param id - Ekspedisi ID
 * @returns Promise with delete confirmation
 */
export async function deleteEkspedisi(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_ekspedisi/with-details/${id}`, {
    method: 'DELETE'
  })
}

const ekspedisiUsageChecks = [
  { endpoint: '/dynamic/t_sj_subcon', filterColumn: 'ekspedisi_id', label: 'Surat Jalan Subcon' },
  { endpoint: '/dynamic/t_biaya_kirim_subcon', filterColumn: 'm_ekspedisi_id', label: 'Biaya Kirim Subcon' },
  { endpoint: '/dynamic/t_purchase_order', filterColumn: 'ekspedisi_id', label: 'Purchase Order' },
  { endpoint: '/dynamic/t_penerimaan_barangs', filterColumn: 'ekspedisi_pb', label: 'Penerimaan Barang' },
  { endpoint: '/dynamic/t_import_cost', filterColumn: 'm_ekspedisi_id', label: 'Import Cost' },
  { endpoint: '/dynamic/t_purchase_order_subcon', filterColumn: 'm_ekspedisi_id', label: 'Purchase Order Subcon' },
  { endpoint: '/dynamic/t_sj_gudang', filterColumn: 'ekspedisi_id', label: 'Surat Jalan Gudang' },
  { endpoint: '/dynamic/m_customer_d_ekspedisi', filterColumn: 'm_ekspedisi_id', label: 'Customer' },
  { endpoint: '/dynamic/m_supplier_d_ekspedisi', filterColumn: 'ekspedisi_id', label: 'Supplier' },
]

const getUsageTotal = (response: any) => {
  const paginationTotal = Number(response?.pagination?.total)
  if (Number.isFinite(paginationTotal)) return paginationTotal

  if (Array.isArray(response?.data)) return response.data.length
  return 0
}

export async function checkEkspedisiUsage(id: string): Promise<EkspedisiUsageResponse> {
  const results = await Promise.allSettled(
    ekspedisiUsageChecks.map(async (check) => {
      const queryParams = new URLSearchParams({
        page: '1',
        paginate: '1',
        [`filter_column_${check.filterColumn}`]: id,
      })

      const response = await apiCall(`${check.endpoint}?${queryParams}`, {
        method: 'GET'
      })

      return {
        label: check.label,
        total: getUsageTotal(response),
      }
    })
  )

  const usages = results
    .filter((result): result is PromiseFulfilledResult<EkspedisiUsageItem> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((usage) => usage.total > 0)

  return {
    used: usages.length > 0,
    usages,
  }
}

/**
 * Get all m_ekspedisi data without pagination (for sidebar)
 * @returns Promise with m_ekspedisi list
 */
export async function getEkspedisiListNoPagination(): Promise<EkspedisiListResponse> {
  return apiCall<EkspedisiListResponse>('/dynamic/m_ekspedisi?no_pagination=true', {
    method: 'GET'
  })
}

/**
 * Get tujuan ekspedisi by ekspedisi ID
 * @param ekspedisiId - Ekspedisi ID
 * @returns Promise with tujuan ekspedisi list
 */
export async function getTujuanEkspedisiByEkspedisiId(ekspedisiId: string): Promise<{ status: string; data: TujuanEkspedisiItem[] }> {
  return apiCall(`/dynamic/m_tujuan_ekspedisi?filter_column_m_ekspedisi_id=${ekspedisiId}&no_pagination=true`, {
    method: 'GET'
  })
}
