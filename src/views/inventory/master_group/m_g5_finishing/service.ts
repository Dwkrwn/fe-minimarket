import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface G5FinishingItem {
  id: string
  g4_subtype_id?: string | null
  code?: string | null
  name?: string | null
  status?: string | null
  is_active?: boolean
  catatan?: string | null
  created_by?: string | null
  update_by?: string | null
  updated_by?: string | null
  createdAt: string
  updatedAt: string
  m_g4_subtype?: {
    id: string
    g3_standard_id?: string | null
    code?: string | null
    name?: string | null
    is_active?: boolean
    catatan?: string | null
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

export interface G5FinishingListResponse {
  status: string
  data: G5FinishingItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

const getJoinedG4Subtype = (item: any): any => {
  if (!item) return null
  return item.m_g4_subtype
    || item.g4_subtype
    || item.g4
    || item.m_g4
    || item.g5_g4_subtype
    || item.g5_g4
    || null
}

const normalizeG5FinishingItem = (item: G5FinishingItem): G5FinishingItem => {
  return {
    ...item,
    m_g4_subtype: getJoinedG4Subtype(item) || null
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getG5FinishingList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<G5FinishingListResponse> {
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

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim())
      }
    })
  }

  const response = await apiCall<G5FinishingListResponse>(`/dynamic/m_g5_finishing?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = response.data.map(normalizeG5FinishingItem)
  }

  return response
}

export async function getG5FinishingById(id: string): Promise<{ status: string; data: G5FinishingItem }> {
  const queryParams = new URLSearchParams({
    join: 'true'
  })

  const response = await apiCall<{ status: string; data: G5FinishingItem }>(`/dynamic/m_g5_finishing/${id}?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = normalizeG5FinishingItem(response.data)
  }

  return response
}

export async function createG5Finishing(data: Partial<G5FinishingItem>): Promise<{ status: string; data: G5FinishingItem }> {
  return apiCall('/dynamic/m_g5_finishing', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateG5Finishing(id: string, data: Partial<G5FinishingItem>): Promise<{ status: string; data: G5FinishingItem }> {
  return apiCall(`/dynamic/m_g5_finishing/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteG5Finishing(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g5_finishing/${id}`, {
    method: 'DELETE'
  })
}

export async function postG5Finishing(id: string): Promise<{ status: string; message?: string }> {
  return apiCall(`/dynamic/m_g5_finishing/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST' })
  })
}

export async function getG5FinishingListNoPagination(): Promise<G5FinishingListResponse> {
  return apiCall<G5FinishingListResponse>('/dynamic/m_g5_finishing?no_pagination=true&join=true', {
    method: 'GET'
  })
}

export async function getG4SubtypeLookup(
  params?: Record<string, string | number | boolean | null | undefined>
): Promise<{ status: string; data: any[]; pagination?: Pagination }> {
  const queryParams = new URLSearchParams()

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value))
    }
  })

  return apiCall(`/fn/m_g5_finishing/g4SubtypeLookup?${queryParams.toString()}`, {
    method: 'GET'
  })
}

export async function getG4SubtypeLookupById(id: string): Promise<{ status: string; data: any | null }> {
  const response = await getG4SubtypeLookup({
    filter_column_id: id,
    paginate: 1,
    page: 1
  })

  return {
    status: response.status,
    data: Array.isArray(response.data) ? (response.data[0] || null) : null
  }
}

export async function getGCategoryReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g_category/${id}?join=true`, {
    method: 'GET'
  })
}

export async function getG1TypeReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g1_type/${id}?join=true`, {
    method: 'GET'
  })
}

export async function getG2MaterialReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g2_material/${id}?join=true`, {
    method: 'GET'
  })
}

export async function getG3StandardReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g3_standard/${id}?join=true`, {
    method: 'GET'
  })
}
