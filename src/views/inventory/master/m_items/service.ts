import { apiCall } from "@/lib/api";
import type { GeneralItem } from "@/views/setup/m_general/service";
import { applyFilterQueryParams } from "@/composables/useDataTableFilters";

// ============================================================================
// INTERFACES
// ============================================================================

export interface ItemsItem {
  id?: string;
  ukuran_id?: string | null;
  group3_id?: string | null;
  group4_id?: string | null;
  group5_id?: string | null;
  group6_id?: string | null;
  uom_id?: string | null;
  is_active?: boolean;
  created_by?: string;
  updated_by?: string;
  safety_stok?: number | null;
  stok_optimum?: number | null;
  toleransi?: number | null;
  company_id?: string | null;
  tipe_id?: string | null;
  kategori_id?: string | null;
  group1_id?: string | null;
  group2_id?: string | null;
  kode_item?: string | null;
  nama_item?: string | null;
  nama_spek?: string | null;
  berat_bersih?: number | null;
  status?: string | null;
  catatan?: string | null;
  hs_code?: string | null;
  ukuran?: number | null;

  // Relations / Details
  m_items_images?: {
    m_items_id?: string;
    gambar?: string;
  }[];
  m_items_unit_bisnis?: {
    items_id?: string;
    unit_bisnis_id?: string;
    company_id?: string | null;
  }[];
  m_items_gudang?: {
    id?: string;
    items_id?: string;
    gudang_id: string;
    safety_stok?: number;
    stok_optimum?: number;
  }[];
  m_items_raks?: {
    id?: string;
    items_id?: string;
    rak_d_id?: string;
    is_default?: boolean;
    sequence?: number | null;
  }[];
  m_items_conversions?: {
    uom_id?: string;
    qty?: number;
    uom_konversi_id?: string;
    items_id?: string;
  }[];
  mi_tipe?: GeneralItem;
  kategori?: GeneralItem;
  group1?: GeneralItem;
  group2?: GeneralItem;
  group3?: GeneralItem;
  group4?: GeneralItem;
  group5?: GeneralItem;
  group6?: GeneralItem;
  mi_uom?: GeneralItem;
  mi_ukuran?: GroupUkuran;
  createdAt?: string;
  updatedAt?: string;
  mi_kategori?: any;
  is_sepuh?: boolean;
  is_potong?: boolean;
  is_import?: boolean;
  berat_jenis?: number | null;
  qc_tipe?: string | null;
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

export interface ItemsListResponse {
  status: string;
  data: ItemsItem[];
  pagination: Pagination;
}

// ============================================================================
// GROUP INTERFACES (for cascade dropdowns)
// ============================================================================

export interface GroupJenis {
  id: string;
  code?: string;
  name: string;
  status?: boolean;
  is_active?: boolean;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMerek {
  id: string;
  category_id: string;
  code?: string;
  name: string;
  status?: boolean;
  is_active?: boolean;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupTipe {
  id: string;
  g1_type_id: string;
  code?: string;
  name: string;
  status?: boolean;
  is_active?: boolean;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupUkuran {
  id: string;
  g6_merk_id?: string;
  panjang?: number | null;
  code?: string;
  name: string;
  status?: boolean;
  is_active?: boolean;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupBatch {
  id: string;
  code?: string;
  name: string;
  status?: boolean;
  is_active?: boolean;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// MATERIAL / UNIT BISNIS HIERARCHY INTERFACES
// ============================================================================

export interface RakDetail {
  id: string; // rak_d_id
  kode: string;
  kolom?: number;
  baris?: number;
}

export interface Rak {
  id: string; // m_rak_id
  nama_rak: string;
  kode_rak?: string;
  m_rak_ds: RakDetail[];
}

export interface Gudang {
  id: string; // m_gudang_id
  nama_gudang: string;
  m_raks: Rak[];
}

export interface UnitBisnis {
  id: string;
  company_id?: string | null;
  nama_comp: string;
  kode_unit_bisnis?: string | null;
  m_gudangs: Gudang[];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all m_items data
 * @param page - Page number (default: 1)
 * @param paginate - Items per page (default: 10)
 * @param order_by - Column to order by
 * @param order_type - ASC or DESC
 * @param search - Search term
 * @param searchfield - Comma-separated fields to search in
 * @returns Promise with m_items list
 */
export async function getItemsList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  include?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string,
): Promise<ItemsListResponse> {
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

  if (include) {
    queryParams.append("include", include);
  }

  applyFilterQueryParams(queryParams, filters, filterOperators, where);

  return apiCall<ItemsListResponse>(`/dynamic/m_items?${queryParams}`, {
    method: "GET",
  });
}

/**
 * Get Items by ID with relations
 * @param id - Items ID
 * @returns Promise with m_items detail
 */
export async function getItemsById(
  id: string,
): Promise<{ status: string; data: ItemsItem }> {
  const include =
    "m_general@mi_tipe,m_g_category@mi_kategori,m_g1_type@group1,m_g2_material@group2,m_g3_standard@group3,m_g4_subtype@group4,m_g5_finishing@group5,m_g6_merk@group6,m_general@mi_uom,m_g_ukuran@mi_ukuran,m_items_image,m_items_unit_bisnis>m_unit_bisnis,m_items_rak,m_items_conversion,m_items_gudang>m_gudang";
  return apiCall(
    `/dynamic/m_items/${id}?include=${encodeURIComponent(include)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Create new Items
 * @param data - m_items data
 * @returns Promise with created Items
 */
export async function createItems(
  data: Partial<ItemsItem>,
): Promise<{ status: string; data: ItemsItem; message?: string }> {
  const endpoint = "/dynamic/m_items/with-details";
  const result = await apiCall<{
    status: string;
    data: ItemsItem;
    message?: string;
  }>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}

/**
 * Update Items
 * @param id - Items ID
 * @param data - m_items data to update
 * @returns Promise with updated Items
 */
export async function updateItems(
  id: string,
  data: Partial<ItemsItem>,
): Promise<{ status: string; data: ItemsItem; message?: string }> {
  const endpoint = `/dynamic/m_items/with-details/${id}`;

  const result = await apiCall<{
    status: string;
    data: ItemsItem;
    message?: string;
  }>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return result;
}

/**
 * Validate Item Name (duplicate check via group1-group6 + ukuran)
 * @param data - { tipe_id, kategori_id, group1..group6, ukuran, exclude_id? }
 * @returns Promise with validation results (valid, exact_matches, partial_matches)
 */
export async function validateItemName(data: {
  tipe_id: string;
  kategori_id: string;
  group1: string;
  group2: string;
  group3: string;
  group4?: string;
  group5?: string;
  group6?: string;
  ukuran: string;
  exclude_id?: string;
}): Promise<{
  status: string;
  data: {
    valid: boolean;
    nama_item: string;
    exact_matches: {
      id: string;
      kode_item: string;
      nama_item: string;
      ukuran: string;
    }[];
    partial_matches: {
      id: string;
      kode_item: string;
      nama_item: string;
      ukuran: string;
    }[];
    counts: { exact: number; partial: number };
  };
  message: string;
}> {
  const endpoint = "/fn/m_items/validateItemName";
  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Delete Items
 * @param id - Items ID
 * @returns Promise with delete confirmation
 */
export async function deleteItems(
  id: string,
): Promise<{ status: string; message: string }> {
  // Always use with-details endpoint for delete to handle cascade
  return apiCall(`/dynamic/m_items/with-details/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get all m_items data without pagination (for sidebar)
 * @returns Promise with m_items list
 */
export async function getItemsListNoPagination(): Promise<ItemsListResponse> {
  return apiCall<ItemsListResponse>("/dynamic/m_items?no_pagination=true", {
    method: "GET",
  });
}

// ============================================================================
// GROUP CASCADE API FUNCTIONS
// ============================================================================

/**
 * Get all Group Jenis
 */
export async function getGroupJenisList(): Promise<{
  status: string;
  data: GroupJenis[];
}> {
  return apiCall("/dynamic/m_g_category?no_pagination=true&filter_column_status=POST", {
    method: "GET",
  });
}

/**
 * Get Group Merek filtered by Jenis ID
 */
export async function getGroupMerekByJenis(
  jenisId: string,
): Promise<{ status: string; data: GroupMerek[] }> {
  return apiCall(
    `/dynamic/m_g1_type?no_pagination=true&filter_column_status=POST&where_category_id=${jenisId}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get Group Tipe filtered by Merek ID
 */
export async function getGroupTipeByMerek(
  merekId: string,
): Promise<{ status: string; data: GroupTipe[] }> {
  return apiCall(
    `/dynamic/m_g2_material?no_pagination=true&filter_column_status=POST&where_g1_type_id=${merekId}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get Group Ukuran filtered by Tipe ID
 */
export async function getGroupUkuranByTipe(
  tipeId: string,
): Promise<{ status: string; data: GroupUkuran[] }> {
  return apiCall(
    `/dynamic/m_g3_standard?no_pagination=true&filter_column_status=POST&where_g2_type_id=${tipeId}`,
    {
      method: "GET",
    },
  );
}

/**
 * Get Group Batch filtered by Ukuran ID
 */
export async function getGroupBatchByUkuran(
  ukuranId: string,
): Promise<{ status: string; data: GroupBatch[] }> {
  return apiCall(
    `/dynamic/m_g4_subtype?no_pagination=true&filter_column_status=POST&where_g3_standard_id=${ukuranId}`,
    {
      method: "GET",
    },
  );
}

export async function getGroup5ByGroup4(
  group4Id: string,
): Promise<{ status: string; data: GroupBatch[] }> {
  return apiCall(
    `/dynamic/m_g5_finishing?no_pagination=true&filter_column_status=POST&where_g4_subtype_id=${group4Id}`,
    {
      method: "GET",
    },
  );
}

export async function getGroup6ByGroup5(
  group5Id: string,
): Promise<{ status: string; data: GroupBatch[] }> {
  return apiCall(
    `/dynamic/m_g6_merk?no_pagination=true&filter_column_status=POST&where_g5_finishing_id=${group5Id}`,
    {
      method: "GET",
    },
  );
}

export async function getUkuranByGroup6(
  group6Id: string,
): Promise<{ status: string; data: GroupUkuran[] }> {
  return apiCall(
    `/dynamic/m_g_ukuran?no_pagination=true&filter_column_status=POST&where_g6_merk_id=${group6Id}`,
    {
      method: "GET",
    },
  );
}

/**
 * Delete draft items that are not completed
 * This function should be called on landing page to clean up unused draft items
 */
export async function deleteDraftItems(): Promise<{
  status: string;
  message?: string;
}> {
  return apiCall(`/fn/m_items/deleteDraftItems`, {
    method: "POST",
  });
}

/**
 * Mengecek apakah item memiliki histori transaksi stok melalui Custom Function
 * dengan graceful fallback ke direct dynamic API.
 */
export async function checkItemHasStockTransactions(
  itemId: string,
): Promise<boolean> {
  if (!itemId) return false;

  // 1. Panggil Custom Function backend (/fn/m_items/checkStockTransactions)
  try {
    const res = await apiCall<{
      status: string;
      data?: { hasTransactions?: boolean };
    }>(
      `/fn/m_items/checkStockTransactions?itemId=${encodeURIComponent(itemId)}`,
      { 
        method: "GET",
      },
    );

    if (res?.status === "success" && res.data) {
      return !!res.data.hasTransactions;
    }
  } catch (error) {
    console.warn(
      "[checkItemHasStockTransactions] Custom function fallback to dynamic query:",
      error,
    );
  }

  // 2. Graceful Fallback (Direct dynamic query ke stock_gudang_d dan stock_gudang)
  try {
    const ledgerRes = await apiCall<{ status: string; data: any[] }>(
      `/dynamic/stock_gudang_d?filter_column_m_items_id=${encodeURIComponent(itemId)}&limit=1&selectfield=id`,
      { method: "GET" },
    );
    if (ledgerRes?.data && ledgerRes.data.length > 0) {
      return true;
    }

    const stockRes = await apiCall<{ status: string; data: any[] }>(
      `/dynamic/stock_gudang?filter_column_m_items_id=${encodeURIComponent(itemId)}&no_pagination=true&selectfield=id,free_stock`,
      { method: "GET" },
    );
    if (
      stockRes?.data &&
      stockRes.data.some((row) => Number(row.free_stock || 0) > 0)
    ) {
      return true;
    }

    return false;
  } catch (err) {
    console.error("[checkItemHasStockTransactions] Fallback error:", err);
    return false;
  }
}

