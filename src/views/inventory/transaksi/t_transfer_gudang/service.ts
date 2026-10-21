import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export type TransferGudangType = "langsung" | "opname" | string;

export interface TransferGudangDetailItem {
  id?: string;
  t_transfer_gudang_id?: string;
  stock_opname_d_id?: string | null;
  m_items_id: string;
  qty: number;
  // Wireframe columns
  rak_asal_id?: string | null;
  rak_asal_d_id?: string | null;
  rak_tujuan_id?: string | null;
  rak_tujuan_d_id?: string | null;
  // Backward compatibility fields used in form
  m_rak_id?: string | null;
  m_rak_d_id?: string | null;
  rak_tujuan?: string;
  catatan?: string;
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
  };
  rak_asal?: {
    id: string;
    nama_rak: string;
    kode_rak: string;
  };
  rak_tujuan_rel?: {
    id: string;
    nama_rak: string;
    kode_rak: string;
  };
  rak_asal_d?: {
    id: string;
    kode: string;
    baris?: number;
    kolom?: number;
    m_rak_id?: string;
  };
  rak_tujuan_d?: {
    id: string;
    kode: string;
    baris?: number;
    kolom?: number;
    m_rak_id?: string;
  };
  created_by?: string;
  updated_by?: string;
}

export interface TransferGudangItem {
  id: string;
  no_tw?: string;
  type?: TransferGudangType;
  is_approval?: boolean | number | string | null;
  opname_id?: string;
  m_unit_bisnis_id: string;
  warehouse_asal_id?: string;
  warehouse_tujuan_id?: string;
  status: string;
  tgl_tw: string;
  catatan?: string;
  pic_id?: string;
  createdAt?: string;
  updatedAt?: string;
  created_by?: string;
  updated_by?: string;
  // Relations
  m_unit_bisnis?: {
    id: string;
    nama_comp: string;
    m_company?: {
      id?: string;
      nama?: string;
    } | null;
  };
  // Backend typo: m_unit_bisni (without 's')
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
    m_company?: {
      id?: string;
      nama?: string;
    } | null;
  };
  warehouse_asal?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  warehouse_tujuan?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  pic?: {
    id: string;
    nama_kary: string;
    kode_kary: string;
  };
  // Backend might return m_kary instead of pic alias
  m_kary?: {
    id: string;
    nama_kary: string;
    kode_kary?: string;
  };
  // Detail items
  t_transfer_gudang_ds?: TransferGudangDetailItem[];
}

export interface TransferGudangDetailPayload {
  id?: string;
  stock_opname_d_id?: string | null;
  m_items_id: string;
  qty: number;
  catatan?: string | null;
  // Primary detail columns from wireframe
  rak_asal_id?: string | null;
  rak_asal_d_id?: string | null;
  rak_tujuan_id?: string | null;
  rak_tujuan_d_id?: string | null;
  // Compatibility fields consumed by backend in existing flow
  m_rak_id?: string | null;
  m_rak_d_id?: string | null;
  rak_tujuan?: string | null;
  created_by?: string;
  updated_by?: string;
}

