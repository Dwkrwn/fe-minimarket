import { apiCall } from "@/lib/api";
import { type ItemsItem } from "@/views/inventory/master/m_items/service";

// ============================================================================
// INTERFACES
// ============================================================================

export interface StockOpnameDetailItem {
  id?: string;
  t_stock_opname_id?: string;
  m_items_id: string;
  stock_gudang_id?: string;
  qty_system: number;
  qty_opname: number;
  qty_selisih?: number;
  m_rak_d_id?: string;
  m_rak_d?: {
    id: string;
    kode: string;
    baris?: number;
    kolom?: number;
    m_rak_id?: string;
  };
  rak_d_opname?:  {
    id: string;
    kode: string;
    baris?: number;
    kolom?: number;
    m_rak_id?: string;
  };
  is_checking: boolean;
  catatan?: string;
  // Backend uses item_opname alias
  item_opname?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
    mi_uom?: {
      id: string;
      value1: string;
    };
    m_general?: {
      id: string;
      value1: string;
    };
  };
  // Fallback to m_item
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
    uom?: {
      id: string;
      value1: string;
    };
    m_general?: {
      id: string;
      value1: string;
    };
  };
  // Item lock data (available when is_checking = true)
  itemLock?:
    | {
        id: string;
        m_gudang_id: string;
        free_stock: number;
        m_items_id: string;
        m_unit_bisnis_id: string;
        m_rak_d_id: string;
        is_opname: boolean;
        createdAt: string;
        updatedAt: string;
        m_item?: ItemsItem;
        m_rak_d?: {
          id: string;
          kode: string;
          baris?: number;
          kolom?: number;
          m_rak_id?: string;
          m_rak?: {
            id: string;
            nama_rak?: string;
            kode_rak?: string;
          };
        };
      }[]
    | null;
  created_by?: string;
  updated_by?: string;
}

export interface StockOpnameItem {
  id: string;
  no_stock_opname?: string;
  m_unit_bisnis_id: string;
  m_gudang_id?: string;
  m_rak_id?: string;
  t_stock_opname_periode_id?: string;
  status: string;
  status_checking?: string;
  tgl_opname: string;
  catatan?: string;
  pic_opname_id?: string;
  createdAt: string;
  updatedAt: string;
  created_by?: string;
  updated_by?: string;
  // Relations - backend uses these aliases
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
  };
  gudang_opname?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  pic_opname?: {
    id: string;
    nama_kary: string;
    kode_kary: string;
  };
  rak_opname?: {
    id: string;
    nama_rak: string;
    kode_rak: string;
    jumlah_baris?: number;
    jumlah_kolom?: number;
    is_active?: boolean;
  };
  periode_opname?: {
    id: string;
    no_periode_opname?: string;
    tgl_mulai?: string;
    tgl_akhir?: string;
    is_locked?: boolean;
  };
  t_stock_opname_periode?: {
    id: string;
    no_periode_opname?: string;
    tgl_mulai?: string;
    tgl_akhir?: string;
    is_locked?: boolean;
  };
  // Detail items
  t_stock_opname_ds?: StockOpnameDetailItem[];
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

