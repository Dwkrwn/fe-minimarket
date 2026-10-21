import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PurchaseOrderSubconItem {
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
  no_po?: string
  tgl_po?: string
  m_unit_bisnis_id?: string
  m_supplier_id?: string
  catatan?: string
  grand_total?: number
  status?: string
  status_transksi?: string | number
  status_transaksi?: string | number
  approval_status?: string
  m_unit_bisnis?: any
  m_unit_bisni?: any
  m_supplier?: any
  m_currency?: any
  // Detail items (optional - only if module has details)
  t_purchase_order_subcon_details?: any[]
  t_purchase_order_subcon_details2?: any[]

  // Ganti atau tambahkan ini:
  t_purchase_order_subcon_bahans?: any[]; 
  t_purchase_order_subcon_jadis?: any[];
  t_purchase_order_subcon_jasas?: any[];
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

export interface PurchaseOrderSubconListResponse {
  status: string
  data: PurchaseOrderSubconItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_purchase_order_subcon data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_purchase_order_subcon list
 */
export async function getPurchaseOrderSubconList(params?: {
  page?: number
  paginate?: number
  order_by?: string
  order_type?: 'ASC' | 'DESC'
  search?: string
  searchfield?: string
  include?: string
  filters?: Record<string, string>
  filterOperators?: Record<string, string>
  where?: string
  filterCreatedBy?: string
}): Promise<PurchaseOrderSubconListResponse> {
  const queryParams = new URLSearchParams({
    page: (params?.page || 1).toString(),
    paginate: (params?.paginate || 10).toString(),
    order_by: params?.order_by || 'createdAt',
    order_type: params?.order_type || 'DESC'
  })
  
  if (params?.search && params.search.trim()) {
    queryParams.append('search', params.search.trim())
  }
  
  if (params?.searchfield) {
    queryParams.append('searchfield', params.searchfield)
  }

  if (params?.include) {
    queryParams.append('include', params.include)
  }

  if (params?.filterCreatedBy) {
    queryParams.append('filter_column_created_by', params.filterCreatedBy)
  }

  if (params?.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value)
        const operator = params.filterOperators?.[key]
        if (operator) {
          queryParams.append(`filter_operator_${key}`, operator)
        }
      }
    })
  }

  if (params?.where) {
    queryParams.append('where', params.where)
  }
  
  return apiCall<PurchaseOrderSubconListResponse>(`/dynamic/t_purchase_order_subcon?${queryParams}`, {
    method: 'GET'
  })
}
/**
 * Get PurchaseOrderSubcon by ID dengan relasi lengkap
 */
