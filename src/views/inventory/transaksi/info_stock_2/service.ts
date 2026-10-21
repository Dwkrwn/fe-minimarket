import { apiCall } from "@/lib/api";

// ============================================================================
// SHARED INTERFACES (from info_stock/service.ts)
// ============================================================================

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentRowsCount: number;
  next_page: number | null;
  prev_page: number | null;
}

export interface Gudang {
  id: string;
  kode_gudang: string;
  m_unit_bisnis_id: string;
  is_active: boolean;
  nama_gudang: string;
  alamat_gudang: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kode_pos: string;
  catatan?: string;
  foto_gudang?: string;
  createdAt: string;
  updatedAt: string;
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
  };
}

export interface GudangListResponse {
  status: string;
  data: Gudang[];
}

export interface MRak {
  id: string;
  nama_rak: string;
  kode_rak: string;
  m_unit_bisnis_id: string;
  m_gudang_id: string;
  jumlah_baris: number | null;
  jumlah_kolom: number | null;
  catatan: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MRakD {
  id: string;
  kode: string;
  baris: number;
  kolom: number;
  m_rak_id: string;
  createdAt: string;
  updatedAt: string;
  m_rak: MRak;
}

export interface MItem {
  id: string;
  kode_item: string;
  nama_item: string;
  is_active: boolean;
  status: string;
  safety_stok?: string;
  stok_optimum?: string;
  ukuran?: string;
  hs_code?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockGudangItem {
  id: string;
  m_gudang_id: string;
  free_stock: number;
  total_stok_gudang?: number;
  total_items_in_rak?: number;
  m_items_id: string;
  m_unit_bisnis_id: string;
  m_rak_d_id: string | null;
  is_opname: boolean;
  createdAt: string;
  updatedAt: string;
  m_rak_d: MRakD | null;
  m_gudang: Gudang;
  m_item?: MItem;
  safety_stok?: string;
  stok_optimum?: string;
  status_stok?: string;
  uom_name?: string;
  category_name?: string;
  merk_name?: string;
}

export interface StockHistory {
  id: string;
  tanggal: string;
  no_transaksi: string;
  tipe_transaksi: string;
  nama_item: string;
  asal: string;
  tujuan: string;
  direction: "MASUK" | "KELUAR";
  qty: number;
  saldo: number;
  gudang: string;
  qty_masuk?: number;
  qty_keluar?: number;
}

export interface HistoryPagination {
  total: number;
  page: number;
  paginate: number;
  total_pages: number;
}

export interface StockHistoryResponse {
  status: string;
  data: StockHistory[];
  pagination: HistoryPagination;
}

export interface HistoryResponse<T> {
  status: string;
  data: T[];
  pagination?: Pagination;
}

export interface StockSummary {
  low_stock: number;
  over_stock: number;
  per_gudang: GudangSummary[];
}

export interface GudangSummary {
  id: string;
  kode_gudang: string;
  nama_gudang: string;
  nama_unit_bisnis: string;
  m_unit_bisnis_id: string | null;
  low_stock: number;
  over_stock: number;
  is_active: boolean;
}

interface StockSummaryApiResponse {
  status: string;
  data: StockSummary;
}

// ============================================================================
// INFO STOCK 2 SPECIFIC INTERFACES (Item-based grouping)
// ============================================================================

export interface ItemGroup {
  itemId: string;
  itemKode: string;
  itemNama: string;
  totalStock: number;
  totalRakLocations: number;
  safetyStok?: string;
  stokOptimum?: string;
  status?: string;
  uomName?: string;
  categoryName?: string;
  merkName?: string;
  rakLocations: RakLocation[];
  isExpanded: boolean;
}

export interface RakLocation {
  stockGudangId: string;
  rakId: string;
  rakNama: string;
  rakKode: string;
  slotKode: string;
  freeStock: number;
  isOpname: boolean;
}

export interface ItemGroupListResponse {
  status: string;
  data: ItemGroup[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Mengambil SEMUA data gudang (no pagination) untuk filter dropdown
 */
export async function getGudangList(): Promise<Gudang[]> {
  const response: GudangListResponse = await apiCall(
    "/dynamic/m_gudang?include=m_unit_bisnis:id|nama_comp&no_pagination=true",
  );
  return response.status === "success" ? response.data : [];
}

/**
 * Mengambil data stock_gudang yang sudah dikelompokkan berdasarkan item
 * Backend akan melakukan semua grouping logic
 */
export async function getStockGudangByItem(params: {
  page?: number;
  paginate?: number;
  order_by?: string;
  order_type?: "ASC" | "DESC";
  gudangId: string;
  search?: string;
  isOpname?: boolean;
}): Promise<ItemGroupListResponse> {
  const {
    page = 1,
    paginate = 10,
    order_by,
    order_type = "ASC",
    gudangId,
    search,
    isOpname,
  } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
  });

  if (order_by) {
    queryParams.append("order_by", order_by);
    queryParams.append("order_type", order_type);
  }

  if (gudangId) {
    queryParams.append("filter_column_m_gudang_id", gudangId);
  }

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
    queryParams.append("searchfield", "m_items.nama_item,m_items.kode_item");
  }

  if (isOpname === true) {
    queryParams.append("filter_column_is_opname", "true");
  }

  const response = await apiCall<any>(
    `/fn/stock_gudang/getStockGudangByItem?${queryParams}`,
    {
      method: "GET",
    },
  );

  const currentPage = response.pagination?.page ?? page;
  const totalPages = response.pagination?.totalPages ?? 1;
  const total = response.pagination?.total_items ?? (response.data?.length ?? 0);
  const limit = response.pagination?.limit ?? paginate;

  return {
    status: response.status,
    data: response.data ?? [],
    pagination: {
      total,
      page: currentPage,
      totalPages,
      limit,
      currentRowsCount: response.data?.length ?? 0,
      next_page: currentPage < totalPages ? currentPage + 1 : null,
      prev_page: currentPage > 1 ? currentPage - 1 : null,
    },
  };
}

/**
 * Mengambil summary stock semua gudang dari endpoint aggregasi backend
 */
export async function getStockSummary(
  companyId?: string | null
): Promise<StockSummary> {
  const url = companyId
    ? `/fn/stock_gudang/getStockGudangSummary?m_unit_bisnis_id=${companyId}`
    : `/fn/stock_gudang/getStockGudangSummary`;

  const response = await apiCall<StockSummaryApiResponse>(url, {
    method: "GET",
  });

  if (response.status === "success") {
    return response.data;
  }

  return {
    low_stock: 0,
    over_stock: 0,
    per_gudang: [],
  };
}

/**
 * Mengambil history pergerakan stock (masuk & keluar) berdasarkan stock_gudang_id
 */
export async function getStockHistory(params: {
  stockGudangId: string;
  page?: number;
  paginate?: number;
  no_transaksi?: string;
  asal?: string;
  tujuan?: string;
  type?: string;
  searchField?: string;
  search?: string;
}): Promise<StockHistoryResponse> {
  const {
    stockGudangId,
    page = 1,
    paginate = 10,
    type,
    search,
    searchField,
  } = params;
  const q = new URLSearchParams({
    stock_gudang_id: stockGudangId,
    page: page.toString(),
    paginate: paginate.toString(),
  });
  if (type && type.trim()) q.append("type", type.trim());
  if (search && search.trim()) {
    q.append("search", search.trim());
    if (searchField) {
      q.append("searchfield", searchField);
    }
  }
  const response: StockHistoryResponse = await apiCall(
    `/fn/stock_gudang/stock_history?${q}`,
  );
  return response;
}