export interface StockOpnameListResponse {
  status: string;
  data: StockOpnameItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const normalizeWhereFilter = (where: string) => {
  return where
    .split("|")
    .map((condition) => {
      const trimmedCondition = condition.trim();

      if (
        !trimmedCondition ||
        trimmedCondition.includes(":") ||
        trimmedCondition.includes(">") ||
        trimmedCondition.includes("<")
      ) {
        return trimmedCondition;
      }

      const equalIndex = trimmedCondition.indexOf("=");
      if (equalIndex <= 0) {
        return trimmedCondition;
      }

      const field = trimmedCondition.slice(0, equalIndex).trim();
      const value = trimmedCondition.slice(equalIndex + 1).trim();

      return field && value ? `${field}:${value}` : trimmedCondition;
    })
    .filter(Boolean)
    .join("|");
};

/**
 * Get all t_stock_opname data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_stock_opname list
 */
export async function getStockOpnameList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  companyId?: string,
  createdBy?: string,
  where?: string,
  filterParams?: Record<string, string | number | boolean>,
): Promise<StockOpnameListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    join: "true",
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

  if (filterParams) {
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
  }

  if (where?.trim()) {
    queryParams.append("where", normalizeWhereFilter(where));
  }

  // Include relations: unit bisnis, gudang (warehouse), pic (m_kary), dan detail items untuk status_checking
  queryParams.append(
    "include",
    "m_unit_bisnis,m_gudang,m_kary,m_rak,t_stock_opname_periode,t_stock_opname_d",
  );

  return apiCall<StockOpnameListResponse>(
    `/dynamic/t_stock_opname?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get StockOpname by ID
 * @param id - StockOpname ID
 * @returns Promise with t_stock_opname detail
 */
export async function getStockOpnameById(
  id: string,
): Promise<{ status: string; data: StockOpnameItem }> {
  // Include relations: unit bisnis, gudang, pic, dan detail items
  // Backend uses alias: m_unit_bisni, gudang_opname, pic_opname, item_opname
  const includes = [
    "m_unit_bisnis",
    "m_gudang",
    "m_kary",
    "m_rak",
    "t_stock_opname_periode",
    "t_stock_opname_d>m_items:id|kode_item|nama_item>m_general:id|value1",
    "t_stock_opname_d>m_rak_d",
    "t_stock_opname_d>stock_gudang:id",
  ].join(",");

  return apiCall(`/dynamic/t_stock_opname/${id}?include=${includes}`, {
    method: "GET",
  });
}

/**
 * Create new StockOpname
 * @param data - t_stock_opname data
 * @returns Promise with created StockOpname
 */
export async function createStockOpname(
  data: Partial<StockOpnameItem>,
): Promise<{ status: string; data: StockOpnameItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_stock_opname_ds && data.t_stock_opname_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_stock_opname/with-details"
    : "/dynamic/t_stock_opname";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update StockOpname
 * @param id - StockOpname ID
 * @param data - t_stock_opname data to update
 * @returns Promise with updated StockOpname
 */
export async function updateStockOpname(
  id: string,
  data: Partial<StockOpnameItem>,
): Promise<{ status: string; data: StockOpnameItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_stock_opname_ds && data.t_stock_opname_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_stock_opname/with-details/${id}`
    : `/dynamic/t_stock_opname/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getApprovalByPath(
  path: string,
): { level: number; sender_id: string; id: string | null } | null {
  const approvalListStr = localStorage.getItem("approval_list");
  const authData = localStorage.getItem("auth_bb");

  if (!approvalListStr || !authData) return null;

  try {
    const approvalList = JSON.parse(approvalListStr);
    const auth = JSON.parse(authData);

    const approval = approvalList.find(
      (a: any) =>
        a.path === path && a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!approval) return null;

    return {
      level: approval.level,
      sender_id: auth.user?.id || "",
      id: approval.id || null,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Approve StockOpname - single endpoint for all flows.
 * user_approved_id dan sender_id pakai approvalData.sender_id jika ada,
 * fallback ke current user ID dari auth_bb (untuk Super Admin).
 */
export async function approveStockOpname(
  t_stock_opname_id: string,
  t_stock_opname_notifikasi_id: string | null,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: any }> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_stock_opname");

  // Fallback: jika tidak ada MENYETUJUI config (misal Super Admin),
  // tetap kirim user ID agar backend tahu siapa yang menyetujui
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

  return apiCall(`/fn/t_stock_opname/approve`, {
    method: "POST",
    body: JSON.stringify({
      t_stock_opname_id,
      t_stock_opname_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}

/**
 * Delete StockOpname
 * @param id - StockOpname ID
 * @returns Promise with delete confirmation
 */
export async function deleteStockOpname(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_stock_opname/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all t_stock_opname data without pagination (for sidebar)
 * @returns Promise with t_stock_opname list
 */
export async function getStockOpnameListNoPagination(): Promise<StockOpnameListResponse> {
  return apiCall<StockOpnameListResponse>(
    "/dynamic/t_stock_opname?no_pagination=true",
    {
      method: "GET",
    },
  );
}

/**
 * Get history stock opname filtered by rak (master rak ID)
 * @param rakId - m_rak.id (master rak)
 * @returns Promise with stock opname list including detail items
 */
export async function getHistoryOpnameByRak(
  rakId: string,
  page: number = 1,
  paginate: number = 5,
): Promise<StockOpnameListResponse> {
  const queryParams = new URLSearchParams({
    no_pagination: "false",
    order_by: "createdAt",
    order_type: "DESC",
    page: page.toString(),
    paginate: paginate.toString(),
    "filter_column_m_rak_id": rakId,
  });

  return apiCall<StockOpnameListResponse>(
    `/fn/t_stock_opname/getHistoryOpname?${queryParams}`,
    { method: "GET" },
  );
}
