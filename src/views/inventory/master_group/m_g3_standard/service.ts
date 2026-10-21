import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface G3StandardItem {
  id: string
  g2_material_id?: string | null
  g2_type_id?: string | null
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
  m_g2_material?: {
    id: string
    g1_type_id?: string | null
    code?: string | null
    name?: string | null
    status?: boolean
    catatan?: string | null
    m_g1_type?: {
      id: string
      category_id?: string | null
      code?: string | null
      name?: string | null
      status?: boolean
      catatan?: string | null
    } | null
  } | null
}

interface G2MaterialRelation {
  id: string
  g1_type_id?: string | null
  code?: string | null
  name?: string | null
  status?: boolean
  catatan?: string | null
  m_g1_type?: {
    id: string
    category_id?: string | null
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

export interface G3StandardListResponse {
  status: string
  data: G3StandardItem[]
  pagination: Pagination
}

export interface ColumnFilters {
  [key: string]: string
}

// ============================================================================
// HELPERS
// ============================================================================

// Catatan relasi:
// - /dynamic/m_g3_standard?join=true TIDAK menyertakan m_g2_material (hanya relasi
//   creator/updater), jadi G2 Material di-hydrate manual dari tabel m_g2_material.
// - /dynamic/m_g2_material?join=true juga TIDAK menyertakan m_g1_type, jadi G1 Type
//   di-hydrate manual dari tabel m_g1_type berdasarkan g1_type_id.

type G1TypeRelation = NonNullable<G2MaterialRelation['m_g1_type']>

const getJoinedG2Material = (item: any): any => {
  if (!item) return null
  return item.m_g2_material
    || item.g2_material
    || item.g2
    || item.m_g2
    || item.g3_g2_material
    || item.g3_g2
    || item.g3_standard_g2_material
    || null
}

const getJoinedG1Type = (g2Material: any): any => {
  if (!g2Material) return null
  return g2Material.m_g1_type
    || g2Material.g1_type
    || g2Material.g1
    || g2Material.m_g1
    || null
}

/**
 * Ambil seluruh m_g1_type sebagai map (id -> relasi) untuk hydrate G1 Type
 * ke dalam setiap G2 Material.
 */
export const getG1TypeRelationMap = async (): Promise<Map<string, G1TypeRelation>> => {
  const response = await apiCall<{ status: string; data: any[] }>('/dynamic/m_g1_type?no_pagination=true&join=true', {
    method: 'GET'
  })

  const relationMap = new Map<string, G1TypeRelation>()
  if (response.status === 'success') {
    response.data.forEach((item: any) => {
      relationMap.set(item.id, item as G1TypeRelation)
    })
  }

  return relationMap
}

/**
 * Lengkapi satu objek G2 Material dengan m_g1_type dari map (jika belum ada).
 */
export const attachG1TypeToG2Material = (
  g2Material: any,
  g1TypeMap: Map<string, G1TypeRelation>
): G2MaterialRelation | null => {
  if (!g2Material) return null
  const existingG1Type = getJoinedG1Type(g2Material)
  const fallbackG1Type = g2Material.g1_type_id ? g1TypeMap.get(g2Material.g1_type_id) : null

  return {
    ...g2Material,
    m_g1_type: existingG1Type || fallbackG1Type || null
  }
}

const normalizeG3StandardItem = (item: G3StandardItem): G3StandardItem => {
  const g2Material = getJoinedG2Material(item)
  if (!g2Material) {
    return { ...item, m_g2_material: null }
  }

  return {
    ...item,
    m_g2_material: {
      ...g2Material,
      m_g1_type: getJoinedG1Type(g2Material)
    }
  }
}

const normalizeG2MaterialRelations = (items: G3StandardItem[]): G3StandardItem[] => {
  // Normalize: treat g2_type_id as g2_material_id if the latter is absent
  return items.map(item => ({
    ...item,
    g2_material_id: item.g2_material_id || item.g2_type_id || null,
    m_g2_material: normalizeG3StandardItem(item).m_g2_material
  }))
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_g3_standard data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param columnFilters - Per-column filter values
 * @returns Promise with m_g3_standard list
 */
export async function getG3StandardList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters
): Promise<G3StandardListResponse> {
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

  const response = await apiCall<G3StandardListResponse>(`/dynamic/m_g3_standard?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    response.data = normalizeG2MaterialRelations(response.data)
  }

  return response
}

/**
 * Get G3Standard by ID
 * @param id - G3Standard ID
 * @returns Promise with m_g3_standard detail
 */
export async function getG3StandardById(id: string): Promise<{ status: string; data: G3StandardItem }> {
  const queryParams = new URLSearchParams({
    join: 'true'
  })

  const response = await apiCall<{ status: string; data: G3StandardItem }>(`/dynamic/m_g3_standard/${id}?${queryParams}`, {
    method: 'GET'
  })

  if (response.status === 'success') {
    const hydratedItems = normalizeG2MaterialRelations([response.data])
    response.data = hydratedItems[0] ?? response.data
  }

  return response
}

/**
 * Create new G3Standard
 * @param data - m_g3_standard data
 * @returns Promise with created G3Standard
 */
export async function createG3Standard(data: Partial<G3StandardItem>): Promise<{ status: string; data: G3StandardItem }> {
  return apiCall('/dynamic/m_g3_standard', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update G3Standard
 * @param id - G3Standard ID
 * @param data - m_g3_standard data to update
 * @returns Promise with updated G3Standard
 */
export async function updateG3Standard(id: string, data: Partial<G3StandardItem>): Promise<{ status: string; data: G3StandardItem }> {
  return apiCall(`/dynamic/m_g3_standard/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete G3Standard
 * @param id - G3Standard ID
 * @returns Promise with delete confirmation
 */
export async function deleteG3Standard(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_g3_standard/${id}`, {
    method: 'DELETE'
  })
}

export async function postG3Standard(id: string): Promise<{ status: string; data: G3StandardItem }> {
  return updateG3Standard(id, { status: 'POST' } as Partial<G3StandardItem>)
}

/**
 * Get all m_g3_standard data without pagination (for sidebar)
 * @returns Promise with m_g3_standard list
 */
export async function getG3StandardListNoPagination(): Promise<G3StandardListResponse> {
  return apiCall<G3StandardListResponse>('/dynamic/m_g3_standard?no_pagination=true&join=true', {
    method: 'GET'
  })
}

export async function getG2MaterialReferenceById(id: string): Promise<{ status: string; data: any }> {
  return apiCall(`/dynamic/m_g2_material/${id}?join=true`, {
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
