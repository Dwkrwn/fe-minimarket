import { apiCall } from '@/lib/api'

// ============================================================================
// INTERFACES - Nested Structure
// ============================================================================

// Level 5: Batch (deepest)
export interface GroupBatch {
  id?: string
  m_group_ukuran_id?: string
  nama_batch?: string
  catatan?: string
  is_active: boolean
  createdAt?: string
  updatedAt?: string
}

// Level 4: Ukuran
export interface GroupUkuran {
  id?: string
  m_group_tipe_id?: string
  nama_ukuran?: string
  catatan?: string
  is_active: boolean
  m_group_batchs?: GroupBatch[]
  createdAt?: string
  updatedAt?: string
}

// Level 3: Tipe
export interface GroupTipe {
  id?: string
  m_group_merek_id?: string
  nama_tipe?: string
  catatan?: string
  is_active: boolean
  m_group_ukurans?: GroupUkuran[]
  createdAt?: string
  updatedAt?: string
}

// Level 2: Merek
export interface GroupMerek {
  id?: string
  m_group_jenis_id?: string
  nama_merek?: string
  catatan?: string
  is_active: boolean
  m_group_tipes?: GroupTipe[]
  createdAt?: string
  updatedAt?: string
}

// Level 1: Jenis (root)
export interface ItemGroupItem {
  id?: string
  nama_jenis?: string
  catatan?: string
  is_active: boolean
  m_group_mereks?: GroupMerek[]
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

export interface ItemGroupListResponse {
  status: string
  data: ItemGroupItem[]
  pagination: Pagination
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_group_jenis (root level) with optional nested includes
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param includeNested - Include nested relations (merek>tipe>ukuran>batch)
 * @returns Promise with m_group_jenis list
 */
export async function getItemGroupList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC',
  search?: string,
  searchfield?: string,
  includeNested: boolean = false
): Promise<ItemGroupListResponse> {
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
  
  // Include nested relations if requested
  if (includeNested) {
    queryParams.append('include', 'm_group_merek>m_group_tipe>m_group_ukuran>m_group_batch')
  }
  
  return apiCall<ItemGroupListResponse>(`/dynamic/m_group_jenis?${queryParams}`, {
    method: 'GET'
  })
}

/**
 * Get ItemGroup by ID with all nested relations
 * Uses custom nested endpoint for proper hierarchy
 * @param id - m_group_jenis ID
 * @returns Promise with m_group_jenis detail with nested merek>tipe>ukuran>batch
 */
export async function getItemGroupById(id: string): Promise<{ message: string; data: ItemGroupItem }> {
  return apiCall(`/fn/m_group_jenis/getNestedById?id=${id}`, {
    method: 'GET'
  })
}

/**
 * Create new ItemGroup (Jenis with nested Merek/Tipe/Ukuran/Batch)
 * Uses custom nested create endpoint
 * @param data - m_group_jenis data with nested arrays
 * @returns Promise with created ItemGroup
 */
export async function createItemGroup(data: Partial<ItemGroupItem>): Promise<{ status: string; data: ItemGroupItem }> {
  return apiCall('/fn/m_group_jenis/createNested', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Update ItemGroup (Jenis with nested Merek/Tipe/Ukuran/Batch)
 * Uses custom nested update endpoint
 * @param id - m_group_jenis ID
 * @param data - m_group_jenis data to update with nested arrays
 * @returns Promise with updated ItemGroup
 */
export async function updateItemGroup(id: string, data: Partial<ItemGroupItem>): Promise<{ status: string; data: ItemGroupItem }> {
  return apiCall(`/fn/m_group_jenis/updateNested?id=${id}`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * Delete single batch by ID
 * @param id - m_group_batch ID
 */
export async function deleteGroupBatch(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_group_batch/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Delete single ukuran by ID
 * @param id - m_group_ukuran ID
 */
export async function deleteGroupUkuran(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_group_ukuran/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Delete single tipe by ID
 * @param id - m_group_tipe ID
 */
export async function deleteGroupTipe(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_group_tipe/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Delete single merek by ID
 * @param id - m_group_merek ID
 */
export async function deleteGroupMerek(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_group_merek/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Delete single jenis by ID
 * @param id - m_group_jenis ID
 */
export async function deleteGroupJenis(id: string): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_group_jenis/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Delete result interface for cascade delete
 */
export interface DeleteCascadeResult {
  success: boolean
  message: string
  deletedCounts: {
    batch: number
    ukuran: number
    tipe: number
    merek: number
    jenis: number
  }
  errors: string[]
}

/**
 * Interface for collected IDs to delete
 */
interface DeleteItemsCollection {
  batchIds: { id: string; nama: string }[]
  ukuranIds: { id: string; nama: string }[]
  tipeIds: { id: string; nama: string }[]
  merekIds: { id: string; nama: string }[]
  jenisId: { id: string; nama: string } | null
}

/**
 * Validate and collect all IDs from nested item
 * Returns null if validation fails (missing required IDs)
 */
function collectDeleteIds(item: ItemGroupItem): { valid: boolean; items: DeleteItemsCollection; errors: string[] } {
  const items: DeleteItemsCollection = {
    batchIds: [],
    ukuranIds: [],
    tipeIds: [],
    merekIds: [],
    jenisId: null
  }
  const errors: string[] = []

  // Validate jenis (root) has ID
  if (!item.id) {
    errors.push('Jenis tidak memiliki ID yang valid')
    return { valid: false, items, errors }
  }
  items.jenisId = { id: item.id, nama: item.nama_jenis || 'Unknown' }

  // Collect and validate all nested IDs
  for (const merek of item.m_group_mereks || []) {
    if (!merek.id) {
      errors.push(`Merek "${merek.nama_merek || 'Unknown'}" tidak memiliki ID yang valid`)
      continue
    }
    items.merekIds.push({ id: merek.id, nama: merek.nama_merek || 'Unknown' })

    for (const tipe of merek.m_group_tipes || []) {
      if (!tipe.id) {
        errors.push(`Tipe "${tipe.nama_tipe || 'Unknown'}" tidak memiliki ID yang valid`)
        continue
      }
      items.tipeIds.push({ id: tipe.id, nama: tipe.nama_tipe || 'Unknown' })

      for (const ukuran of tipe.m_group_ukurans || []) {
        if (!ukuran.id) {
          errors.push(`Ukuran "${ukuran.nama_ukuran || 'Unknown'}" tidak memiliki ID yang valid`)
          continue
        }
        items.ukuranIds.push({ id: ukuran.id, nama: ukuran.nama_ukuran || 'Unknown' })

        for (const batch of ukuran.m_group_batchs || []) {
          if (!batch.id) {
            errors.push(`Batch "${batch.nama_batch || 'Unknown'}" tidak memiliki ID yang valid`)
            continue
          }
          items.batchIds.push({ id: batch.id, nama: batch.nama_batch || 'Unknown' })
        }
      }
    }
  }

  // If any errors found during validation, return invalid
  if (errors.length > 0) {
    return { valid: false, items, errors }
  }

  return { valid: true, items, errors: [] }
}

/**
 * Delete ItemGroup (Jenis) with cascade delete all nested items
 * VALIDATES ALL IDs FIRST before starting delete
 * Deletes in order: batch → ukuran → tipe → merek → jenis
 * Hits API one by one for each item
 * @param item - ItemGroupItem with full nested data
 * @returns Promise with delete result including counts and errors
 */
export async function deleteItemGroupCascade(item: ItemGroupItem): Promise<DeleteCascadeResult> {
  const result: DeleteCascadeResult = {
    success: false,
    message: '',
    deletedCounts: {
      batch: 0,
      ukuran: 0,
      tipe: 0,
      merek: 0,
      jenis: 0
    },
    errors: []
  }

  // ============================================================================
  // PHASE 1: VALIDATE - Collect and validate all IDs first
  // ============================================================================
  const validation = collectDeleteIds(item)
  
  if (!validation.valid) {
    result.success = false
    result.message = 'Validasi gagal: ' + validation.errors.join(', ')
    result.errors = validation.errors
    return result
  }

  const { items } = validation

  // Log what will be deleted
  console.log('Delete validation passed. Items to delete:', {
    jenis: items.jenisId?.nama,
    merek: items.merekIds.length,
    tipe: items.tipeIds.length,
    ukuran: items.ukuranIds.length,
    batch: items.batchIds.length
  })

  // ============================================================================
  // PHASE 2: DELETE - All IDs validated, now proceed with deletion
  // ============================================================================
  try {
    // Step 1: Delete all batches first (deepest level)
    for (const batch of items.batchIds) {
      const response = await deleteGroupBatch(batch.id)
      if (response.status === 'success' || response.status === 'Success') {
        result.deletedCounts.batch++
      } else {
        throw new Error(`Gagal hapus Batch "${batch.nama}": ${response.message || 'Unknown error'}`)
      }
    }

    // Step 2: Delete all ukurans
    for (const ukuran of items.ukuranIds) {
      const response = await deleteGroupUkuran(ukuran.id)
      if (response.status === 'success' || response.status === 'Success') {
        result.deletedCounts.ukuran++
      } else {
        throw new Error(`Gagal hapus Ukuran "${ukuran.nama}": ${response.message || 'Unknown error'}`)
      }
    }

    // Step 3: Delete all tipes
    for (const tipe of items.tipeIds) {
      const response = await deleteGroupTipe(tipe.id)
      if (response.status === 'success' || response.status === 'Success') {
        result.deletedCounts.tipe++
      } else {
        throw new Error(`Gagal hapus Tipe "${tipe.nama}": ${response.message || 'Unknown error'}`)
      }
    }

    // Step 4: Delete all mereks
    for (const merek of items.merekIds) {
      const response = await deleteGroupMerek(merek.id)
      if (response.status === 'success' || response.status === 'Success') {
        result.deletedCounts.merek++
      } else {
        throw new Error(`Gagal hapus Merek "${merek.nama}": ${response.message || 'Unknown error'}`)
      }
    }

    // Step 5: Finally delete the jenis (root)
    if (items.jenisId) {
      const response = await deleteGroupJenis(items.jenisId.id)
      if (response.status === 'success' || response.status === 'Success') {
        result.deletedCounts.jenis++
      } else {
        throw new Error(`Gagal hapus Jenis "${items.jenisId.nama}": ${response.message || 'Unknown error'}`)
      }
    }

    result.success = true
    result.message = `Berhasil menghapus: ${result.deletedCounts.jenis} Jenis, ${result.deletedCounts.merek} Merek, ${result.deletedCounts.tipe} Tipe, ${result.deletedCounts.ukuran} Ukuran, ${result.deletedCounts.batch} Batch`

  } catch (error) {
    result.success = false
    result.message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus'
    result.errors.push(result.message)
  }

  return result
}

// Response interface for nested endpoint
export interface ItemGroupNestedResponse {
  message: string
  data: ItemGroupItem[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Get all m_group_jenis with nested relations using custom endpoint
 * Uses /fn/m_group_jenis/getNested for proper nested hierarchy
 * @param noPagination - Skip pagination (default: true for landing)
 * @returns Promise with m_group_jenis list with nested merek>tipe>ukuran>batch
 */
export async function getItemGroupNestedList(noPagination: boolean = true): Promise<ItemGroupNestedResponse> {
  const params = new URLSearchParams()
  if (noPagination) {
    params.append('no_pagination', 'true')
  }
  
  return apiCall<ItemGroupNestedResponse>(`/fn/m_group_jenis/getNested?${params}`, {
    method: 'GET'
  })
}

/**
 * Get all m_group_jenis without pagination (for dropdowns)
 * @param includeNested - Include nested relations
 * @returns Promise with m_group_jenis list
 */
export async function getItemGroupListNoPagination(includeNested: boolean = false): Promise<ItemGroupListResponse> {
  const params = new URLSearchParams({ no_pagination: 'true' })
  
  if (includeNested) {
    params.append('include', 'm_group_merek>m_group_tipe>m_group_ukuran>m_group_batch')
  }
  
  return apiCall<ItemGroupListResponse>(`/dynamic/m_group_jenis?${params}`, {
    method: 'GET'
  })
}
