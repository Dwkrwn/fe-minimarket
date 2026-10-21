import { apiCall, bulkDeleteWithFallback } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

// Detail Item dari PO
export interface TPenerimaanBarangDetail {
  id?: string;
  t_penerimaan_barang_id?: string;
  t_purchase_order_id?: string;
  t_purchase_order_d_id?: string;
  m_items_id?: string;
  rak_d_id?: string;
  batch?: string;
  is_batch?: boolean;
  qty_diterima?: number;
  qty_sisa?: number;
  qty_po_ots?: number;
  qty_ots?: number;
  catatan?: string;
  catatan_bonus?: string;
  // Display fields (from relations)
  no_po?: string;
  kode_item?: string;
  nama_item?: string;
  qty_po?: number;
  satuan?: string;
  nama_rak_detail?: string;
  // History penerimaan fields (from GetDetail API) - now as array
  history_penerimaan?: Array<{
    qty_diterima: number;
    qty_sisa: number;
    t_penerimaan_id: string | null;
    no_penerimaan: string | null;
    tanggal_penerimaan: string | null;
    gudang_id: string | null;
    kode_gudang: string | null;
    nama_gudang: string | null;
  }>;
}

// Bonus Item
export interface TPenerimaanBarangBonus {
  id?: string;
  t_penerimaan_barang_id?: string;
  m_items_id?: string;
  qty_terima?: number;
  qty_uom?: string;
  catatan?: string;
  // Display fields
  kode_item?: string;
  nama_item?: string;
}

export interface TPenerimaanItem {
  id: string;
  no_penerimaan: string;
  tgl_penerimaan: string;
  status: string;
  m_supplier_id: string;
  m_gudang_id: string;
  m_unit_bisnis?: string;
  tgl_sj_supp: string;
  tgl_inv_supp?: string;
  no_sj_supp: string;
  no_inv_supp?: string;
  no_kontainer?: string;
  nopol?: string;
  catatan?: string;
  need_biaya_kirim?: boolean;
  created_by: string;
  edited_by?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  m_supplier?: {
    id: string;
    nama_supp: string;
  };
  m_gudang?: {
    id: string;
    nama_gudang: string;
  };
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
  };
  // Details - API returns both singular and plural forms depending on endpoint
  t_penerimaan_barang_ds?: TPenerimaanBarangDetail[];
  t_penerimaan_barang_bonus?: TPenerimaanBarangBonus[]; // from GET
  t_penerimaan_barang_bonuss?: TPenerimaanBarangBonus[]; // for POST/PUT
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