export interface TransferGudangPayload {
  type: TransferGudangType;
  opname_id?: string | null;
  m_unit_bisnis_id: string;
  warehouse_asal_id: string;
  warehouse_tujuan_id: string;
  status?: string;
  tgl_tw: string;
  catatan?: string | null;
  pic_id: string;
  created_by?: string;
  updated_by?: string;
  t_transfer_gudang_ds: TransferGudangDetailPayload[];
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

export interface TransferGudangListResponse {
  status: string;
  data: TransferGudangItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_transfer_gudang data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with t_transfer_gudang list
 */
export async function getTransferGudangList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  companyId?: string,
  where?: string,
  columnFilters?: Record<string, string>,
): Promise<TransferGudangListResponse> {
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

  // Include relations: unit bisnis, gudang (warehouse_asal & warehouse_tujuan), and pic (m_kary)
  queryParams.append(
    "include",
    "m_unit_bisnis,m_unit_bisnis>m_company,m_gudang,m_kary",
  );

  return apiCall<TransferGudangListResponse>(
    `/dynamic/t_transfer_gudang?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TransferGudang by ID
 * @param id - TransferGudang ID
 * @returns Promise with t_transfer_gudang detail
 */
export async function getTransferGudangById(
  id: string,
): Promise<{ status: string; data: TransferGudangItem }> {
  // Include relations: unit bisnis, gudang (akan otomatis jadi warehouse_asal & warehouse_tujuan), pic, dan detail items
  const includes = [
    "m_unit_bisnis",
    "m_unit_bisnis>m_company",
    "m_gudang",
    "m_kary",
    "t_stock_opname>t_stock_opname_d>m_items:id|kode_item|nama_item",
    "t_transfer_gudang_d>m_items:id|kode_item|nama_item",
    "t_transfer_gudang_d>m_rak:id|nama_rak|kode_rak",
    "t_transfer_gudang_d>m_rak_d:id|kode|baris|kolom|m_rak_id",
  ].join(",");

  return apiCall<{ status: string; data: TransferGudangItem }>(
    `/dynamic/t_transfer_gudang/${id}?join=true&include=${encodeURIComponent(includes)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TransferGudang
 * @param data - t_transfer_gudang payload
 * @returns Promise with created TransferGudang
 */
export async function createTransferGudang(
  data: TransferGudangPayload,
): Promise<{ status: string; data: TransferGudangItem }> {
  const hasDetails = data.t_transfer_gudang_ds.length > 0;
  const endpoint = hasDetails
    ? "/dynamic/t_transfer_gudang/with-details"
    : "/dynamic/t_transfer_gudang";

  return apiCall<{ status: string; data: TransferGudangItem }>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update TransferGudang
 * @param id - TransferGudang ID
 * @param data - t_transfer_gudang payload
 * @returns Promise with updated TransferGudang
 */
export async function updateTransferGudang(
  id: string,
  data: TransferGudangPayload,
): Promise<{ status: string; data: TransferGudangItem }> {
  const hasDetails = data.t_transfer_gudang_ds.length > 0;
  const endpoint = hasDetails
    ? `/dynamic/t_transfer_gudang/with-details/${id}`
    : `/dynamic/t_transfer_gudang/${id}`;

  return apiCall<{ status: string; data: TransferGudangItem }>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Post TransferGudang - use fn endpoint post flow
 */
export async function postTransferGudang(
  id: string,
): Promise<{ status?: string; message?: string; reason?: string; data?: any }> {
  return apiCall<{
    status?: string;
    message?: string;
    reason?: string;
    data?: any;
  }>(`/fn/t_transfer_gudang/postTransferGudang`, {
    method: "POST",
    body: JSON.stringify({ t_transfer_gudang_id: id }),
  });
}

/**
 * Approve TransferGudang - use fn endpoint approval flow
 */
export async function approveTransferGudang(
  t_transfer_gudang_id: string,
  t_transfer_gudang_notifikasi_id: string | null,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: unknown }> {
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
          a.path === "/inventory/transaksi/t_transfer_gudang" &&
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

  return apiCall<{
    status: string;
    message?: string;
    data?: unknown;
  }>(`/fn/t_transfer_gudang/approveTransferGudang`, {
    method: "POST",
    body: JSON.stringify({
      t_transfer_gudang_id,
      t_transfer_gudang_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}

/**
 * Delete TransferGudang
 * @param id - TransferGudang ID
 * @returns Promise with delete confirmation
 */
export async function deleteTransferGudang(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall<{ status: string; message: string }>(
    `/dynamic/t_transfer_gudang/with-details/${id}`,
    {
      method: "DELETE",
    },
  );
}

/**
 * Get all t_transfer_gudang data without pagination (for sidebar)
 * @returns Promise with t_transfer_gudang list
 */
export async function getTransferGudangListNoPagination(): Promise<TransferGudangListResponse> {
  return apiCall<TransferGudangListResponse>(
    "/dynamic/t_transfer_gudang?no_pagination=true",
    {
      method: "GET",
    },
  );
}
