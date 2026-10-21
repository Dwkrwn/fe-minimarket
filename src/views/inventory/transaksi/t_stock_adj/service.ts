import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface StockAdjDetailItem {
  id?: string;
  t_stock_adj_id?: string;
  m_items_id: string;
  stock_gudang_id?: string;
  qty_before?: number;
  qty_after?: number;
  qty_adj: number;
  alasan_opname?: string;
  catatan_adj?: string;
  m_rak_d_id?: string;
  m_rak_d?: {
    id: string;
    kode: string;
  };
  rak_d_adj?: {
    id: string;
    kode: string;
  };
  // Backward compat
  alasan_adj?: string;
  catatan?: string;
  m_items?: {
    id: string;
    kode_item: string;
    nama_item: string;
    m_general?: {
      id: string;
      value1: string; // nama satuan
    };
    uom?: {
      id: string;
      value1: string;
    };
  };
  // Backward compatibility - backend might use different alias
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    m_general?: {
      id: string;
      value1: string;
    };
    uom?: {
      id: string;
      value1: string;
    };
  };
  item_adj?: {
    id: string;
    kode_item: string;
    nama_item: string;
    m_general?: {
      id: string;
      value1: string;
    };
    uom?: {
      id: string;
      value1: string;
    };
    mi_uom?: {
      id: string;
      value1: string;
    };
  };
  created_by?: string;
  updated_by?: string;
}

export interface StockAdjItem {
  id: string;
  no_stock_adj?: string;
  m_unit_bisnis_id: string;
  m_gudang_id?: string;
  m_rak_id?: string;
  status: string;
  tipe_referensi?: string;
  tgl_adj: string;
  catatan?: string;
  pic_adj_id?: string;
  createdAt: string;
  updatedAt: string;
  created_by?: string;
  updated_by?: string;
  // Relations
  m_unit_bisnis?: {
    id: string;
    nama_comp: string;
  };
  // Backend alias (truncated)
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
  };
  m_gudang?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  // Backend alias
  gudang_adj?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  pic_adj?: {
    id: string;
    nama_kary: string;
    kode_kary: string;
  };
  m_rak?: {
    id: string;
    nama_rak?: string;
    kode_rak?: string;
  };
  rak_adj?: {
    id: string;
    kode_rak: string;
    nama_rak: string;
    jumlah_baris?: number;
    jumlah_kolom?: number;
    is_active?: boolean;
  };
  // Detail items
  t_stock_adj_ds?: StockAdjDetailItem[];
  // Alias for compatibility
  t_stock_adj_details?: StockAdjDetailItem[];
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