export interface TPenerimaanListResponse {
  status: string;
  data: TPenerimaanItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

// Interface for column filters
export interface ColumnFilters {
  [key: string]: string;
}

// Interface for date range filters
export interface DateRangeFilter {
  from: string;
  to: string;
}

export interface DateRangeFilters {
  [key: string]: DateRangeFilter;
}

/**
 * Get all t_penerimaan_barang data
 */
export async function getTPenerimaanList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  columnFilters?: ColumnFilters,
  dateRangeFilters?: DateRangeFilters,
): Promise<TPenerimaanListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: "m_supplier,m_gudang,m_unit_bisnis",
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  // Add column filters (filter_column_xxx) - only for text filters, NOT date
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        // Handle nested keys like 'm_supplier.nama_supp' -> 'm_supplier.nama_supp'
        queryParams.append(`filter_column_${key}`, value.trim());
      }
    });
  }

  // Add date range filters
  // Format: filter_column_field[gte]=date_from & filter_column_field[lte]=date_to
  if (dateRangeFilters) {
    Object.entries(dateRangeFilters).forEach(([key, range]) => {
      // Validate date format (YYYY-MM-DD)
      const isValidDate = (dateStr: string) => {
        if (!dateStr || dateStr === "Invalid date") return false;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr)) return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      };

      const hasValidFrom = isValidDate(range.from);
      const hasValidTo = isValidDate(range.to);

      if (hasValidFrom && hasValidTo) {
        // Both from and to - use gte/lte
        queryParams.append(`filter_column_${key}[gte]`, range.from);
        queryParams.append(`filter_column_${key}[lte]`, range.to);
      } else if (hasValidFrom) {
        queryParams.append(`filter_column_${key}[gte]`, range.from);
      } else if (hasValidTo) {
        queryParams.append(`filter_column_${key}[lte]`, range.to);
      }
      // Skip if both dates are invalid
    });
  }

  return apiCall<TPenerimaanListResponse>(
    `/dynamic/t_penerimaan_barangs?${queryParams}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get TPenerimaan by ID
 */
export async function getTPenerimaanById(
  id: string,
): Promise<{ status: string; data: TPenerimaanItem }> {
  // Include t_purchase_order_d untuk mendapatkan qty_po dan qty_sisa
  // m_items>m_general untuk satuan (uom)
  const include =
    "t_penerimaan_barang_d>m_items>m_general,t_penerimaan_barang_d>m_rak_d>m_rak,t_penerimaan_barang_d>t_purchase_order,t_penerimaan_barang_d>t_purchase_order_d,t_penerimaan_barang_bonus>m_items>m_general,m_supplier,m_gudang,m_unit_bisnis";
  return apiCall(
    `/dynamic/t_penerimaan_barangs/${id}?include=${encodeURIComponent(include)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new TPenerimaan
 */
export async function createTPenerimaan(
  data: Partial<TPenerimaanItem>,
): Promise<{ status: string; data: TPenerimaanItem }> {
  // Check if data has detail items or bonus items
  const hasDetails = !!(
    (data.t_penerimaan_barang_ds && data.t_penerimaan_barang_ds.length > 0) ||
    (data.t_penerimaan_barang_bonuss &&
      data.t_penerimaan_barang_bonuss.length > 0)
  );
  const endpoint = hasDetails
    ? "/dynamic/t_penerimaan_barangs/with-details"
    : "/dynamic/t_penerimaan_barangs";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update existing TPenerimaan
 */
export async function updateTPenerimaan(
  id: string,
  data: Partial<TPenerimaanItem>,
): Promise<{ status: string; data: TPenerimaanItem }> {
  // Check if data has detail items or bonus items
  const hasDetails = !!(
    (data.t_penerimaan_barang_ds && data.t_penerimaan_barang_ds.length > 0) ||
    (data.t_penerimaan_barang_bonuss &&
      data.t_penerimaan_barang_bonuss.length > 0)
  );
  const endpoint = hasDetails
    ? `/dynamic/t_penerimaan_barangs/with-details/${id}`
    : `/dynamic/t_penerimaan_barangs/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Post TPenerimaan - Change status to POST and create stock_gudang entries
 */
export async function postTPenerimaan(
  id: string,
): Promise<{ status: string; message?: string; data?: any }> {
  return apiCall(`/fn/t_penerimaan_barangs/postPenerimaan`, {
    method: "POST",
    body: JSON.stringify({ penerimaan_id: id }),
  });
}

/**
 * Waiting Shipping Cost - Change status to WAITING_BIAYA_KIRIM
 */
export async function waitingShippingCostTPenerimaan(
  id: string,
): Promise<{ status: string; message?: string; data?: any }> {
  return apiCall(`/dynamic/t_penerimaan_barangs/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "WAITING_BIAYA_KIRIM" }),
  });
}

/**
 * Delete TPenerimaan by ID
 */
export async function deleteTPenerimaan(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/t_penerimaan_barangs/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteTPenerimaan(
  ids: string[],
): Promise<{ status: string; message: string }> {
  return bulkDeleteWithFallback(
    "/dynamic/t_penerimaan_barangs/bulkDelete",
    ids,
    deleteTPenerimaan,
  );
}

/**
 * Sync stock from Penerimaan Barang to stock_gudang_d
 * @returns Promise with sync result
 */
export async function syncStockFromPenerimaan(): Promise<{
  status: string;
  message: string;
  data?: any;
}> {
  return apiCall(`/fn/t_penerimaan_barangs/syncStockFromPenerimaan`, {
    method: "POST",
  });
}
