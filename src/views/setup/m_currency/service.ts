import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface CurrencyDItem {
  id?: string  // Optional: only present for existing items
  tgl_mulai?: string  // DATE timestamp
  tgl_selesai?: string  // DATE timestamp
  rate?: number  // DECIMAL
  catatan?: string  // TEXT notes
  is_active?: boolean
  createdAt?: string  // ISO timestamp for sorting
}

export interface CurrencyItem {
  id: string
  kode_currency?: string  // optional
  nama_currency: string  // required
  simbol_id: string  // required UUID from money
  is_active: boolean
  createdAt: string
  updatedAt: string
  // Relations
  money?: { id: string; value1?: string; value2?: string; code?: string }  // simbol display
  // Detail items
  m_currency_ds?: CurrencyDItem[]
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

export interface CurrencyListResponse {
  status: string
  data: CurrencyItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_currency data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_currency list
 */
export async function getCurrencyList(
  page: number = 1,
  paginate: number = 20,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string
): Promise<CurrencyListResponse> {
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
  
  // Include money relation to show simbol, code, and mata uang
  queryParams.append('include', 'money')
  
  return apiCall<CurrencyListResponse>(`/dynamic/m_currency?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Currency by ID
 * @param id - Currency ID
 * @returns Promise with m_currency detail
 */
export async function getCurrencyById(id: string): Promise<{ status: string; data: CurrencyItem }> {
  const queryParams = new URLSearchParams({
    include: 'money,m_currency_d'
  })
  
  return apiCall(`/dynamic/m_currency/${id}?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new Currency
 * @param data - m_currency data
 * @returns Promise with created Currency
 */
export async function createCurrency(data: Partial<CurrencyItem>): Promise<{ status: string; data: CurrencyItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_currency_ds && data.m_currency_ds.length > 0)
  const endpoint = hasDetails ? '/dynamic/m_currency/with-details' : '/dynamic/m_currency'
  
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Currency
 * @param id - Currency ID
 * @param data - m_currency data to update
 * @returns Promise with updated Currency
 */
export async function updateCurrency(id: string, data: Partial<CurrencyItem>): Promise<{ status: string; data: CurrencyItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.m_currency_ds && data.m_currency_ds.length > 0)
  const endpoint = hasDetails ? `/dynamic/m_currency/with-details/${id}` : `/dynamic/m_currency/${id}`
  
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Currency
 * @param id - Currency ID
 * @returns Promise with delete confirmation
 */
export async function deleteCurrency(id: string): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_currency/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all m_currency data without pagination (for sidebar)
 * @returns Promise with m_currency list
 */
export async function getCurrencyListNoPagination(): Promise<CurrencyListResponse> {
  return apiCall<CurrencyListResponse>('/dynamic/m_currency?no_pagination=true', {
    method: 'GET'
  })
}

/**
 * Get existing rates for a specific currency
 * @param currencyId - Currency ID (m_currency_id)
 * @returns Promise with list of currency rates
 */
export async function getCurrencyRates(currencyId: string): Promise<{ status: string; data: CurrencyDItem[] }> {
  const queryParams = new URLSearchParams({
    filter_column_m_currency_id: currencyId,
    no_pagination: 'true'
  })
  
  return apiCall(`/dynamic/m_currency_d?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Create new currency rate
 * @param data - Rate data (m_currency_id, tgl_mulai, rate, is_active, catatan, tgl_selesai)
 * @returns Promise with created rate
 */
export async function createCurrencyRate(data: Partial<CurrencyDItem> & { m_currency_id: string }): Promise<{ status: string; data: CurrencyDItem }> {
  return apiCall('/dynamic/m_currency_d', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update currency rate (untuk deactivate rate sebelumnya)
 * @param rateId - Rate ID
 * @param data - Rate data to update (tgl_selesai, is_active, catatan)
 * @returns Promise with updated rate
 */
export async function updateCurrencyRate(rateId: string, data: Partial<CurrencyDItem>): Promise<{ status: string; data: CurrencyDItem }> {
  return apiCall(`/dynamic/m_currency_d/${rateId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}
