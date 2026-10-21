import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface G4SubtypeItem {
  id: string
  g3_standard_id?: string | null
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
  m_g3_standard?: {
    id: string
    g2_material_id?: string | null
    g2_type_id?: string | null
    code?: string | null
    name?: string | null
    is_active?: boolean
    catatan?: string | null
    m_g2_material?: {
      id: string
      g1_type_id?: string | null
      code?: string | null
      name?: string | null
      is_active?: boolean
      catatan?: string | null
      m_g1_type?: {
        id: string
        category_id?: string | null
        code?: string | null
        name?: string | null
        is_active?: boolean
        catatan?: string | null
      } | null
    } | null
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

export interface G4SubtypeListResponse {
  status: string
  data: G4SubtypeItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

const getJoinedG3Standard = (item: any): any => {
  if (!item) return null
  return item.m_g3_standard
    || item.g3_standard
    || item.g3
    || item.m_g3
    || item.g4_g3_standard
    || item.g4_g3
    || null
}

const normalizeG4SubtypeItem = (item: G4SubtypeItem): G4SubtypeItem => {
  const g3Standard = getJoinedG3Standard(item)
  return {
    ...item,
    m_g3_standard: g3Standard || null
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getG4SubtypeList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<G4SubtypeListResponse> {
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

  const response = await apiCall<G4SubtypeListResponse>(`/dynamic/m_g4_subtype?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = response.data.map(normalizeG4SubtypeItem)
  }

  return response
}

export async function getG4SubtypeById(id: string): Promise<{ status: string; data: G4SubtypeItem }> {
  const queryParams = new URLSearchParams({
    join: 'true'
  })

  const response = await apiCall<{ status: string; data: G4SubtypeItem }>(`/dynamic/m_g4_subtype/${id}?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = normalizeG4SubtypeItem(response.data)
  }

  return response
}

export async function createG4Subtype(data: Partial<G4SubtypeItem>): Promise<{ status: string; data: G4SubtypeItem }> {
  return apiCall('/dynamic/m_g4_subtype', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateG4Subtype(id: string, data: Partial<G4SubtypeItem>): Promise<{ status: string; data: G4SubtypeItem }> {
  return apiCall(`/dynamic/m_g4_subtype/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteG4Subtype(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g4_subtype/${id}`, {
    method: 'DELETE'
  })
}

export async function postG4Subtype(id: string): Promise<{ status: string; message?: string }> {
  return apiCall(`/dynamic/m_g4_subtype/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'POST' })
  })
}

export async function getG4SubtypeListNoPagination(): Promise<G4SubtypeListResponse> {
  return apiCall<G4SubtypeListResponse>('/dynamic/m_g4_subtype?no_pagination=true&join=true', {
    method: 'GET'
  })
}

export async function getG3StandardLookup(
  params?: Record<string, string | number | boolean | null | undefined>
): Promise<{ status: string; data: any[]; pagination?: Pagination }> {
  const queryParams = new URLSearchParams()

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value))
    }
  })

  return apiCall(`/fn/m_g4_subtype/g3StandardLookup?${queryParams.toString()}`, {
    method: 'GET'
  })
}

export async function getG3StandardLookupById(id: string): Promise<{ status: string; data: any | null }> {
  const response = await getG3StandardLookup({
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
