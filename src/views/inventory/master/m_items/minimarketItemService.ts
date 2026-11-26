import { apiCall, apiPath } from "@/lib/api";

export interface CategoryRack {
  id: string;
  kode: string;
  nama: string;
  tipe_zona: "GUDANG" | "RAK";
  lokasi?: string | null;
  catatan?: string | null;
  is_active: boolean;
}

export interface Uom {
  id: string;
  kode_uom: string;
  nama_uom: string;
  satuan_dasar: string;
  satuan_beli: string;
  rasio_konversi: number;
  catatan?: string | null;
  is_active: boolean;
}

export interface Stock {
  id: string;
  item_id: string;
  location: "GUDANG" | "RAK";
  qty: number;
  category_rack_id?: string | null;
}

export interface ItemRop {
  id: string;
  item_id: string;
  lead_time_days: number;
  safety_stock_pcs: number;
  avg_daily_sales: number;
  rop_pcs: number;
  max_stock_pcs: number;
  is_auto_pr: boolean;
}

export interface MinimarketItem {
  id: string;
  barcode: string;
  nama_barang: string;
  category_rack_id: string;
  uom_id: string;
  harga_modal: number | string;
  harga_jual: number | string;
  catatan?: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  category_rack?: CategoryRack;
  uom?: Uom;
  stocks?: Stock[];
  rop_setting?: ItemRop | null;
}

export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export interface CreateItemPayload {
  barcode: string;
  nama_barang: string;
  category_rack_id: string;
  uom_id: string;
  harga_modal: number;
  harga_jual: number;
  catatan?: string;
  lead_time_days?: number;
  safety_stock_pcs?: number;
  max_stock_pcs?: number;
}

export interface UpdateItemPayload {
  barcode?: string;
  nama_barang?: string;
  category_rack_id?: string;
  uom_id?: string;
  harga_modal?: number;
  harga_jual?: number;
  catatan?: string;
  is_active?: boolean;
  lead_time_days?: number;
  safety_stock_pcs?: number;
  max_stock_pcs?: number;
}

/**
 * Fetch a single item by ID
 */
export async function getMinimarketItemById(id: string): Promise<MinimarketItem> {
  const res = await apiCall<ApiResponse<MinimarketItem>>(`${apiPath("/v1/inventory/items")}/${id}`, {
    method: "GET",
  });
  return res.data;
}

/**
 * Fetch all items with optional search & filter
 */
export async function getMinimarketItems(search?: string, category_rack_id?: string): Promise<MinimarketItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append("search", search.trim());
  if (category_rack_id) params.append("category_rack_id", category_rack_id);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<MinimarketItem[]>>(`${apiPath("/v1/inventory/items")}${query}`, {
    method: "GET",
  });
  return res.data || [];
}

/**
 * Fetch a single item by exact barcode (POS scan / quick lookup)
 */
export async function getMinimarketItemByBarcode(barcode: string): Promise<MinimarketItem> {
  const res = await apiCall<ApiResponse<MinimarketItem>>(
    `${apiPath("/v1/inventory/items/barcode")}/${encodeURIComponent(barcode)}`,
    { method: "GET" },
  );
  return res.data;
}

/**
 * Fetch categories & racks for dropdown
 */
export async function getCategoryRacks(): Promise<CategoryRack[]> {
  const res = await apiCall<ApiResponse<CategoryRack[]>>(`${apiPath("/v1/inventory/category-racks")}?is_active=true`, {
    method: "GET",
  });
  return res.data || [];
}

/**
 * Fetch UOM list for dropdown
 */
export async function getUoms(): Promise<Uom[]> {
  const res = await apiCall<ApiResponse<Uom[]>>(`${apiPath("/v1/inventory/uoms")}?is_active=true`, {
    method: "GET",
  });
  return res.data || [];
}

/**
 * Create a new minimarket item
 */
export async function createMinimarketItem(payload: CreateItemPayload): Promise<MinimarketItem> {
  const res = await apiCall<ApiResponse<MinimarketItem>>(apiPath("/v1/inventory/items"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

/**
 * Update an existing item
 */
export async function updateMinimarketItem(id: string, payload: UpdateItemPayload): Promise<MinimarketItem> {
  const res = await apiCall<ApiResponse<MinimarketItem>>(`${apiPath("/v1/inventory/items")}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

/**
 * Delete an item by ID
 */
export async function deleteMinimarketItem(id: string): Promise<void> {
  await apiCall(`${apiPath("/v1/inventory/items")}/${id}`, {
    method: "DELETE",
  });
}

