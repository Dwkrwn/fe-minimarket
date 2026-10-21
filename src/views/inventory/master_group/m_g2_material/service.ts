import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface G2MaterialItem {
  id: string
  g1_type_id?: string | null
  code?: string | null
  name?: string | null
  status?: string | boolean
  is_active?: boolean
  catatan?: string | null
  created_by?: string | null
  update_by?: string | null
  updated_by?: string | null
  createdAt: string
  updatedAt: string
  m_g1_type?: {
    id: string
    category_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
    m_g_category?: {
      id: string
      code?: string | null
      name?: string | null
      status?: boolean
      catatan?: string | null
    } | null
  } | null
}

interface G1TypeRelation {
  id: string
  category_id?: string | null
  code?: string | null
  name?: string | null
  status?: boolean
  catatan?: string | null
  m_g_category?: {
    id: string
    code?: string | null
    name?: string | null
    status?: boolean
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

export interface G2MaterialListResponse {
  status: string
  data: G2MaterialItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

// ============================================================================
// HELPERS
// ============================================================================

const getJoinedG1Type = (item: any): G1TypeRelation | null => {
  return item.m_g1_type
    || item.g1_type
    || item.g1
    || item.m_g1
    || item.g2_g1_type
    || item.g2_g1
    || item.g2_material_g1_type
    || null
}

const normalizeG2MaterialItem = (item: G2MaterialItem): G2MaterialItem => {
  return {
    ...item,
    m_g1_type: getJoinedG1Type(item)
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getG2MaterialList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<G2MaterialListResponse> {
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

  const response = await apiCall<G2MaterialListResponse>(`/dynamic/m_g2_material?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = response.data.map(normalizeG2MaterialItem)
  }

  return response
}

export async function getG2MaterialById(id: string): Promise<{ status: string; data: G2MaterialItem }> {
  const queryParams = new URLSearchParams({
    join: 'true'
  })

  const response = await apiCall<{ status: string; data: G2MaterialItem }>(`/dynamic/m_g2_material/${id}?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = normalizeG2MaterialItem(response.data)
  }

  return response
}

export async function createG2Material(data: Partial<G2MaterialItem>): Promise<{ status: string; data: G2MaterialItem }> {
  return apiCall('/dynamic/m_g2_material', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateG2Material(id: string, data: Partial<G2MaterialItem>): Promise<{ status: string; data: G2MaterialItem }> {
  return apiCall(`/dynamic/m_g2_material/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteG2Material(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g2_material/${id}`, {
    method: 'DELETE'
  })
}

export async function postG2Material(id: string): Promise<{ status: string; data: G2MaterialItem }> {
  return updateG2Material(id, { status: 'POST' } as Partial<G2MaterialItem>)
}

export async function getG2MaterialListNoPagination(): Promise<G2MaterialListResponse> {
  return apiCall<G2MaterialListResponse>('/dynamic/m_g2_material?no_pagination=true&join=true', {
    method: 'GET'
  })
}

export async function getG1TypeReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g1_type/${id}?join=true`, {
    method: 'GET'
  })
}

export async function getGCategoryReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g_category/${id}?join=true`, {
    method: 'GET'
  })
}
