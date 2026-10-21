import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface SjGudangDetailItem {
  id?: string;
  t_sj_gudang_id?: string;
  m_items_id?: string;
  qty_sj_gudang?: number;
  berat?: number;
  berat_aktual?: number;
  catatan?: string;
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
  };
  created_by?: string;
  updated_by?: string;
}

export interface SjGudangItem {
  id: string;
  no_sj_gudang?: string;
  m_unit_bisnis_id: string;
  status: string;
  status_pengiriman_id?: string;
  tipe_sj_gudang?: string;
  tgl_sj_gudang: string;
  total_berat?: number;
  t_transfer_gudang_id?: string;
  is_ekspedisi?: boolean;
  supir?: string;
  m_kendaraan_id?: string;
  ekspedisi_id?: string;
  no_resi?: string;
  bukti_foto?: string;
  catatan?: string;
  warehouse_asal_id?: string;
  warehouse_terima_id?: string;
  m_pic_id?: string;
  createdAt: string;
  updatedAt: string;
  created_by?: string;
  updated_by?: string;
  // Relations
  m_unit_bisnis?: {
    id: string;
    nama_comp: string;
    m_company?: {
      id?: string;
      nama?: string;
      logo_img?: string | null;
      alamat?: string | null;
      kecamatan?: string | null;
      kota?: string | null;
      provinsi?: string | null;
      kode_pos?: string | number | null;
    } | null;
  };
  as_unit?: {
    id: string;
    nama_comp: string;
    m_company?: {
      id?: string;
      nama?: string;
      logo_img?: string | null;
      alamat?: string | null;
      kecamatan?: string | null;
      kota?: string | null;
      provinsi?: string | null;
      kode_pos?: string | number | null;
    } | null;
  };
  t_transfer_gudang?: {
    id: string;
    no_tw: string;
    warehouse_asal_id?: string;
    warehouse_asal?: {
      id: string;
      nama_gudang: string;
    };
    warehouse_tujuan?: {
      id: string;
      nama_gudang: string;
    };
    m_kary?: {
      id: string;
      nama_kary: string;
    };
    pic?: {
      id: string;
      nama_kary: string;
    };
  };
  no_tg?: {
    id: string;
    no_tw: string;
    m_gudang_id?: string;
    warehouse_asal_id?: string;
    warehouse_asal?: {
      id: string;
      nama_gudang: string;
    };
    warehouse_tujuan?: {
      id: string;
      nama_gudang: string;
    };
  };
  m_kendaraan?: {
    id: string;
    nama_kendaraan: string;
    no_polisi: string;
  };
  ekspedisi?: {
    id: string;
    value1: string;
  };
  status_pengiriman?: {
    id: string;
    value1: string;
  };
  pic?: {
    id: string;
    nama_kary: string;
  };
  m_kary?: {
    id: string;
    nama_kary: string;
  };
  sj_gd_asl?: {
    id: string;
    nama_gudang: string;
  };
  sj_gd_trm?: {
    id: string;
    nama_gudang: string;
  };
  kendaraan_sj_gudang?: {
    id: string;
    nama_kendaraan: string;
    no_polisi: string;
  };
  gudang_sj_tujuan?: {
    id: string;
    nama_gudang: string;
  };
  user_default?: {
    id: string;
    name: string;
    email: string;
  };
  default_user?: {
    id: string;
    name: string;
    email: string;
  };
  // Detail items
  t_sj_gudang_ds?: SjGudangDetailItem[];
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

export interface SjGudangListResponse {
  status: string;
  data: SjGudangItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_sj_gudang data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param companyId - Company ID to filter by (for non-super admin users)
 * @returns Promise with t_sj_gudang list
 */
export async function getSjGudangList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  companyId?: string,
  where?: string,
  columnFilters?: Record<string, string>,
): Promise<SjGudangListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  // Filter by company for non-super admin users
  if (companyId) {
    queryParams.append("filter_column_m_unit_bisnis_id", companyId);
  }

  if (where?.trim()) {
    queryParams.append("where", where.trim());
  }

