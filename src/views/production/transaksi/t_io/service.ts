import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES
// ============================================================================

export interface IoItemDetail {
  id?: string
  t_io_id?: string
  sequence?: number
  item_type_id?: string
  m_item_id?: string
  qty?: number | string
  unit_id?: string
  unit_name?: string
  target_date?: string
  qty_spk?: number | string
  notes?: string
  m_item?: any
  m_general?: any // for item_type or unit lookup
  m_general_item_type?: any
  m_general_unit?: any
}

export interface IoItem {
  id: string
  m_unit_bisnis_id?: string
  pic_id?: string
  date?: string
  no?: string
  notes?: string
  status?: string
  t_io_ds?: IoItemDetail[]
  m_unit_bisni?: any
  m_kary?: any
  createdAt?: string
  updatedAt?: string
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

export interface IoListResponse {
  status: string
  data: IoItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_io data
 */
export async function getIoList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  where?: string
): Promise<IoListResponse> {
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

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });
  }

  if (where) {
    queryParams.append('where', where);
  }

  if (filterCreatedBy) {
    queryParams.append('filter_column_created_by', filterCreatedBy)
  }
  
  return apiCall<IoListResponse>(`/dynamic/t_io?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get Io by ID
 */
export async function getIoById(id: string): Promise<{ status: string; data: IoItem }> {
  return apiCall(`/dynamic/t_io/${id}?join=all,sub`, {
    method: 'GET'
  })
}

/**
 * Create new Io
 */
export async function createIo(data: Partial<IoItem>): Promise<{ status: string; data: IoItem }> {
  return apiCall('/dynamic/t_io/with-details', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update Io
 */
export async function updateIo(id: string, data: Partial<IoItem>): Promise<{ status: string; data: IoItem }> {
  return apiCall(`/dynamic/t_io/with-details/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * Delete Io
 */
export async function deleteIo(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_io/with-details/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Get all t_io data without pagination (for sidebar)
 */
export async function getIoListNoPagination(): Promise<IoListResponse> {
  return apiCall<IoListResponse>('/dynamic/t_io?no_pagination=true', {
    method: 'GET'
  })
}
