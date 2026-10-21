import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface PenerimaanGudangItem {
  id: string;
  m_unit_bisnis_id: string;
  no_penerimaan_gudang: string;
  tgl_penerimaan_gudang: string;
  t_sj_gudang_id: string;
  pic_penerima_id: string;
  warehouse_asal_id?: string;
  warehouse_terima_id?: string;
  catatan?: string;
  has_selisih?: boolean;
  status: "DRAFT" | "IN APPROVAL" | "APPROVED" | "REJECT" | "REVISI";
  createdAt: string;
  updatedAt: string;
  created_by?: string;
  updated_by?: string;
  // Relations (optional - populated with include query)
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
    m_company?: {
      id?: string;
      nama?: string;
    } | null;
  };
  pic_penerima_gudang?: {
    id: string;
    nama_kary: string;
  };
  pen_gd_asl?: {
    id: string;
    nama_gudang: string;
  };
  pen_gd_trm?: {
    id: string;
    nama_gudang: string;
  };
  surat_jalan_gudang?: {
    id: string;
    no_sj_gudang: string;
    gudang_sj_tujuan?: {
      id: string;
      nama_gudang: string;
    };
    sj_gd_asl?: {
      id: string;
      nama_gudang: string;
    };
    sj_gd_trm?: {
      id: string;
      nama_gudang: string;
    };
  };
  // Detail items (optional - only if module has details)
  t_penerimaan_gudang_d?: {
    id: string;
    t_penerimaan_gudang_id: string;
    t_sj_gudang_d_id: string;
    qty_terima: number;
    catatan?: string;
    createdAt: string;
    updatedAt: string;
    sj_gudang_d?: {
      id: string;
      m_barang_id: string;
      qty: number;
      m_barang?: {
        id: string;
        kode: string;
        nama: string;
        m_satuan?: {
          id: string;
          nama: string;
        };
      };
    };
  }[];
  t_penerimaan_gudang_foto?: {
    id: string;
    t_penerimaan_gudang_id: string;
    foto_bukti_terima: string;
    createdAt: string;
    updatedAt: string;
  }[];
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

export interface PenerimaanGudangListResponse {
  status: string;
  data: PenerimaanGudangItem[];
  pagination: Pagination;
}

// ============================================================================
// HISTORY PENGIRIMAN INTERFACES
// ============================================================================

export interface SjGudangHistoryItem {
  id: string;
  no_sj_gudang: string;
  tgl_sj_gudang: string;
  status: string;
  tipe_sj_gudang?: string;
  gudang_asal: {
    id: string;
    nama_gudang: string;
  } | null;
  gudang_tujuan: {
    id: string;
    nama_gudang: string;
  } | null;
}

export interface HistoryPengirimanResponse {
  status: string;
  data: SjGudangHistoryItem[];
}

export interface SendApprovalV2Payload {
  t_penerimaan_gudang_id: string;
  sender_id: string;
  approval_catatan?: string;
}

export interface SendApprovalV2Response {
  status: string;
  message: string;
  data: {
    t_penerimaan_gudang_id: string;
    approval_flow: 'SINGLE_FLOW' | 'DOUBLE_FLOW';
    has_selisih: boolean;
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all t_penerimaan_gudang data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @param filterCreatedBy - Filter by created_by user ID (optional)
 * @param filters - Column filters for API-based filtering (optional)
 * @param filterOperators - Filter operators for columns (optional)
 * @param where - WHERE clause for complex filtering (optional)
 * @returns Promise with t_penerimaan_gudang list
 */
export async function getPenerimaanGudangList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filterCreatedBy?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string,
): Promise<PenerimaanGudangListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include:
      "m_gudang,m_unit_bisnis,m_unit_bisnis>m_company,m_kary:id|nama_kary,t_sj_gudang:id|no_sj_gudang>m_gudang:id|nama_gudang",
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  if (filterCreatedBy) {
    queryParams.append("filter_column_created_by", filterCreatedBy);
  }

