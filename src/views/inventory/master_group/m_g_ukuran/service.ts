import { apiCall } from '@/lib/api'

export interface GUkuranItem {
  id: string
  g_category_id?: string | null
  g1_type_id?: string | null
  g2_material_id?: string | null
  g3_standard_id?: string | null
  g4_subtype_id?: string | null
  g5_finishing_id?: string | null
  g6_merk_id?: string | null
  code?: string | null
  name?: string | null
  panjang?: number | null
  status?: string | boolean
  is_active?: boolean
  catatan?: string | null
  created_by?: string | null
  update_by?: string | null
  updated_by?: string | null
  createdAt: string
  updatedAt: string
  m_g_category?: any | null
  m_g1_type?: any | null
  m_g2_material?: any | null
  m_g3_standard?: any | null
  m_g4_subtype?: any | null
  m_g5_finishing?: any | null
  m_g6_merk?: {
    id: string
    g5_finishing_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
    m_g5_finishing?: {
      id: string
      g4_subtype_id?: string | null
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

export interface GUkuranListResponse {
  status: string
  data: GUkuranItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

const getJoinedG6Merk = (item: any): any => {
  if (!item) return null
  return item.m_g6_merk
    || item.g6_merk
    || item.g6
    || item.m_g6
    || item.ukuran_g6_merk
    || null
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
    || item.g5_g4_subtype
    || item.g5_g4
    || null
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

const getJoinedG2Material = (item: any): any => {
  if (!item) return null
  return item.m_g2_material
    || item.g2_material
    || item.g2
    || item.m_g2
    || item.g3_g2_material
    || item.g3_g2
    || null
}

const getJoinedG1Type = (item: any): any => {
  if (!item) return null
  return item.m_g1_type
    || item.g1_type
    || item.g1
    || item.m_g1
    || item.g2_g1_type
    || item.g2_g1
    || null
}

const getJoinedGCategory = (item: any): any => {
  if (!item) return null
  return item.m_g_category
    || item.g_category
    || item.category
    || item.m_category
    || item.g1_category
    || null
}

const normalizeGUkuranItem = (item: GUkuranItem): GUkuranItem => {
  const g6Merk = getJoinedG6Merk(item)
  const g5Finishing = getJoinedG5Finishing(item)
  const g4Subtype = getJoinedG4Subtype(item)
  const g3Standard = getJoinedG3Standard(item)
  const g2Material = getJoinedG2Material(item)
  const g1Type = getJoinedG1Type(item)
  const category = getJoinedGCategory(item)

  return {
    ...item,
    panjang: item.panjang === null || item.panjang === undefined || (item.panjang as unknown as string) === ''
      ? null
      : Number(item.panjang),
    g_category_id: item.g_category_id || category?.id || null,
    g1_type_id: item.g1_type_id || g1Type?.id || null,
    g2_material_id: item.g2_material_id || g2Material?.id || null,
    g3_standard_id: item.g3_standard_id || g3Standard?.id || null,
    g4_subtype_id: item.g4_subtype_id || g4Subtype?.id || null,
    g5_finishing_id: item.g5_finishing_id || g5Finishing?.id || null,
    g6_merk_id: item.g6_merk_id || g6Merk?.id || null,
    m_g_category: category || null,
    m_g1_type: g1Type || null,
    m_g2_material: g2Material || null,
    m_g3_standard: g3Standard || null,
    m_g4_subtype: g4Subtype || null,
    m_g5_finishing: g5Finishing || null,
    m_g6_merk: g6Merk || null
  }
}

export async function getGUkuranList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<GUkuranListResponse> {
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

  const response = await apiCall<GUkuranListResponse>(`/dynamic/m_g_ukuran?${queryParams}`, { method: 'GET' })
  if (response.status === 'success') {
    response.data = response.data.map(normalizeGUkuranItem)
  }
  return response
}

export async function getGUkuranById(id: string): Promise<{ status: string; data: GUkuranItem }> {
  const response = await apiCall<{ status: string; data: GUkuranItem }>(`/dynamic/m_g_ukuran/${id}?join=true`, { method: 'GET' })
  if (response.status === 'success') {
    response.data = normalizeGUkuranItem(response.data)
  }
  return response
}

export async function createGUkuran(data: Partial<GUkuranItem>): Promise<{ status: string; data: GUkuranItem }> {
  return apiCall('/dynamic/m_g_ukuran', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateGUkuran(id: string, data: Partial<GUkuranItem>): Promise<{ status: string; data: GUkuranItem }> {
  return apiCall(`/dynamic/m_g_ukuran/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteGUkuran(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g_ukuran/${id}`, {
    method: 'DELETE'
  })
}

export async function postGUkuran(id: string): Promise<{ status: string; data: GUkuranItem }> {
  return updateGUkuran(id, { status: 'POST' } as Partial<GUkuranItem>)
}

export async function getGUkuranListNoPagination(): Promise<GUkuranListResponse> {
  const response = await apiCall<GUkuranListResponse>('/dynamic/m_g_ukuran?no_pagination=true&join=true', {
    method: 'GET'
  })
  if (response.status === 'success') {
    response.data = response.data.map(normalizeGUkuranItem)
  }
  return response
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

export async function getG6MerkReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g6_merk/${id}?join=true`, {
    method: 'GET'
  })
}
