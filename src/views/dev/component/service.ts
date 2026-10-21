// ============================================================================
// DEV COMPONENT SERVICE
// ============================================================================
// Service ini dikosongkan karena halaman ini digunakan untuk showcase
// komponen UI/UX, bukan untuk consume API backend.
// ============================================================================

export interface ComponentItem {
  id: string
  name: string
  description: string
  is_active: boolean
  createdAt: string
  updatedAt: string
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

export interface ComponentListResponse {
  status: string
  data: ComponentItem[]
  pagination: Pagination
}

// ============================================================================
// MOCK FUNCTIONS - Tidak melakukan API call
// ============================================================================

/**
 * Mock function - tidak melakukan API call
 */
export async function getComponentList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC'
): Promise<ComponentListResponse> {
  // Return empty/mock data
  return {
    status: 'success',
    data: [],
    pagination: {
      total: 0,
      page: 1,
      totalPages: 0,
      limit: 10,
      currentRowsCount: 0,
      next_page: null,
      prev_page: null
    }
  }
}

/**
 * Mock function - tidak melakukan API call
 */
export async function getComponentById(id: string): Promise<{ status: string; data: ComponentItem }> {
  return {
    status: 'success',
    data: {
      id: '',
      name: '',
      description: '',
      is_active: true,
      createdAt: '',
      updatedAt: ''
    }
  }
}

/**
 * Mock function - tidak melakukan API call
 */
export async function createComponent(data: Partial<ComponentItem>): Promise<{ status: string; data: ComponentItem }> {
  return {
    status: 'success',
    data: {
      id: '',
      name: '',
      description: '',
      is_active: true,
      createdAt: '',
      updatedAt: ''
    }
  }
}

/**
 * Mock function - tidak melakukan API call
 */
export async function updateComponent(id: string, data: Partial<ComponentItem>): Promise<{ status: string; data: ComponentItem }> {
  return {
    status: 'success',
    data: {
      id: '',
      name: '',
      description: '',
      is_active: true,
      createdAt: '',
      updatedAt: ''
    }
  }
}

/**
 * Mock function - tidak melakukan API call
 */
export async function deleteComponent(id: string): Promise<{ status: string; message: string }> {
  return {
    status: 'success',
    message: 'Mock delete'
  }
}

/**
 * Mock function - tidak melakukan API call
 */
export async function getComponentListNoPagination(): Promise<ComponentListResponse> {
  return {
    status: 'success',
    data: [],
    pagination: {
      total: 0,
      page: 1,
      totalPages: 0,
      limit: 10,
      currentRowsCount: 0,
      next_page: null,
      prev_page: null
    }
  }
}

