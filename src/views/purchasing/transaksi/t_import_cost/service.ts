import { apiCall, bulkDeleteWithFallback } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

// Biaya Kirim Detail Item
export interface ImportCostDetail {
  id?: string
  t_import_cost_id?: string
  m_coa_id?: string
  amount?: number
  catatan?: string
  // Display fields (from relations)
  kode_coa?: string
  nama_coa?: string
}

export interface ImportCostItem {
  id: string
  m_unit_bisnis_id?: string
  no_import_cost?: string
  supplier_id?: string
  t_penerimaan_barangs_id?: string
  m_currency_id?: string
  rate?: number
  total_cost?: number
  status?: string
  catatan?: string
  createdAt: string
  updatedAt: string
  // Relations
  m_unit_bisni?: {
    id: string
    nama_comp: string
  }
  m_supplier?: {
    id: string
    nama_supp: string
  }
  t_penerimaan_barang?: {
    id: string
    no_penerimaan: string
  }
  m_currency?: {
    id: string
    nama_currency: string
  }
  // Details
  t_import_cost_ds?: ImportCostDetail[]
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

export interface ImportCostListResponse {
  status: string
  data: ImportCostItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_import_cost data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_import_cost list
 */
export async function getImportCostList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string
): Promise<ImportCostListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true'
  })
  
  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }
  
  if (searchfield) {
    queryParams.append('searchfield', searchfield)
  }
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value)
        if (filterOperators?.[key]) {
          queryParams.append(`filter_operator_${key}`, filterOperators[key])
        }
      }
    })
  }

  if (where) {
    queryParams.append('where', where)
  }
  
  return apiCall<ImportCostListResponse>(`/dynamic/t_import_cost?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get ImportCost by ID
 * @param id - ImportCost ID
 * @returns Promise with t_import_cost detail
 */
export async function getImportCostById(id: string): Promise<{ status: string; data: ImportCostItem }> {
  return apiCall(`/dynamic/t_import_cost/${id}?join=true`, {
    method: 'GET'
  })
}

/**
 * Create new ImportCost with details
 * @param data - t_import_cost data with details
 * @returns Promise with created ImportCost
 */
export async function createImportCost(data: any): Promise<{ status: string; data: ImportCostItem }> {
  return apiCall('/dynamic/t_import_cost/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update ImportCost with details
 * @param id - ImportCost ID
 * @param data - t_import_cost data with details
 * @returns Promise with updated ImportCost
 */
export async function updateImportCost(id: string, data: any): Promise<{ status: string; data: ImportCostItem }> {
  return apiCall(`/dynamic/t_import_cost/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Post ImportCost - Change status to POST
 * @param id - ImportCost ID
 * @returns Promise with post confirmation
 */
export async function postImportCost(id: string): Promise<{ status: string; message?: string; data?: any }> {
  return apiCall(`/fn/t_import_cost/postImportCost`, {
    method: 'POST',
    body: JSON.stringify({ import_cost_id: id })
  })
}

/**
 * Delete ImportCost
 * @param id - ImportCost ID
 * @returns Promise with delete confirmation
 */
export async function deleteImportCost(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_import_cost/with-details/${id}`, {
    method: 'DELETE'
  })
}

export async function bulkDeleteImportCost(ids: string[]): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    '/dynamic/t_import_cost/bulkDelete',
    ids,
    deleteImportCost,
  )
}
