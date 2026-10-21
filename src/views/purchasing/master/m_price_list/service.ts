import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PriceListItem {
  m_items_id?: string
  harga?: number
  is_active?: boolean
  note?: string
  created_by?: string
}

export interface GroupJenis {
  id: string
  nama_jenis: string
  is_active: boolean
  catatan?: string
}

export interface GroupMerek {
  id: string
  nama_merek: string
  is_active: boolean
  catatan?: string
  m_group_jenis_id?: string
}

export interface GroupTipe {
  id: string
  nama_tipe: string
  is_active: boolean
  catatan?: string
  m_group_merek_id?: string
}

export interface GroupUkuran {
  id: string
  nama_ukuran: string
  is_active: boolean
  catatan?: string
  m_group_tipe_id?: string
}

export interface GroupBatch {
  id: string
  nama_batch: string
  is_active: boolean
  catatan?: string
  m_group_ukuran_id?: string
}

export interface ItemImage {
  id: string
  m_items_id: string
  gambar: string
}

export interface UomItem {
  id: string
  group: string
  key1: string
  code: string
  value1: string
  value2?: string | null
  value3?: string | null
  value4?: string | null
  value5?: string | null
  is_active: boolean
}

export interface PriceListHistoryItem {
  id: string
  m_items_id: string
  harga: number
  note: string | null
  is_active: boolean
  created_by?: string
  createdAt: string
  updatedAt: string
  price_ctr?: {
    id: string
    name: string
    username: string
  }
}

export interface ItemWithPriceList {
  id: string
  kode_item: string | null
  nama_item: string
  nama_singkat: string
  is_active: boolean
  status: string
  spesifikasi: string
  tipe_barang: string
  min_stock: string
  max_stock: string
  m_group_jenis_id: string | null
  m_group_tipe_id: string | null
  m_group_merek_id: string | null
  m_group_ukuran_id: string | null
  m_group_batch_id: string | null
  satuan_id: string | null
  gambar: string
  catatan: string
  created_by: string
  updated_by: string
  is_skip: boolean
  group_jenis: string
  group_tipe: string
  group_merek: string
  group_ukuran: string
  group_batch: string
  createdAt: string
  updatedAt: string
  m_items_pricelists?: PriceListItem[]
  m_group_jeni?: GroupJenis
  m_group_merek?: GroupMerek
  m_group_tipe?: GroupTipe
  m_group_ukuran?: GroupUkuran
  m_group_batch?: GroupBatch
  uom?: UomItem
  m_items_images?: ItemImage[]
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

export interface PriceListResponse {
  status: string
  data: ItemWithPriceList[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all items with pricelist data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 20)
 * @param order_by - Order by column (default: 'createdAt')
 * @param order_type - Order type ASC or DESC (default: 'DESC')
 * @param search - Search query (optional)
 * @param searchfield - Fields to search in (optional)
 * @returns Promise with price list
 */
export async function getPriceList(
  page: number = 1,
  paginate: number = 20,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string
): Promise<PriceListResponse> {
  const queryParams = new URLSearchParams({
    include: 'm_group_jenis,m_group_merek,m_group_tipe,m_group_ukuran,m_group_batch,m_general,m_items_image,m_items_pricelist',
    filter_column_status: 'APPROVED',
    filter_column_is_active: 'true',
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
  
  return apiCall<PriceListResponse>(`/dynamic/m_items?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Update or create price list for an item
 * @param data - Price list data
 * @returns Promise with response
 */
export async function updatePriceList(data: PriceListItem): Promise<{ status: string; message: string }> {
  return apiCall('/dynamic/m_items_pricelist', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Get price list history for specific item
 * @param itemId - Item ID
 * @returns Promise with price list history
 */
export async function getPriceListHistory(itemId: string): Promise<{ status: string; data: PriceListHistoryItem[] }> {
  const queryParams = new URLSearchParams({
    filter_column_m_items_id: itemId,
    include: 'user_default:id|name|username',
    no_pagination: 'true'
  })
  
  return apiCall(`/dynamic/m_items_pricelist?${queryParams}`, {
    method: 'GET'
  })
}
