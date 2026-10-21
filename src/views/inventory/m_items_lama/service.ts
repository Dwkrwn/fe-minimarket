import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ItemsItem {
  id?: string
  kode_item?: string | null
  nama_item: string
  nama_singkat?: string | null
  nama_merk?: string | null
  is_active?: boolean
  status?: string
  spesifikasi: string
  tipe_barang: string
  min_stock: number
  max_stock: number
  // UUID fields (for barang dagang - cascade from m_group_*)
  m_group_jenis_id?: string | null
  m_group_merek_id?: string | null
  m_group_tipe_id?: string | null
  m_group_ukuran_id?: string | null
  m_group_batch_id?: string | null
  satuan_id?: string | null
  // String fields (for non-dagang - manual input)
  group_jenis?: string | null
  group_merek?: string | null
  group_tipe?: string | null
  group_ukuran?: string | null
  group_batch?: string | null
  // Other fields
  gambar?: string | null
  catatan?: string | null
  m_items_images?: { id?: string; m_items_id?: string; gambar: string }[]
  created_by?: string
  updated_by?: string
  is_skip?: boolean
  createdAt?: string
  updatedAt?: string
  // Relations (from include parameter with alias)
  as_group_jenis?: GroupJenis | null
  as_group_merek?: GroupMerek | null
  as_group_tipe?: GroupTipe | null
  as_group_ukuran?: GroupUkuran | null
  as_group_batch?: GroupBatch | null
  as_satuan?: {
    id: string
    group: string
    key1: string
    code: string
    value1: string
    is_active: boolean
  } | null
  uom?: {
    id: string
    group: string
    key1: string
    code: string
    value1: string
    is_active: boolean
  } | null
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

export interface ItemsListResponse {
  status: string
  data: ItemsItem[]
  pagination: Pagination
}

// ============================================================================
// GROUP INTERFACES (for cascade dropdowns)
// ============================================================================

export interface GroupJenis {
  id: string
  nama_jenis: string
  is_active: boolean
  catatan: string
  createdAt: string
  updatedAt: string
}

export interface GroupMerek {
  id: string
  nama_merek: string
  is_active: boolean
  catatan: string
  m_group_jenis_id: string
  createdAt: string
  updatedAt: string
}

export interface GroupTipe {
  id: string
  nama_tipe: string
  is_active: boolean
  catatan: string
  m_group_merek_id: string
  createdAt: string
  updatedAt: string
}

export interface GroupUkuran {
  id: string
  nama_ukuran: string
  is_active: boolean
  catatan: string
  m_group_tipe_id: string
  createdAt: string
  updatedAt: string
}

export interface GroupBatch {
  id: string
  nama_batch: string
  is_active: boolean
  catatan: string
  m_group_ukuran_id: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_items data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_items list
 */
export async function getItemsList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  include?: string
): Promise<ItemsListResponse> {
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
  
  if (include) {
    queryParams.append('include', include)
  }
  
  return apiCall<ItemsListResponse>(`/dynamic/m_items?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Items by ID with relations
 * @param id - Items ID
 * @returns Promise with m_items detail
 */
export async function getItemsById(id: string): Promise<{ status: string; data: ItemsItem }> {
  // Include relations: m_group_jenis, m_group_merek, m_group_tipe, m_group_ukuran, m_group_batch, m_general (satuan), m_items_images
  const include = 'm_group_jenis,m_group_merek,m_group_tipe,m_group_ukuran,m_group_batch,m_general,m_items_image'
  return apiCall(`/dynamic/m_items/${id}?include=${encodeURIComponent(include)}`, {
    method: 'GET'
  })
}

/**
 * Create new Items
 * @param data - m_items data
 * @returns Promise with created Items
 */
export async function createItems(data: Partial<ItemsItem>): Promise<{ status: string; data: ItemsItem }> {
  // Check if data has detail items (m_items_images)
  const hasDetails = !!(data.m_items_images && data.m_items_images.length > 0)
  const endpoint = hasDetails ? '/dynamic/m_items/with-details' : '/dynamic/m_items'
  
  console.log('📤 createItems service - Endpoint:', endpoint, 'Has details:', hasDetails, 'Data:', data)
  const result = await apiCall<{ status: string; data: ItemsItem }>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
  console.log('📥 createItems service - Response:', result)
  return result
}

/**
 * Update Items
 * @param id - Items ID
 * @param data - m_items data to update
 * @returns Promise with updated Items
 */
export async function updateItems(id: string, data: Partial<ItemsItem>): Promise<{ status: string; data: ItemsItem }> {
  // Check if data has detail items (m_items_images)
  const hasDetails = !!(data.m_items_images && data.m_items_images.length > 0)
  const endpoint = hasDetails ? `/dynamic/m_items/with-details/${id}` : `/dynamic/m_items/${id}`
  
  console.log('📤 updateItems service - Endpoint:', endpoint, 'Has details:', hasDetails, 'ID:', id, 'Data:', data)
  const result = await apiCall<{ status: string; data: ItemsItem }>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
  console.log('📥 updateItems service - Response:', result)
  return result
}

/**
 * Delete Items
 * @param id - Items ID
 * @returns Promise with delete confirmation
 */
export async function deleteItems(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_items/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_items data without pagination (for sidebar)
 * @returns Promise with m_items list
 */
export async function getItemsListNoPagination(): Promise<ItemsListResponse> {
  return apiCall<ItemsListResponse>('/dynamic/m_items?no_pagination=true', {
    method: 'GET'
  })
}

// ============================================================================
// GROUP CASCADE API FUNCTIONS
// ============================================================================

/**
 * Get all Group Jenis
 */
export async function getGroupJenisList(): Promise<{ status: string; data: GroupJenis[] }> {
  return apiCall('/dynamic/m_group_jenis?no_pagination=true&filter_column_is_active=true', {
    method: 'GET'
  })
}

/**
 * Get Group Merek filtered by Jenis ID
 */
export async function getGroupMerekByJenis(jenisId: string): Promise<{ status: string; data: GroupMerek[] }> {
  return apiCall(`/dynamic/m_group_merek?no_pagination=true&filter_column_is_active=true&filter_column_m_group_jenis_id=${jenisId}`, {
    method: 'GET'
  })
}

/**
 * Get Group Tipe filtered by Merek ID
 */
export async function getGroupTipeByMerek(merekId: string): Promise<{ status: string; data: GroupTipe[] }> {
  return apiCall(`/dynamic/m_group_tipe?no_pagination=true&filter_column_is_active=true&filter_column_m_group_merek_id=${merekId}`, {
    method: 'GET'
  })
}

/**
 * Get Group Ukuran filtered by Tipe ID
 */
export async function getGroupUkuranByTipe(tipeId: string): Promise<{ status: string; data: GroupUkuran[] }> {
  return apiCall(`/dynamic/m_group_ukuran?no_pagination=true&filter_column_is_active=true&filter_column_m_group_tipe_id=${tipeId}`, {
    method: 'GET'
  })
}

/**
 * Get Group Batch filtered by Ukuran ID
 */
export async function getGroupBatchByUkuran(ukuranId: string): Promise<{ status: string; data: GroupBatch[] }> {
  return apiCall(`/dynamic/m_group_batch?no_pagination=true&filter_column_is_active=true&filter_column_m_group_ukuran_id=${ukuranId}`, {
    method: 'GET'
  })
}
