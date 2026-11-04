import { apiCall, apiPath } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================
// Kontrak mengikuti be-minimarket: src/modules/inventory/master.routes.js
// router.use("/categories", createCrudRouter(categoryService, ...))
// Service: createCrudService({ model: prisma.m_category, searchFields: ['code','name'],
// filterFields: ['is_active','code'], allowedOrder: ['name','code','createdAt','updatedAt','is_active'] })
// Backend: /api/v1/inventory/categories (be-minimarket/src/modules/index.js)
// apiPath() menambahkan prefix "/api" bila VITE_API_BASE_URL belum memuatnya

export interface CategoryItem {
  id: string
  code?: string | null
  name: string
  is_active?: boolean
  catatan?: string | null
  createdAt?: string
  updatedAt?: string
  /** include _count.items dari backend */
  _count?: {
    items?: number
  }
}

export interface CategoryPayload {
  code?: string | null
  name: string
  is_active?: boolean
  catatan?: string | null
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

export interface CategoryListResponse {
  status: string
  data: CategoryItem[]
  pagination: Pagination
}

export interface CategoryDetailResponse {
  status: string
  data: CategoryItem
}

const ENDPOINT = apiPath('/v1/inventory/categories')

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all category data (paginated).
 * Query kontrak backend: ?page=1&paginate=20&order_by=createdAt&order_type=DESC&search=...
 * Filter yang didukung backend: filter_column_is_active, filter_column_code
 */
export async function getCategoryList(
  page: number = 1,
  paginate: number = 20,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  filters?: Record<string, string>,
): Promise<CategoryListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
  })

  if (search && search.trim()) {
    queryParams.append('search', search.trim())
  }

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value)
      }
    })
  }

  return apiCall<CategoryListResponse>(`${ENDPOINT}?${queryParams}`, {
    method: 'GET',
  })
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<CategoryDetailResponse> {
  return apiCall<CategoryDetailResponse>(`${ENDPOINT}/${id}`, {
    method: 'GET',
  })
}

/**
 * Create new category
 * Payload hanya field yang ada di categorySchema (code, name, is_active, catatan)
 */
export async function createCategory(data: CategoryPayload): Promise<CategoryDetailResponse> {
  return apiCall<CategoryDetailResponse>(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update category
 */
export async function updateCategory(
  id: string,
  data: CategoryPayload,
): Promise<CategoryDetailResponse> {
  return apiCall<CategoryDetailResponse>(`${ENDPOINT}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Delete category
 */
export async function deleteCategory(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`${ENDPOINT}/${id}`, {
    method: 'DELETE',
  })
}

/**
 * Get all category data without pagination (untuk dropdown)
 */
export async function getCategoryListNoPagination(): Promise<CategoryListResponse> {
  return apiCall<CategoryListResponse>(`${ENDPOINT}?no_pagination=true`, {
    method: 'GET',
  })
}
