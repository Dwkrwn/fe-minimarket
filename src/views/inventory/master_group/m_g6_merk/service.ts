import { apiCall } from '@/lib/api'

export interface G6MerkItem {
  id: string
  g_category_id?: string | null
  g1_type_id?: string | null
  g2_material_id?: string | null
  g3_standard_id?: string | null
  g4_subtype_id?: string | null
  g5_finishing_id?: string | null
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
  m_g_category?: {
    id: string
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
  } | null
  m_g1_type?: {
    id: string
    category_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
  } | null
  m_g2_material?: {
    id: string
    g1_type_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
  } | null
  m_g3_standard?: {
    id: string
    g2_material_id?: string | null
    g2_type_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
  } | null
  m_g4_subtype?: {
    id: string
    g3_standard_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
  } | null
  m_g5_finishing?: {
    id: string
    g4_subtype_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
    m_g4_subtype?: {
      id: string
      g3_standard_id?: string | null
      code?: string | null
      name?: string | null
      status?: boolean
      catatan?: string | null
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

export interface G6MerkListResponse {
  status: string
  data: G6MerkItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

const getJoinedG5Finishing = (item: any): any => {
  if (!item) return null
  return item.m_g5_finishing
    || item.g5_finishing
    || item.g5
    || item.m_g5
    || item.g6_g5_finishing
    || item.g6_g5
    || null
}

const getJoinedG4Subtype = (item: any): any => {
  if (!item) return null
  return item.m_g4_subtype
    || item.g4_subtype
    || item.g4
    || item.m_g4
    || item.g6_g4_subtype
    || item.g6_g4
    || null
}

const getJoinedG3Standard = (item: any): any => {
  if (!item) return null
  return item.m_g3_standard
    || item.g3_standard
    || item.g3
    || item.m_g3
    || item.g6_g3_standard
    || item.g6_g3
    || null
}

const getJoinedG2Material = (item: any): any => {
  if (!item) return null
  return item.m_g2_material
    || item.g2_material
    || item.g2
    || item.m_g2
    || item.g6_g2_material
    || item.g6_g2
    || null
}

const getJoinedG1Type = (item: any): any => {
  if (!item) return null
  return item.m_g1_type
    || item.g1_type
    || item.g1
    || item.m_g1
    || item.g6_g1_type
    || item.g6_g1
    || null
}

const getJoinedGCategory = (item: any): any => {
  if (!item) return null
  return item.m_g_category
    || item.g_category
    || item.category
    || item.m_category
    || item.g6_g_category
    || item.g6_category
    || null
}

const normalizeG6MerkItem = (item: G6MerkItem): G6MerkItem => {
  const category = getJoinedGCategory(item)
  const g1Type = getJoinedG1Type(item)
  const g2Material = getJoinedG2Material(item)
  const g3Standard = getJoinedG3Standard(item)
  const g4Subtype = getJoinedG4Subtype(item)
  const g5Finishing = getJoinedG5Finishing(item)

  return {
    ...item,
    g_category_id: item.g_category_id || category?.id || null,
    g1_type_id: item.g1_type_id || g1Type?.id || null,
    g2_material_id: item.g2_material_id || g2Material?.id || null,
    g3_standard_id: item.g3_standard_id || g3Standard?.id || null,
    g4_subtype_id: item.g4_subtype_id || g4Subtype?.id || null,
    g5_finishing_id: item.g5_finishing_id || g5Finishing?.id || null,
    m_g_category: category || null,
    m_g1_type: g1Type || null,
    m_g2_material: g2Material || null,
    m_g3_standard: g3Standard || null,
    m_g4_subtype: g4Subtype || null,
    m_g5_finishing: g5Finishing || null
  }
}

export async function getG6MerkList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<G6MerkListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: 'true'
  })

  if (search && search.trim()) queryParams.append('search', search.trim())
  if (searchfield) queryParams.append('searchfield', searchfield)
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) queryParams.append(`filter_column_${key}`, value.trim())
    })
  }

  const response = await apiCall<G6MerkListResponse>(`/dynamic/m_g6_merk?${queryParams}`, { method: 'GET' })
  if (response.status === 'success') {
    response.data = response.data.map(normalizeG6MerkItem)
  }
  return response
}

export async function getG6MerkById(id: string): Promise<{ status: string; data: G6MerkItem }> {
  const response = await apiCall<{ status: string; data: G6MerkItem }>(`/dynamic/m_g6_merk/${id}?join=true`, { method: 'GET' })
  if (response.status === 'success') {
    response.data = normalizeG6MerkItem(response.data)
  }
  return response
}

export async function createG6Merk(data: Partial<G6MerkItem>): Promise<{ status: string; data: G6MerkItem }> {
  return apiCall('/dynamic/m_g6_merk', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateG6Merk(id: string, data: Partial<G6MerkItem>): Promise<{ status: string; data: G6MerkItem; message?: string }> {
  return apiCall(`/dynamic/m_g6_merk/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteG6Merk(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g6_merk/${id}`, {
    method: 'DELETE'
  })
}

export async function getG6MerkListNoPagination(): Promise<G6MerkListResponse> {
  return apiCall<G6MerkListResponse>('/dynamic/m_g6_merk?no_pagination=true&join=true', {
    method: 'GET'
  })
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

export async function getG4SubtypeReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g4_subtype/${id}?join=true`, {
    method: 'GET'
  })
}

export async function getG5FinishingReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g5_finishing/${id}?join=true`, {
    method: 'GET'
  })
}