  // Apply direct column filters (non-relation fields)
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value?.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim());
      }
    });
  }

  // Include relations for display in table (API will return with alias: as_unit, no_tg, etc)
  // Also include detail items with their relations
  queryParams.append(
    "include",
    "m_unit_bisnis,m_unit_bisnis>m_company,t_transfer_gudang,m_kendaraan,m_general,m_gudang,t_sj_gudang_d>m_rak,t_sj_gudang_d>m_rak_d,t_sj_gudang_d>t_transfer_gudang_d>m_items>m_general",
  );

  return apiCall<SjGudangListResponse>(`/dynamic/t_sj_gudang?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get SjGudang by ID
 * @param id - SjGudang ID
 * @returns Promise with t_sj_gudang detail
 */
export async function getSjGudangById(
  id: string,
): Promise<{ status: string; data: SjGudangItem }> {
  // Include relations - backend will return with alias (as_unit, no_tg, etc)
  const includes =
    "m_unit_bisnis,m_unit_bisnis>m_company,t_transfer_gudang,t_transfer_gudang>m_gudang,t_transfer_gudang>m_kary,m_kendaraan,m_general,t_sj_gudang_d>m_rak,t_sj_gudang_d>m_rak_d,t_sj_gudang_d>t_transfer_gudang_d>m_items>m_general,user_default";

  return apiCall(`/dynamic/t_sj_gudang/${id}?join=true&include=${encodeURIComponent(includes)}`, {
    method: "GET",
  });
}

/**
 * Create new SjGudang
 * @param data - t_sj_gudang data
 * @returns Promise with created SjGudang
 */
export async function createSjGudang(
  data: Partial<SjGudangItem>,
): Promise<{ status: string; data: SjGudangItem }> {
  // Check if data has detail items
  const hasDetails = !!data.t_sj_gudang_ds;
  const endpoint = hasDetails
    ? "/dynamic/t_sj_gudang/with-details"
    : "/dynamic/t_sj_gudang";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update SjGudang
 * @param id - SjGudang ID
 * @param data - t_sj_gudang data to update
 * @returns Promise with updated SjGudang
 */
export async function updateSjGudang(
  id: string,
  data: Partial<SjGudangItem>,
): Promise<{ status: string; data: SjGudangItem }> {
  // Check if data has detail items
  const hasDetails = !!data.t_sj_gudang_ds;
  const endpoint = hasDetails
    ? `/dynamic/t_sj_gudang/with-details/${id}`
    : `/dynamic/t_sj_gudang/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Post SjGudang - Change status to POST using custom function
 * @param id - SjGudang ID
 * @param details - Array of detail items with m_items_id and qty_sj
 * @param gudangAsalId - UUID gudang asal dari transfer gudang
 * @returns Promise with post confirmation
 */
export async function postSjGudang(
  id: string,
  details: Array<{ m_items_id: string; qty_sj: number }>,
  gudangAsalId: string,
): Promise<{
  status?: string;
  message?: string;
  error?: string;
  reason?: string;
  data?: any;
}> {
  return apiCall(`/fn/t_sj_gudang/PostData`, {
    method: "POST",
    body: JSON.stringify({
      t_sj_gudang_id: id,
      t_sj_gudang_ds: details,
      gudang_asal_id: gudangAsalId,
    }),
  });
}

export async function updateStatusPengirimanSjGudang(
  t_sj_gudang_id: string,
  status_pengiriman_id: string,
): Promise<{
  status?: string;
  message?: string;
  error?: string;
  reason?: string;
  data?: {
    t_sj_gudang_id: string;
    status: string;
    status_pengiriman_id: string;
    status_pengiriman?: {
      id: string;
      value1: string;
    };
  };
}> {
  return apiCall(`/fn/t_sj_gudang/updateStatusPengiriman`, {
    method: "POST",
    body: JSON.stringify({
      t_sj_gudang_id,
      status_pengiriman_id,
    }),
  });
}

/**
 * Delete SjGudang
 * @param id - SjGudang ID
 * @returns Promise with delete confirmation
 */
export async function deleteSjGudang(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_sj_gudang/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Sync stock from SJ Gudang to stock_gudang_d
 * @returns Promise with sync result
 */
export async function syncStockFromSjGudang(): Promise<{
  status: string;
  message: string;
  data?: any;
}> {
  return apiCall(`/fn/t_sj_gudang/syncStockFromSjGudang`, {
    method: "POST",
  });
}

/**
 * Get all t_sj_gudang data without pagination (for sidebar)
 * @returns Promise with t_sj_gudang list
 */
export async function getSjGudangListNoPagination(): Promise<SjGudangListResponse> {
  return apiCall<SjGudangListResponse>(
    "/dynamic/t_sj_gudang?no_pagination=true",
    {
      method: "GET",
    },
  );
}