  // Add column filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
      }
    });
  }

  // Add filter operators
  if (filterOperators) {
    Object.entries(filterOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value);
      }
    });
  }

  // Add WHERE clause for complex filtering
  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<PenerimaanGudangListResponse>(
    `/dynamic/t_penerimaan_gudang?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get PenerimaanGudang by ID
 * @param id - PenerimaanGudang ID
 * @returns Promise with t_penerimaan_gudang detail
 */
export async function getPenerimaanGudangById(
  id: string,
): Promise<{ status: string; data: PenerimaanGudangItem }> {
  const includes = [
    "m_gudang:id|nama_gudang",
    "m_unit_bisnis",
    "m_unit_bisnis>m_company",
    "m_kary:id|nama_kary",
    "t_sj_gudang:id|no_sj_gudang>m_gudang:id|nama_gudang",
    "t_penerimaan_gudang_d>m_items:id|nama_item|kode_item>m_general:id|value1",
    "t_penerimaan_gudang_d>m_items",
    "t_penerimaan_gudang_d>t_sj_gudang_d:id|qty_sj_gudang",
    "t_penerimaan_gudang_foto",
  ].join(",");

  return apiCall(
    `/dynamic/t_penerimaan_gudang/${id}?join=true&include=${encodeURIComponent(includes)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get PenerimaanGudang data with flat detail structure (custom function)
 * @param id - PenerimaanGudang ID
 * @returns Promise with flat structured t_penerimaan_gudang detail
 */
export async function getPenerimaanGudangDataGudang(
  id: string,
): Promise<{ status: string; data: PenerimaanGudangItem }> {
  return apiCall(`/fn/t_penerimaan_gudang/data_gudang?id=${id}`, {
    method: "GET",
  });
}

/**
 * Create new PenerimaanGudang
 * @param data - t_penerimaan_gudang data
 * @returns Promise with created PenerimaanGudang
 */
export async function createPenerimaanGudang(
  data: Partial<PenerimaanGudangItem>,
): Promise<{ status: string; data: PenerimaanGudangItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_penerimaan_gudang_d || data.t_penerimaan_gudang_foto
  );
  const endpoint = hasDetails
    ? "/dynamic/t_penerimaan_gudang/with-details"
    : "/dynamic/t_penerimaan_gudang";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update PenerimaanGudang
 * @param id - PenerimaanGudang ID
 * @param data - t_penerimaan_gudang data to update
 * @returns Promise with updated PenerimaanGudang
 */
export async function updatePenerimaanGudang(
  id: string,
  data: Partial<PenerimaanGudangItem>,
): Promise<{ status: string; data: PenerimaanGudangItem }> {
  // Check if data has detail items
  const hasDetails = !!(
    data.t_penerimaan_gudang_d || data.t_penerimaan_gudang_foto
  );
  const endpoint = hasDetails
    ? `/dynamic/t_penerimaan_gudang/with-details/${id}`
    : `/dynamic/t_penerimaan_gudang/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete PenerimaanGudang
 * @param id - PenerimaanGudang ID
 * @returns Promise with delete confirmation
 */
export async function deletePenerimaanGudang(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_penerimaan_gudang/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all t_penerimaan_gudang data without pagination (for sidebar)
 * @returns Promise with t_penerimaan_gudang list
 */
export async function getPenerimaanGudangListNoPagination(): Promise<PenerimaanGudangListResponse> {
  return apiCall<PenerimaanGudangListResponse>(
    "/dynamic/t_penerimaan_gudang?no_pagination=true",
    {
      method: "GET",
    },
  );
}

// ============================================================================
// APPROVAL API FUNCTIONS
// ============================================================================

/**
 * Send approval request for PenerimaanGudang
 * @param data - Approval notification data
 * @returns Promise with created notification
 */
export async function sendApprovalPenerimaanGudang(data: {
  title?: string;
  approval_level: number;
  sender_id: string;
  t_penerimaan_gudang_id: string;
  approval_message?: string;
  status_name?: string;
}): Promise<{ status: string; data: any; message?: string }> {
  return apiCall("/dynamic/t_penerimaan_gudang_notifikasi", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get approval history for PenerimaanGudang
 * @param penerimaanGudangId - PenerimaanGudang ID
 * @returns Promise with approval history
 */
export async function getApprovalHistoryPenerimaanGudang(
  penerimaanGudangId: string,
): Promise<{ status: string; data: any[] }> {
  const queryParams = new URLSearchParams({
    filter_column_t_penerimaan_gudang_id: penerimaanGudangId,
    order_by: "createdAt",
    order_type: "DESC",
    include: "user_default:id|name",
  });

  return apiCall(`/dynamic/t_penerimaan_gudang_notifikasi?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Approve PenerimaanGudang
 * @param data - Approval data
 * @returns Promise with approval result
 */
export async function approvePenerimaanGudang(data: {
  penerimaan_gudang_id: string;
  penerimaan_gudang_notifikasi_id: string;
  approval_level: number;
  approval_catatan?: string;
  user_approved_id: string;
  sender_id: string;
  m_approval_id: string;
}): Promise<{ status: string; message: string; data: any }> {
  return apiCall("/dynamic/t_penerimaan_gudang/approve", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Reject PenerimaanGudang
 * @param data - Rejection data
 * @returns Promise with rejection result
 */
export async function rejectPenerimaanGudang(data: {
  penerimaan_gudang_id: string;
  penerimaan_gudang_notifikasi_id: string;
  approval_level: number;
  approval_catatan?: string;
  user_approved_id: string;
}): Promise<{ status: string; message: string; data: any }> {
  return apiCall("/dynamic/t_penerimaan_gudang/reject", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Request revision for PenerimaanGudang
 * @param data - Revision data
 * @returns Promise with revision result
 */
export async function revisiPenerimaanGudang(data: {
  penerimaan_gudang_id: string;
  penerimaan_gudang_notifikasi_id: string;
  approval_level: number;
  approval_catatan?: string;
  user_approved_id: string;
}): Promise<{ status: string; message: string; data: any }> {
  return apiCall("/dynamic/t_penerimaan_gudang/revisi", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get history pengiriman — SJ Gudang yang sedang dalam perjalanan menuju gudang tertentu
 * @param gudangId - ID gudang tujuan
 * @returns Promise with list of SJ Gudang in transit
 */
export async function getHistoryPengiriman(
  gudangId: string,
): Promise<HistoryPengirimanResponse> {
  return apiCall<HistoryPengirimanResponse>(
    `/fn/t_sj_gudang/history_pengiriman?gudang_id=${gudangId}`,
    { method: 'GET' },
  );
}

/**
 * Send approval v2 — Support single flow & double approval (selisih)
 * @param data - Approval payload
 * @returns Promise with approval result
 */
export async function sendApprovalPenerimaanGudangV2(
  data: SendApprovalV2Payload,
): Promise<SendApprovalV2Response> {
  return apiCall('/fn/t_penerimaan_gudang/send_approval', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