export interface StockAdjListResponse {
  status: string;
  data: StockAdjItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_stock_adj data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param companyId - Filter by company (for non-super admin)
 * @returns Promise with t_stock_adj list
 */
export async function getStockAdjList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  companyId?: string,
  createdBy?: string,
  where?: string,
): Promise<StockAdjListResponse> {
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

  // Filter by company if provided (for non-super admin)
  if (companyId) {
    queryParams.append("filter_column_m_unit_bisnis_id", companyId);
  }

  // Filter by creator if provided (for regular users)
  if (createdBy) {
    queryParams.append("filter_column_created_by", createdBy);
  }

  if (where?.trim()) {
    queryParams.append("where", where.trim());
  }

  // Include relations: unit bisnis,gudang,karyawan
  queryParams.append("include", "m_unit_bisnis,m_gudang,m_kary");

  return apiCall<StockAdjListResponse>(`/dynamic/t_stock_adj?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get StockAdj by ID
 * @param id - StockAdj ID
 * @returns Promise with t_stock_adj detail
 */
export async function getStockAdjById(
  id: string,
): Promise<{ status: string; data: StockAdjItem }> {
  // Include relations: unit bisnis, gudang, dan detail items
  // m_items>m_general untuk mendapatkan satuan (backend alias sebagai uom)
  // Backend pakai alias item_adj untuk relation ke m_items
  const includes = [
    "m_unit_bisnis",
    "m_gudang",
    "m_kary",
    "m_rak",
    "t_stock_adj_d>m_items:id|kode_item|nama_item>m_general:id|value1",
    "t_stock_adj_d>m_rak_d",
    "t_stock_opname",
  ].join(",");

  return apiCall(`/dynamic/t_stock_adj/${id}?include=${includes}`, {
    method: "GET",
  });
}

/**
 * Create new StockAdj
 * @param data - t_stock_adj data
 * @returns Promise with created StockAdj
 */
export async function createStockAdj(
  data: Partial<StockAdjItem>,
): Promise<{ status: string; data: StockAdjItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_stock_adj_ds && data.t_stock_adj_ds.length > 0);
  const endpoint = hasDetails
    ? "/dynamic/t_stock_adj/with-details"
    : "/dynamic/t_stock_adj";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update StockAdj
 * @param id - StockAdj ID
 * @param data - t_stock_adj data to update
 * @returns Promise with updated StockAdj
 */
export async function updateStockAdj(
  id: string,
  data: Partial<StockAdjItem>,
): Promise<{ status: string; data: StockAdjItem }> {
  // Check if data has detail items
  const hasDetails = !!(data.t_stock_adj_ds && data.t_stock_adj_ds.length > 0);
  const endpoint = hasDetails
    ? `/dynamic/t_stock_adj/with-details/${id}`
    : `/dynamic/t_stock_adj/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Post StockAdj - Change status to POST
 */
export async function postStockAdj(
  id: string,
): Promise<{ status: string; message?: string; data?: StockAdjItem }> {
  return apiCall(`/dynamic/t_stock_adj/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "POST" }),
  });
}

/**
 * Delete StockAdj
 * @param id - StockAdj ID
 * @returns Promise with delete confirmation
 */
export async function deleteStockAdj(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_stock_adj/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all t_stock_adj data without pagination (for sidebar)
 * @returns Promise with t_stock_adj list
 */
export async function getStockAdjListNoPagination(): Promise<StockAdjListResponse> {
  return apiCall<StockAdjListResponse>(
    "/dynamic/t_stock_adj?no_pagination=true",
    {
      method: "GET",
    },
  );
}

// ============================================================================
// STOCK ADJ DETAIL — FUNGSI UNTUK FITUR HISTORY OPNAME
// ============================================================================

export interface StockAdjDetailListResponse {
  status: string;
  data: StockAdjDetailItem[];
}

/**
 * Mengambil detail adjustment (t_stock_adj_d) berdasarkan stock_opname_id.
 * Dipakai untuk mengecek apakah suatu opname detail sudah ada adjustmentnya.
 * @param stockOpnameId - t_stock_opname.id
 */
export async function getAdjustmentByOpname(
  stockOpnameId: string,
): Promise<StockAdjDetailListResponse> {
  const queryParams = new URLSearchParams({
    no_pagination: "true",
    "filter_column_t_stock_adj.stock_opname_id": stockOpnameId,
    "filter_operator_t_stock_adj.stock_opname_id": "=",
    include: "t_stock_adj",
  });

  return apiCall<StockAdjDetailListResponse>(
    `/dynamic/t_stock_adj_d?${queryParams}`,
    { method: "GET" },
  );
}

/**
 * Approve StockAdj - POST to custom endpoint
 * Handles both notification update and record status update
 * Supports Super Admin flow (null notifikasi id, fallback user id)
 */
export async function approveStockAdj(
  t_stock_adj_id: string,
  t_stock_adj_notifikasi_id: string | null,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: any }> {
  // Get approval config for MENYETUJUI path
  let approvalData: {
    level: number;
    sender_id: string;
    id: string | null;
  } | null = null;
  try {
    const approvalListStr = localStorage.getItem("approval_list");
    const authData = localStorage.getItem("auth_bb");
    if (approvalListStr && authData) {
      const approvalList = JSON.parse(approvalListStr);
      const auth = JSON.parse(authData);
      const found = approvalList.find(
        (a: any) =>
          a.path === "/inventory/transaksi/t_stock_adj" &&
          a.tipe_approve?.toUpperCase() === "MENYETUJUI",
      );
      if (found) {
        approvalData = {
          level: found.level,
          sender_id: auth.user?.id || "",
          id: found.id || null,
        };
      }
    }
  } catch {
    // ignore
  }

  // Fallback user id for Super Admin (no MENYETUJUI config)
  let fallbackUserId: string | null = null;
  if (!approvalData) {
    try {
      const authData = localStorage.getItem("auth_bb");
      if (authData) {
        const auth = JSON.parse(authData);
        fallbackUserId = auth.user?.id || null;
      }
    } catch {
      // ignore
    }
  }

  return apiCall(`/fn/t_stock_adj/approve`, {
    method: "POST",
    body: JSON.stringify({
      t_stock_adj_id,
      t_stock_adj_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}
