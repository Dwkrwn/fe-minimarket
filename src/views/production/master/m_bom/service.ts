import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface BomItem {
  id: string;
  no?: string;
  flag?: string;
  type?: 'GENERAL' | 'CHEMICAL' | 'SPESIFIK' | string;
  tipe: string;
  key1: string;
  code: string;
  value1: string;
  value2: string;
  value3: string;
  value4: string;
  value5: string;
  notes?: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  versi: string;
  // Detail items (optional - only if module has details)
  m_general: any;
  m_item?: any;
  m_bom_details?: any[];
  m_bom_details2?: any[];
  // New structure
  m_bom_d_routings?: any[];
  m_bom_sd_materials?: any[];
  m_bom_sd_material?: any;
  m_bom_d_coproducts?: any[];
  m_bom_d_speks?: any[];
  m_bom_d_formula?: any;
  m_bom_d_formulas?: any[];
  t_precost_id?: string;
  t_precost?: any;
  date?: string;
  status?: boolean;
  batch_weight?: number;
  base_resin?: number;
  total_volume?: number;
  sg_compound?: number;
  total_biaya_material?: number;
  harga_per_kg_compound?: number;
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentRowsCount: number;
  next_page: number | null;
  prev_page: number | null;
}

export interface BomListResponse {
  status: string;
  data: BomItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_bom data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_bom list
 */
export async function getBomList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string,
): Promise<BomListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: 'm_items'
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
      }
    });
  }

  if (filterOperators) {
    Object.entries(filterOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value);
      }
    });
  }

  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<BomListResponse>(`/dynamic/m_bom?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get Bom by ID
 * @param id - Bom ID
 * @returns Promise with m_bom detail
 */
export async function getBomById(
  id: string,
): Promise<{ status: string; data: BomItem }> {
  const includeParams = [
    'm_items',
    'm_general',
    'm_bom_d_routing>m_mesin',
    'm_bom_d_routing>m_routing',
    'm_bom_d_routing>m_general',
    'm_bom_sd_material>m_items',
    'm_bom_sd_material>m_general',
    'm_bom_d_formula',
  ].join(",")
  return apiCall(`/dynamic/m_bom/${id}?include=${includeParams}`, {
    method: "GET",
  });
}

/**
 * Create new Bom
 * @param data - m_bom data
 * @returns Promise with created Bom
 */
export async function createBom(
  data: Partial<BomItem>,
): Promise<{ status: string; data: BomItem }> {
  return apiCall("/fn/m_bom/saveBom", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update Bom
 * @param id - Bom ID
 * @param data - m_bom data to update
 * @returns Promise with updated Bom
 */
export async function updateBom(
  id: string,
  data: Partial<BomItem>,
): Promise<{ status: string; data: BomItem }> {
  return apiCall("/fn/m_bom/saveBom", {
    method: "POST",
    body: JSON.stringify({ ...data, id }),
  });
}

/**
 * Check if a Bom has been used in Work Orders (APPROVED/POSTED)
 * @param id - Bom ID
 * @returns Promise with boolean indicating usage
 */
export async function isBomUsed(id: string): Promise<boolean> {
  const params = new URLSearchParams({ bom_id: id });
  const res = await apiCall<
    { isUsed?: boolean; usedIn?: string[]; data?: { isUsed?: boolean } }
  >(`/fn/m_bom/isBomUsed?${params}`, {
    method: "GET",
  });
  return res?.isUsed === true || res?.data?.isUsed === true;
}

/**
 * Delete Bom
 * @param id - Bom ID
 * @returns Promise with delete confirmation
 */
export async function deleteBom(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_bom/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all m_bom data without pagination (for sidebar)
 * @returns Promise with m_bom list
 */
export async function getBomListNoPagination(): Promise<BomListResponse> {
  return apiCall<BomListResponse>("/dynamic/m_bom?no_pagination=true", {
    method: "GET",
  });
}