export async function getPurchaseOrderSubconById(
  id: string,
): Promise<{ status: string; data: any }> {
  const relations = [
    // Header
    "t_purchase_request_subcon",
    "m_supplier",
    "m_gudang",
    "m_ekspedisi",
    "m_general",
    "m_unit_bisnis",
    "m_unit_bisnis>m_company",
    "m_currency>money",
    "m_currency_d",

    // Detail bahan
    "t_purchase_order_subcon_bahan>m_items>m_general",
    "t_purchase_order_subcon_bahan>stock_gudang>m_rak_d>m_rak",
    "t_purchase_order_subcon_bahan>t_purchase_request_subcon_bahan",

    // Detail jadi
    "t_purchase_order_subcon_jadi>m_items>m_general",
    "t_purchase_order_subcon_jadi>t_purchase_request_subcon_jadi",

    // Detail jasa
    "t_purchase_order_subcon_jasa>m_items>m_general",
    "t_purchase_order_subcon_jasa>t_purchase_request_subcon_jasa",
  ].join(",");

  return apiCall(
    `/dynamic/t_purchase_order_subcon/${id}?join=true&include=${encodeURIComponent(relations)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new PurchaseOrderSubcon
 * @param data - t_purchase_order_subcon data
 * @returns Promise with created PurchaseOrderSubcon
 */
export async function createPurchaseOrderSubcon(data: Partial<PurchaseOrderSubconItem>): Promise<{ status: string; data: PurchaseOrderSubconItem }> {
  // 1. Sesuaikan pengecekan dengan nama array yang dikirim dari onSave
  const hasDetails = !!(
    (data.t_purchase_order_subcon_bahans && data.t_purchase_order_subcon_bahans.length > 0) || 
    (data.t_purchase_order_subcon_jadis && data.t_purchase_order_subcon_jadis.length > 0) || 
    (data.t_purchase_order_subcon_jasas && data.t_purchase_order_subcon_jasas.length > 0)
  );

  // 2. Tentukan endpoint
  const endpoint = hasDetails 
    ? '/dynamic/t_purchase_order_subcon/with-details' 
    : '/dynamic/t_purchase_order_subcon';
  
  // 3. Kirim data langsung (apiCall biasanya akan melakukan stringify otomatis)
  // Jika apiCall Anda manual fetch, biarkan JSON.stringify, tapi pastikan object 'data' benar
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data) // Lepas JSON.stringify jika apiCall sudah menanganinya
  });
}

/**
 * Update PurchaseOrderSubcon
 * @param id - PurchaseOrderSubcon ID
 * @param data - t_purchase_order_subcon data to update
 * @returns Promise with updated PurchaseOrderSubcon
 */
export async function updatePurchaseOrderSubcon(id: string, data: any): Promise<{ status: string; data: any }> {
  // 1. Sesuaikan pengecekan dengan nama array yang dikirim dari onSave
  // Menggunakan optional chaining (?.) untuk menghindari error jika field undefined
  const hasDetails = !!(
    (data.t_purchase_order_subcon_bahans && data.t_purchase_order_subcon_bahans.length > 0) || 
    (data.t_purchase_order_subcon_jadis && data.t_purchase_order_subcon_jadis.length > 0) || 
    (data.t_purchase_order_subcon_jasas && data.t_purchase_order_subcon_jasas.length > 0)
  );

  // 2. Pilih endpoint berdasarkan ada/tidaknya detail
  const endpoint = hasDetails 
    ? `/dynamic/t_purchase_order_subcon/with-details/${id}` 
    : `/dynamic/t_purchase_order_subcon/${id}`;
  
  return apiCall(endpoint, {
    method: 'PUT', // Gunakan PUT untuk update
    body: JSON.stringify(data)
  });
}

/**
 * Delete PurchaseOrderSubcon
 * @param id - PurchaseOrderSubcon ID
 * @returns Promise with delete confirmation
 */
export async function deletePurchaseOrderSubcon(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_purchase_order_subcon/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_purchase_order_subcon data without pagination (for sidebar)
 * @returns Promise with t_purchase_order_subcon list
 */
export async function getPurchaseOrderSubconListNoPagination(): Promise<PurchaseOrderSubconListResponse> {
  return apiCall<PurchaseOrderSubconListResponse>('/dynamic/t_purchase_order_subcon?no_pagination=true', {
    method: 'GET'
  })
}


/**
 * Get Purchase Request Subcon Detail by ID
 * Digunakan untuk mengambil detail item (bahan, jasa, dll) saat memilih No. PR
 * @param id - ID dari t_purchase_request_subcon
 */
export async function getPurchaseRequestSubconById(id: string): Promise<{ status: string; data: any }> {
  // Menggunakan parameter join=true agar detail item ikut terambil
  return apiCall(`/dynamic/t_purchase_request_subcon/${id}?join=all`, {
    method: 'GET'
  })
}

/**
 * Helper untuk mengambil detail PR berdasarkan kategori
 */
async function getPRDetailsByCategory(endpoint: string, prId: string) {
  const queryParams = new URLSearchParams({
    filter_column_t_purchase_request_subcon_id: prId,
    join: 'true',
    no_pagination: 'true'
  })
  return apiCall<{ status: string; data: any[] }>(`${endpoint}?${queryParams}`, {
    method: 'GET'
  })
}

export async function getPRSubconBahan(prId: string) {
  return getPRDetailsByCategory('/dynamic/t_purchase_request_subcon_bahan', prId)
}

export async function getPRSubconJadi(prId: string) {
  return getPRDetailsByCategory('/dynamic/t_purchase_request_subcon_jadi', prId)
}

export async function getPRSubconJasa(prId: string) {
  return getPRDetailsByCategory('/dynamic/t_purchase_request_subcon_jasa', prId)
}

/**
 * Mencari ID Stock Gudang berdasarkan item, gudang, dan rak
 */
export async function getStockGudangId(params: { m_items_id: string; gudang_id: string; m_rak_d_id: string }) {
  const queryParams = new URLSearchParams({
    filter_column_m_items_id: params.m_items_id,
    filter_column_gudang_id: params.gudang_id,
    filter_column_m_rak_d_id: params.m_rak_d_id,
    selectfield: 'id',
    no_pagination: 'true'
  })
  
  return apiCall<{ status: string; data: any[] }>(`/dynamic/t_stock_gudang?${queryParams}`, {
    method: 'GET'
  })
}
